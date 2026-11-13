import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetProviderProfileResponse,
  ListPublicProvidersQueryParams,
  ListPublicProvidersResponse,
  SaveProviderProfileBody,
  SaveProviderProfileResponse,
} from "@workspace/api-zod";
import {
  db,
  providerAvailabilityTable,
  providerProfilesTable,
  providerServicesTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { isAllowedProviderLink } from "../lib/providerLinks";

const router: IRouter = Router();

router.get("/providers", async (req, res): Promise<void> => {
  const parsed = ListPublicProvidersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { q, category, page, pageSize } = parsed.data;
  const conditions = [eq(providerProfilesTable.approvalStatus, "approved")];
  if (category) conditions.push(eq(providerProfilesTable.category, category));
  if (q) {
    const escapedQuery = q.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escapedQuery}%`;
    const textMatch = or(
      ilike(providerProfilesTable.name, pattern),
      ilike(providerProfilesTable.neighborhood, pattern),
      ilike(providerProfilesTable.description, pattern),
    );
    if (!textMatch) throw new Error("Provider search requires at least one searchable field.");
    conditions.push(textMatch);
  }
  const where = and(...conditions);
  const offset = (page - 1) * pageSize;
  const [profiles, totals] = await Promise.all([
    db
      .select({
        id: providerProfilesTable.id,
        name: providerProfilesTable.name,
        category: providerProfilesTable.category,
        neighborhood: providerProfilesTable.neighborhood,
        description: providerProfilesTable.description,
        websiteUrl: providerProfilesTable.websiteUrl,
        instagramUrl: providerProfilesTable.instagramUrl,
        facebookUrl: providerProfilesTable.facebookUrl,
        whatsappUrl: providerProfilesTable.whatsappUrl,
      })
      .from(providerProfilesTable)
      .where(where)
      .orderBy(asc(providerProfilesTable.name), asc(providerProfilesTable.id))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerProfilesTable)
      .where(where),
  ]);

  const providerIds = profiles.map((profile) => profile.id);
  const [services, availabilities] = providerIds.length
    ? await Promise.all([
        db
          .select()
          .from(providerServicesTable)
          .where(
            and(
              inArray(providerServicesTable.providerProfileId, providerIds),
              eq(providerServicesTable.isActive, true),
            ),
          )
          .orderBy(
            asc(providerServicesTable.providerProfileId),
            asc(providerServicesTable.name),
          ),
        db
          .select()
          .from(providerAvailabilityTable)
          .where(inArray(providerAvailabilityTable.providerProfileId, providerIds)),
      ])
    : [[], []];
  const servicesByProvider = new Map<string, typeof services>();
  for (const service of services) {
    const providerServices = servicesByProvider.get(service.providerProfileId) ?? [];
    providerServices.push(service);
    servicesByProvider.set(service.providerProfileId, providerServices);
  }
  const availabilityByProvider = new Map(
    availabilities.map((availability) => [
      availability.providerProfileId,
      availability,
    ]),
  );
  const items = profiles.map((profile) => {
    const availability = availabilityByProvider.get(profile.id);
    return {
      ...profile,
      services: (servicesByProvider.get(profile.id) ?? []).map(
        ({ id, name, description, durationMinutes, priceCop }) => ({
          id,
          name,
          description,
          durationMinutes,
          priceCop,
        }),
      ),
      availability: {
        timezone: availability?.timezone ?? "America/Bogota",
        weeklyWindows: availability?.weeklyWindows ?? [],
        exceptions: availability?.exceptions ?? [],
      },
    };
  });
  const response = ListPublicProvidersResponse.parse({
    items,
    total: Number(totals[0]?.count ?? 0),
    page,
    pageSize,
  });
  res.json({
    ...response,
    items: response.items.map((item) => ({
      ...item,
      availability: {
        ...item.availability,
        exceptions: item.availability.exceptions.map((exception) => ({
          ...exception,
          date: exception.date.toISOString().slice(0, 10),
        })),
      },
    })),
  });
});

router.use("/provider-profile", requireAuth);

router.get(
  "/provider-profile",
  requireRole("provider"),
  async (req, res): Promise<void> => {
    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const [provider] = await db
      .select()
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.userId, profile.id))
      .limit(1);

    res.json(GetProviderProfileResponse.parse(provider ?? null));
  },
);

router.put(
  "/provider-profile",
  requireRole("provider"),
  async (req, res): Promise<void> => {
    const parsed = SaveProviderProfileBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const linkFields = [
      "websiteUrl",
      "instagramUrl",
      "facebookUrl",
      "whatsappUrl",
    ] as const;
    if (linkFields.some(key => !isAllowedProviderLink(key, parsed.data[key]))) {
      res.status(400).json({
        error: "Usa enlaces HTTPS y verifica que cada red corresponda a su campo.",
      });
      return;
    }

    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const values = {
      name: parsed.data.name.trim(),
      category: parsed.data.category,
      neighborhood: parsed.data.neighborhood.trim(),
      description: parsed.data.description?.trim() || null,
      websiteUrl: parsed.data.websiteUrl?.trim() || null,
      instagramUrl: parsed.data.instagramUrl?.trim() || null,
      facebookUrl: parsed.data.facebookUrl?.trim() || null,
      whatsappUrl: parsed.data.whatsappUrl?.trim() || null,
    };

    const [provider] = await db
      .insert(providerProfilesTable)
      .values({
        userId: profile.id,
        ...values,
        approvalStatus: "pending",
      })
      .onConflictDoUpdate({
        target: providerProfilesTable.userId,
        set: {
          ...values,
          approvalStatus: "pending",
          approvedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(SaveProviderProfileResponse.parse(provider));
  },
);

export default router;
