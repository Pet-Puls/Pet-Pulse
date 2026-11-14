import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CompleteOnboardingBody,
  CompleteOnboardingResponse,
  GetMeResponse,
} from "@workspace/api-zod";
import { db, providerProfilesTable, userProfilesTable } from "@workspace/db";
import {
  createOrSyncProfile,
  isConfiguredAdmin,
  loadClerkIdentity,
  requireAuth,
} from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = req.clerkUserId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Se requiere iniciar sesión." });
    return;
  }

  const identity = await loadClerkIdentity(clerkUserId);
  if (!identity) {
    res.status(422).json({ error: "La cuenta no tiene un correo principal." });
    return;
  }

  const profile = await createOrSyncProfile(identity);
  const isAdmin = isConfiguredAdmin(identity.email, identity.emailVerified);
  const [provider] = await db
    .select({ approvalStatus: providerProfilesTable.approvalStatus })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, profile.id))
    .limit(1);

  const response = GetMeResponse.parse({
    id: profile.id,
    email: identity.email,
    displayName: profile.displayName,
    role: isAdmin ? "admin" : profile.role,
    onboardingCompleted: isAdmin || profile.onboardingCompleted,
    providerStatus:
      profile.role === "provider" ? provider?.approvalStatus ?? "none" : "none",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  });

  res.json(response);
});

router.put("/me/onboarding", requireAuth, async (req, res): Promise<void> => {
  const parsed = CompleteOnboardingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.displayName.trim()) {
    res.status(400).json({ error: "El nombre es obligatorio." });
    return;
  }

  const clerkUserId = req.clerkUserId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Se requiere iniciar sesión." });
    return;
  }

  const identity = await loadClerkIdentity(clerkUserId);
  if (!identity) {
    res.status(422).json({ error: "La cuenta no tiene un correo principal." });
    return;
  }

  const profile = await createOrSyncProfile(identity);
  if (profile.onboardingCompleted) {
    res.status(400).json({ error: "La configuración inicial ya fue completada." });
    return;
  }

  await db
    .update(userProfilesTable)
    .set({
      displayName: parsed.data.displayName.trim(),
      role: parsed.data.requestedRole,
      onboardingCompleted: true,
    })
    .where(
      and(
        eq(userProfilesTable.id, profile.id),
        eq(userProfilesTable.clerkUserId, clerkUserId),
        eq(userProfilesTable.onboardingCompleted, false),
      ),
    );

  const [updatedProfile] = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.id, profile.id))
    .limit(1);

  const isAdmin = isConfiguredAdmin(identity.email, identity.emailVerified);
  const result = CompleteOnboardingResponse.parse({
    id: updatedProfile.id,
    email: identity.email,
    displayName: updatedProfile.displayName,
    role: isAdmin ? "admin" : updatedProfile.role,
    onboardingCompleted: true,
    providerStatus: "none",
    createdAt: updatedProfile.createdAt,
    updatedAt: updatedProfile.updatedAt,
  });

  res.json(result);
});

export default router;
