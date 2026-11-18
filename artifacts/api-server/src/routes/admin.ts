import { asc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetAdminOverviewResponse,
  ListAdminProvidersQueryParams,
  ListAdminProvidersResponse,
  UpdateProviderApprovalBody,
  UpdateProviderApprovalParams,
  UpdateProviderApprovalResponse,
} from "@workspace/api-zod";
import {
  db,
  petsTable,
  providerApprovalAuditTable,
  providerProfilesTable,
  userProfilesTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.use("/admin", requireAuth, requireRole("admin"));

router.get("/admin/overview", async (_req, res): Promise<void> => {
  const [accounts, pets, providers, pendingProviders] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(userProfilesTable),
    db.select({ count: sql<number>`count(*)::int` }).from(petsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(providerProfilesTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(providerProfilesTable)
      .where(eq(providerProfilesTable.approvalStatus, "pending")),
  ]);

  res.json(
    GetAdminOverviewResponse.parse({
      accounts: Number(accounts[0]?.count ?? 0),
      pets: Number(pets[0]?.count ?? 0),
      providerProfiles: Number(providers[0]?.count ?? 0),
      pendingProviders: Number(pendingProviders[0]?.count ?? 0),
    }),
  );
});

router.get("/admin/providers", async (req, res): Promise<void> => {
  const parsed = ListAdminProvidersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const status = parsed.data.status;
  const providers = status
    ? await db
        .select()
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.approvalStatus, status))
        .orderBy(asc(providerProfilesTable.createdAt))
    : await db
        .select()
        .from(providerProfilesTable)
        .orderBy(asc(providerProfilesTable.createdAt));

  res.json(ListAdminProvidersResponse.parse(providers));
});

router.patch(
  "/admin/providers/:providerId/approval",
  async (req, res): Promise<void> => {
    const params = UpdateProviderApprovalParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateProviderApprovalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const actor = req.petPulseProfile;
    if (!actor) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.id, params.data.providerId))
        .for("update")
        .limit(1);
      if (!existing) return null;

      if (existing.approvalStatus === parsed.data.approvalStatus) {
        return existing;
      }

      const now = new Date();
      const [provider] = await tx
        .update(providerProfilesTable)
        .set({
          approvalStatus: parsed.data.approvalStatus,
          approvedAt: parsed.data.approvalStatus === "approved" ? now : null,
          updatedAt: now,
        })
        .where(eq(providerProfilesTable.id, params.data.providerId))
        .returning();

      if (provider) {
        await tx.insert(providerApprovalAuditTable).values({
          providerProfileId: provider.id,
          actorProfileId: actor.id,
          actorEmail: actor.email,
          previousStatus: existing.approvalStatus,
          approvalStatus: provider.approvalStatus,
          createdAt: now,
        });
      }
      return provider;
    });

    if (!result) {
      res.status(404).json({ error: "No se encontró ese perfil de proveedor." });
      return;
    }

    res.json(UpdateProviderApprovalResponse.parse(result));
  },
);

export default router;
