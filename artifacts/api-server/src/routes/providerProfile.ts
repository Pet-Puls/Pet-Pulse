import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetProviderProfileResponse,
  SaveProviderProfileBody,
  SaveProviderProfileResponse,
} from "@workspace/api-zod";
import { db, providerProfilesTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

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
