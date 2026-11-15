import { and, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  GetNotificationPreferencesResponse,
  SaveNotificationPreferencesBody,
  SaveNotificationPreferencesResponse,
} from "@workspace/api-zod";
import { appointmentNotificationsTable, db, userProfilesTable } from "@workspace/db";
import {
  createOrSyncProfile,
  loadClerkIdentity,
  requireAuth,
} from "../middlewares/auth";

const router: IRouter = Router();

router.use("/me/notification-preferences", requireAuth);

async function getCurrentProfile(clerkUserId: string) {
  const identity = await loadClerkIdentity(clerkUserId);
  if (!identity) {
    return null;
  }
  return createOrSyncProfile(identity);
}

router.get(
  "/me/notification-preferences",
  async (req, res): Promise<void> => {
    const clerkUserId = req.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Se requiere iniciar sesión." });
      return;
    }

    const profile = await getCurrentProfile(clerkUserId);
    if (!profile) {
      res.status(422).json({ error: "La cuenta no tiene un correo principal." });
      return;
    }

    res.json(
      GetNotificationPreferencesResponse.parse({
        phoneNumber: profile.phoneNumber,
        whatsappOptIn: profile.whatsappOptIn,
        updatedAt: profile.updatedAt,
      }),
    );
  },
);

router.put(
  "/me/notification-preferences",
  async (req, res): Promise<void> => {
    const parsed = SaveNotificationPreferencesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (parsed.data.whatsappOptIn && !parsed.data.phoneNumber) {
      res.status(400).json({
        error: "Agrega un teléfono antes de aceptar notificaciones por WhatsApp.",
      });
      return;
    }

    const clerkUserId = req.clerkUserId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Se requiere iniciar sesión." });
      return;
    }

    const profile = await getCurrentProfile(clerkUserId);
    if (!profile) {
      res.status(422).json({ error: "La cuenta no tiene un correo principal." });
      return;
    }

    const now = new Date();
    const phoneNumber = parsed.data.phoneNumber?.trim() || null;
    const [updatedProfile] = await db
      .update(userProfilesTable)
      .set({
        phoneNumber,
        whatsappOptIn: parsed.data.whatsappOptIn,
        whatsappOptInAt: parsed.data.whatsappOptIn ? now : null,
        updatedAt: now,
      })
      .where(eq(userProfilesTable.id, profile.id))
      .returning();

    if (!parsed.data.whatsappOptIn || profile.phoneNumber !== phoneNumber) {
      await db
        .update(appointmentNotificationsTable)
        .set({
          status: "cancelled",
          lastError: "Consent revoked.",
          updatedAt: now,
        })
        .where(
          and(
            eq(appointmentNotificationsTable.recipientProfileId, profile.id),
            eq(appointmentNotificationsTable.channel, "whatsapp"),
            inArray(appointmentNotificationsTable.status, ["pending", "deferred"]),
          ),
        );
    }

    res.json(
      SaveNotificationPreferencesResponse.parse({
        phoneNumber: updatedProfile.phoneNumber,
        whatsappOptIn: updatedProfile.whatsappOptIn,
        updatedAt: updatedProfile.updatedAt,
      }),
    );
  },
);

export default router;
