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

    const [provider] = await db
      .update(providerProfilesTable)
      .set({
        approvalStatus: parsed.data.approvalStatus,
        approvedAt:
          parsed.data.approvalStatus === "approved" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(providerProfilesTable.id, params.data.providerId))
      .returning();

    if (!provider) {
      res.status(404).json({ error: "No se encontró ese perfil de proveedor." });
      return;
    }

    res.json(UpdateProviderApprovalResponse.parse(provider));
  },
);

export default router;
