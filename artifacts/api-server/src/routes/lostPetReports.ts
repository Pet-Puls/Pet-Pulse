import { and, asc, desc, eq, gt, inArray, lte, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CloseLostPetReportParams,
  CloseLostPetReportResponse,
  CreateLostPetReportBody,
  CreateLostPetReportParams,
  CreateLostPetReportResponse,
  ListLostPetReportsResponse,
  RenewLostPetReportBody,
  RenewLostPetReportParams,
  RenewLostPetReportResponse,
} from "@workspace/api-zod";
import {
  db,
  lostPetReportsTable,
  petsTable,
  type LostPetReportRecord,
} from "@workspace/db";
import { expireLostPetReports } from "../lib/lostPetReports";
import { getPetPhotoUrl } from "../lib/petPhotoStorage";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();
const reportDurationMs = 72 * 60 * 60 * 1000;

function isValidInput(
  input: { locationDescription: string; lastSeenAt: Date; consentToShareLocation: boolean },
  now: Date,
): string | null {
  if (input.consentToShareLocation !== true) {
    return "Debes aceptar compartir la ubicación aproximada con miembros de Monka.";
  }
  if (input.locationDescription.trim().length < 2) {
    return "Indica el barrio o sector aproximado.";
  }
  if (input.lastSeenAt > now) {
    return "La última vez que viste a tu mascota no puede estar en el futuro.";
  }
  return null;
}

async function toReportResponse(
  report: LostPetReportRecord,
  pet: Pick<typeof petsTable.$inferSelect, "name" | "species" | "breed" | "photoPath">,
  currentOwnerId: string,
) {
  return {
    id: report.id,
    petId: report.petId,
    petName: pet.name,
    species: pet.species,
    breed: pet.breed,
    photoUrl: pet.photoPath ? await getPetPhotoUrl(pet.photoPath) : null,
    locationDescription: report.locationDescription,
    lastSeenAt: report.lastSeenAt,
    notes: report.notes,
    expiresAt: report.expiresAt,
    status: report.status,
    canManage: report.ownerId === currentOwnerId,
  };
}

router.get(
  "/lost-pet-reports",
  requireAuth,
  requireRole("owner", "provider", "admin"),
  async (req, res): Promise<void> => {
    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const now = new Date();
    await expireLostPetReports(now);
    const reports = await db
      .select({
        report: lostPetReportsTable,
        petName: petsTable.name,
        species: petsTable.species,
        breed: petsTable.breed,
        photoPath: petsTable.photoPath,
      })
      .from(lostPetReportsTable)
      .innerJoin(petsTable, eq(lostPetReportsTable.petId, petsTable.id))
      .where(
        or(
          and(
            eq(lostPetReportsTable.status, "active"),
            gt(lostPetReportsTable.expiresAt, now),
          ),
          eq(lostPetReportsTable.ownerId, profile.id),
        ),
      )
      .orderBy(desc(lostPetReportsTable.createdAt), asc(petsTable.name));

    const response = await Promise.all(
      reports.map(({ report, petName, ...pet }) =>
        toReportResponse(report, { ...pet, name: petName }, profile.id),
      ),
    );
    res.setHeader("Cache-Control", "no-store");
    res.json(ListLostPetReportsResponse.parse(response));
  },
);

router.post(
  "/pets/:petId/lost-reports",
  requireAuth,
  requireRole("owner"),
  async (req, res): Promise<void> => {
    const params = CreateLostPetReportParams.safeParse(req.params);
    const parsed = CreateLostPetReportBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.message,
      });
      return;
    }

    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const now = new Date();
    const inputError = isValidInput(parsed.data, now);
    if (inputError) {
      res.status(400).json({ error: inputError });
      return;
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${params.data.petId})::bigint)`,
      );
      const [pet] = await tx
        .select()
        .from(petsTable)
        .where(
          and(
            eq(petsTable.id, params.data.petId),
            eq(petsTable.ownerId, profile.id),
          ),
        )
        .limit(1);
      if (!pet) {
        return { kind: "not_found" as const };
      }

      let previousPetStatus: "home" | "walking" =
        pet.status === "walking" ? "walking" : "home";
      const [existing] = await tx
        .select()
        .from(lostPetReportsTable)
        .where(
          and(
            eq(lostPetReportsTable.petId, pet.id),
            eq(lostPetReportsTable.status, "active"),
          ),
        )
        .limit(1);
      if (existing && existing.expiresAt > now) {
        return { kind: "conflict" as const };
      }
      if (existing) {
        previousPetStatus =
          existing.previousPetStatus === "walking" ? "walking" : "home";
        await tx
          .update(lostPetReportsTable)
          .set({ status: "expired", updatedAt: now })
          .where(eq(lostPetReportsTable.id, existing.id));
        await tx
          .update(petsTable)
          .set({ status: previousPetStatus, updatedAt: now })
          .where(
            and(
              eq(petsTable.id, pet.id),
              eq(petsTable.status, "lost"),
            ),
          );
      }

      const [report] = await tx
        .insert(lostPetReportsTable)
        .values({
          petId: pet.id,
          ownerId: profile.id,
          locationDescription: parsed.data.locationDescription.trim(),
          lastSeenAt: parsed.data.lastSeenAt,
          notes: parsed.data.notes?.trim() || null,
          consentedAt: now,
          expiresAt: new Date(now.getTime() + reportDurationMs),
          status: "active",
          previousPetStatus,
        })
        .returning();
      await tx
        .update(petsTable)
        .set({ status: "lost", updatedAt: now })
        .where(eq(petsTable.id, pet.id));
      return { kind: "created" as const, report, pet };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "No se encontró esa mascota en tu cuenta." });
      return;
    }
    if (result.kind === "conflict") {
      res.status(409).json({ error: "Esta mascota ya tiene un reporte activo." });
      return;
    }

    res
      .status(201)
      .json(
        CreateLostPetReportResponse.parse(
          await toReportResponse(result.report, result.pet, profile.id),
        ),
      );
  },
);

router.post(
  "/lost-pet-reports/:reportId/close",
  requireAuth,
  requireRole("owner"),
  async (req, res): Promise<void> => {
    const params = CloseLostPetReportParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(lostPetReportsTable)
        .where(
          and(
            eq(lostPetReportsTable.id, params.data.reportId),
            eq(lostPetReportsTable.ownerId, profile.id),
          ),
        )
        .limit(1);
      if (!existing) {
        return { kind: "not_found" as const };
      }
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${existing.petId})::bigint)`,
      );
      const [report] = await tx
        .update(lostPetReportsTable)
        .set({ status: "closed", closedAt: now, updatedAt: now })
        .where(
          and(
            eq(lostPetReportsTable.id, existing.id),
            eq(lostPetReportsTable.ownerId, profile.id),
            eq(lostPetReportsTable.status, "active"),
            gt(lostPetReportsTable.expiresAt, now),
          ),
        )
        .returning();
      if (!report) {
        return { kind: "inactive" as const };
      }
      const [pet] = await tx
        .update(petsTable)
        .set({ status: report.previousPetStatus, updatedAt: now })
        .where(eq(petsTable.id, report.petId))
        .returning();
      return { kind: "closed" as const, report, pet };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "No se encontró ese reporte en tu cuenta." });
      return;
    }
    if (result.kind === "inactive") {
      res.status(409).json({ error: "El reporte ya no está activo." });
      return;
    }

    res.json(
      CloseLostPetReportResponse.parse(
        await toReportResponse(result.report, result.pet, profile.id),
      ),
    );
  },
);

router.post(
  "/lost-pet-reports/:reportId/renew",
  requireAuth,
  requireRole("owner"),
  async (req, res): Promise<void> => {
    const params = RenewLostPetReportParams.safeParse(req.params);
    const parsed = RenewLostPetReportBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.message,
      });
      return;
    }

    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const now = new Date();
    const inputError = isValidInput(parsed.data, now);
    if (inputError) {
      res.status(400).json({ error: inputError });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(lostPetReportsTable)
        .where(
          and(
            eq(lostPetReportsTable.id, params.data.reportId),
            eq(lostPetReportsTable.ownerId, profile.id),
          ),
        )
        .limit(1);
      if (!existing) {
        return { kind: "not_found" as const };
      }
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${existing.petId})::bigint)`,
      );
      if (existing.status === "closed") {
        return { kind: "closed" as const };
      }

      const [otherActive] = await tx
        .select({ id: lostPetReportsTable.id })
        .from(lostPetReportsTable)
        .where(
          and(
            eq(lostPetReportsTable.petId, existing.petId),
            eq(lostPetReportsTable.status, "active"),
            gt(lostPetReportsTable.expiresAt, now),
          ),
        )
        .limit(1);
      if (otherActive && otherActive.id !== existing.id) {
        return { kind: "conflict" as const };
      }

      const [report] = await tx
        .update(lostPetReportsTable)
        .set({
          locationDescription: parsed.data.locationDescription.trim(),
          lastSeenAt: parsed.data.lastSeenAt,
          notes: parsed.data.notes?.trim() || null,
          consentedAt: now,
          expiresAt: new Date(now.getTime() + reportDurationMs),
          status: "active",
          closedAt: null,
          updatedAt: now,
        })
        .where(
          and(
            eq(lostPetReportsTable.id, existing.id),
            eq(lostPetReportsTable.ownerId, profile.id),
            inArray(lostPetReportsTable.status, ["active", "expired"]),
          ),
        )
        .returning();
      if (!report) {
        return { kind: "closed" as const };
      }

      const [pet] = await tx
        .update(petsTable)
        .set({ status: "lost", updatedAt: now })
        .where(eq(petsTable.id, report.petId))
        .returning();
      return { kind: "renewed" as const, report, pet };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "No se encontró ese reporte en tu cuenta." });
      return;
    }
    if (result.kind === "closed") {
      res.status(409).json({ error: "No se puede renovar un reporte cerrado." });
      return;
    }
    if (result.kind === "conflict") {
      res.status(409).json({ error: "Esta mascota ya tiene otro reporte activo." });
      return;
    }

    res.json(
      RenewLostPetReportResponse.parse(
        await toReportResponse(result.report, result.pet, profile.id),
      ),
    );
  },
);

export default router;
