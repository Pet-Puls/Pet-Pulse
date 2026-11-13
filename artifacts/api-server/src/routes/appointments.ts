import { and, asc, eq, gt, inArray, lt, ne, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ActOnAppointmentBody,
  ActOnAppointmentParams,
  ActOnAppointmentResponse,
  ListAppointmentsResponse,
  RequestAppointmentBody,
  RequestAppointmentResponse,
} from "@workspace/api-zod";
import {
  appointmentNotificationsTable,
  appointmentsTable,
  db,
  petsTable,
  providerAvailabilityTable,
  providerProfilesTable,
  providerServicesTable,
  userProfilesTable,
  type AppointmentRecord,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import {
  isWithinProviderAvailability,
  localDateTimeToInstant,
  type ProviderSchedule,
} from "./appointmentScheduling";

const router: IRouter = Router();

const reservingStatuses = ["pending", "confirmed", "reschedule_pending"] as const;

router.use("/appointments", requireAuth);

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasInvalidDateOnly(body: unknown): boolean {
  return (
    body !== null &&
    typeof body === "object" &&
    "date" in body &&
    typeof body.date === "string" &&
    !isValidDateOnly(body.date)
  );
}

function getDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function overlapsActiveAppointment(startsAt: Date, endsAt: Date) {
  return or(
    and(
      lt(appointmentsTable.startsAt, endsAt),
      gt(appointmentsTable.endsAt, startsAt),
    ),
    and(
      eq(appointmentsTable.status, "reschedule_pending"),
      lt(appointmentsTable.proposedStartsAt, endsAt),
      gt(appointmentsTable.proposedEndsAt, startsAt),
    ),
  );
}

async function findConflictingAppointment(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  providerProfileId: string,
  startsAt: Date,
  endsAt: Date,
  excludeAppointmentId?: string,
) {
  const [conflict] = await tx
    .select({ id: appointmentsTable.id })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.providerProfileId, providerProfileId),
        inArray(appointmentsTable.status, [...reservingStatuses]),
        overlapsActiveAppointment(startsAt, endsAt),
        excludeAppointmentId
          ? ne(appointmentsTable.id, excludeAppointmentId)
          : undefined,
      ),
    )
    .limit(1);
  return conflict;
}

function notificationRows(
  appointmentId: string,
  recipients: Array<{
    id: string;
    email: string;
    emailVerified: boolean;
    phoneNumber: string | null;
    whatsappOptIn: boolean;
  }>,
  subject: string,
  message: string,
) {
  return recipients.flatMap((recipient) => {
    const rows = [];
    if (recipient.emailVerified) {
      rows.push({
        appointmentId,
        recipientProfileId: recipient.id,
        channel: "email" as const,
        destination: recipient.email,
        subject,
        message,
      });
    }
    if (recipient.whatsappOptIn && recipient.phoneNumber) {
      rows.push({
        appointmentId,
        recipientProfileId: recipient.id,
        channel: "whatsapp" as const,
        destination: recipient.phoneNumber,
        subject: null,
        message,
        status: "deferred" as const,
      });
    }
    return rows;
  });
}

function appointmentTime(appointment: Pick<AppointmentRecord, "startsAt" | "timezone">) {
  return appointment.startsAt.toLocaleString("es-CO", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: appointment.timezone,
  });
}

async function enqueueNotifications(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  appointment: AppointmentRecord,
  recipientIds: string[],
  subject: string,
  message: string,
): Promise<void> {
  const recipients = await tx
    .select({
      id: userProfilesTable.id,
      email: userProfilesTable.email,
      emailVerified: userProfilesTable.emailVerified,
      phoneNumber: userProfilesTable.phoneNumber,
      whatsappOptIn: userProfilesTable.whatsappOptIn,
    })
    .from(userProfilesTable)
    .where(inArray(userProfilesTable.id, recipientIds));
  const rows = notificationRows(appointment.id, recipients, subject, message);
  if (rows.length > 0) {
    await tx.insert(appointmentNotificationsTable).values(rows);
  }
}

async function loadSchedule(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  providerProfileId: string,
): Promise<ProviderSchedule> {
  const [availability] = await tx
    .select()
    .from(providerAvailabilityTable)
    .where(eq(providerAvailabilityTable.providerProfileId, providerProfileId))
    .limit(1);
  return {
    timezone: availability?.timezone ?? "America/Bogota",
    weeklyWindows: availability?.weeklyWindows ?? [],
    exceptions: availability?.exceptions ?? [],
  };
}

router.get(
  "/appointments",
  requireRole("owner", "provider"),
  async (req, res): Promise<void> => {
    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    if (req.petPulseRole === "provider") {
      const [provider] = await db
        .select({ id: providerProfilesTable.id })
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.userId, profile.id))
        .limit(1);
      if (!provider) {
        res.json([]);
        return;
      }

      const appointments = await db
        .select()
        .from(appointmentsTable)
        .where(eq(appointmentsTable.providerProfileId, provider.id))
        .orderBy(asc(appointmentsTable.startsAt), asc(appointmentsTable.createdAt));
      res.json(ListAppointmentsResponse.parse(appointments));
      return;
    }

    const appointments = await db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.ownerId, profile.id))
      .orderBy(asc(appointmentsTable.startsAt), asc(appointmentsTable.createdAt));
    res.json(ListAppointmentsResponse.parse(appointments));
  },
);

router.post(
  "/appointments",
  requireRole("owner"),
  async (req, res): Promise<void> => {
    if (hasInvalidDateOnly(req.body)) {
      res.status(400).json({ error: "La fecha debe ser válida y usar el formato AAAA-MM-DD." });
      return;
    }
    const parsed = RequestAppointmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const owner = req.petPulseProfile;
    if (!owner) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${parsed.data.providerId})::bigint)`,
      );
      const [provider] = await tx
        .select()
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.id, parsed.data.providerId))
        .limit(1);
      if (!provider || provider.approvalStatus !== "approved") {
        return { kind: "not_found" as const };
      }

      const [service] = await tx
        .select()
        .from(providerServicesTable)
        .where(
          and(
            eq(providerServicesTable.id, parsed.data.serviceId),
            eq(providerServicesTable.providerProfileId, provider.id),
            eq(providerServicesTable.isActive, true),
          ),
        )
        .limit(1);
      const [pet] = await tx
        .select()
        .from(petsTable)
        .where(
          and(
            eq(petsTable.id, parsed.data.petId),
            eq(petsTable.ownerId, owner.id),
          ),
        )
        .limit(1);
      if (!service || !pet) {
        return { kind: "not_found" as const };
      }

      const schedule = await loadSchedule(tx, provider.id);
      const startsAt = localDateTimeToInstant(
        getDateOnly(parsed.data.date),
        parsed.data.time,
        schedule.timezone,
      );
      if (!startsAt) {
        return { kind: "invalid_time" as const };
      }
      if (startsAt <= new Date() || !isWithinProviderAvailability(
        schedule,
        startsAt,
        service.durationMinutes,
      )) {
        return { kind: "unavailable" as const };
      }
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
      if (await findConflictingAppointment(tx, provider.id, startsAt, endsAt)) {
        return { kind: "conflict" as const };
      }

      const [appointment] = await tx
        .insert(appointmentsTable)
        .values({
          ownerId: owner.id,
          providerProfileId: provider.id,
          serviceId: service.id,
          petId: pet.id,
          providerName: provider.name,
          serviceName: service.name,
          petName: pet.name,
          durationMinutes: service.durationMinutes,
          priceCop: service.priceCop,
          timezone: schedule.timezone,
          startsAt,
          endsAt,
          status: "pending",
        })
        .returning();
      const time = appointmentTime(appointment);
      await enqueueNotifications(
        tx,
        appointment,
        [owner.id, provider.userId],
        "Nueva solicitud de cita",
        `Se solicitó una cita para ${appointment.petName} con ${appointment.providerName} (${appointment.serviceName}) el ${time}. La solicitud está pendiente de confirmación.`,
      );
      return { kind: "created" as const, appointment };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "No se encontró la mascota, el servicio o el proveedor aprobado." });
      return;
    }
    if (result.kind === "invalid_time") {
      res.status(400).json({ error: "La hora local no existe en la zona horaria del proveedor." });
      return;
    }
    if (result.kind === "unavailable") {
      res.status(400).json({ error: "El horario solicitado está fuera de la disponibilidad del proveedor." });
      return;
    }
    if (result.kind === "conflict") {
      res.status(409).json({ error: "El proveedor ya tiene una cita en ese horario." });
      return;
    }
    res.status(201).json(RequestAppointmentResponse.parse(result.appointment));
  },
);

router.post(
  "/appointments/:appointmentId/actions",
  requireRole("owner", "provider"),
  async (req, res): Promise<void> => {
    if (hasInvalidDateOnly(req.body)) {
      res.status(400).json({ error: "La fecha debe ser válida y usar el formato AAAA-MM-DD." });
      return;
    }
    const parsedParams = ActOnAppointmentParams.safeParse(req.params);
    const parsedBody = ActOnAppointmentBody.safeParse(req.body);
    if (!parsedParams.success) {
      res.status(400).json({ error: parsedParams.error.message });
      return;
    }
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.message });
      return;
    }
    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const action = parsedBody.data.action;
    if (
      action === "propose_reschedule" &&
      (!parsedBody.data.date || !parsedBody.data.time)
    ) {
      res.status(400).json({ error: "Indica la fecha y hora propuestas." });
      return;
    }
    const [existing] = await db
      .select({ providerProfileId: appointmentsTable.providerProfileId })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, parsedParams.data.appointmentId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "No se encontró la cita." });
      return;
    }

    const outcome = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${existing.providerProfileId})::bigint)`,
      );
      const [appointment] = await tx
        .select()
        .from(appointmentsTable)
        .where(eq(appointmentsTable.id, parsedParams.data.appointmentId))
        .limit(1);
      const [provider] = await tx
        .select()
        .from(providerProfilesTable)
        .where(eq(providerProfilesTable.id, existing.providerProfileId))
        .limit(1);
      if (!appointment || !provider) {
        return { kind: "not_found" as const };
      }

      const isOwner = appointment.ownerId === profile.id;
      const isProvider = provider.userId === profile.id;
      if (!isOwner && !isProvider) {
        return { kind: "forbidden" as const };
      }
      const now = new Date();
      let updates: Partial<typeof appointmentsTable.$inferInsert> = {
        updatedAt: now,
      };
      let message: string;
      let newStartsAt: Date | null = null;
      let newEndsAt: Date | null = null;

      if (action === "confirm" || action === "decline") {
        if (
          !isProvider ||
          appointment.status !== "pending" ||
          (action === "confirm" && appointment.startsAt <= now)
        ) {
          return { kind: "invalid_state" as const };
        }
        updates.status = action === "confirm" ? "confirmed" : "declined";
        message =
          action === "confirm"
            ? `La cita de ${appointment.petName} con ${appointment.providerName} para el ${appointmentTime(appointment)} fue confirmada.`
            : `La solicitud de cita para ${appointment.petName} con ${appointment.providerName} fue rechazada.`;
      } else if (action === "cancel") {
        if (
          !["pending", "confirmed", "reschedule_pending"].includes(appointment.status) ||
          appointment.startsAt <= now
        ) {
          return { kind: "invalid_state" as const };
        }
        updates.status = "cancelled";
        updates.previousStatus = null;
        updates.proposedStartsAt = null;
        updates.proposedEndsAt = null;
        message = `La cita de ${appointment.petName} con ${appointment.providerName} para el ${appointmentTime(appointment)} fue cancelada.`;
      } else if (action === "propose_reschedule") {
        if (
          !isProvider ||
          !["pending", "confirmed"].includes(appointment.status) ||
          !parsedBody.data.date ||
          !parsedBody.data.time
        ) {
          return { kind: "invalid_state" as const };
        }
        const schedule = await loadSchedule(tx, provider.id);
        newStartsAt = localDateTimeToInstant(
          getDateOnly(parsedBody.data.date),
          parsedBody.data.time,
          schedule.timezone,
        );
        if (!newStartsAt) {
          return { kind: "invalid_time" as const };
        }
        if (
          newStartsAt <= now ||
          !isWithinProviderAvailability(schedule, newStartsAt, appointment.durationMinutes)
        ) {
          return { kind: "unavailable" as const };
        }
        newEndsAt = new Date(
          newStartsAt.getTime() + appointment.durationMinutes * 60_000,
        );
        if (
          newStartsAt.getTime() === appointment.startsAt.getTime() ||
          await findConflictingAppointment(
            tx,
            provider.id,
            newStartsAt,
            newEndsAt,
            appointment.id,
          )
        ) {
          return { kind: "conflict" as const };
        }
        updates.status = "reschedule_pending";
        updates.previousStatus = appointment.status;
        updates.proposedStartsAt = newStartsAt;
        updates.proposedEndsAt = newEndsAt;
        message = `El proveedor propuso cambiar la cita de ${appointment.petName} a ${newStartsAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: schedule.timezone })}. Acepta o rechaza el nuevo horario.`;
      } else if (action === "accept_reschedule") {
        if (
          !isOwner ||
          appointment.status !== "reschedule_pending" ||
          !appointment.proposedStartsAt ||
          !appointment.proposedEndsAt
        ) {
          return { kind: "invalid_state" as const };
        }
        const schedule = await loadSchedule(tx, provider.id);
        if (
          appointment.proposedStartsAt <= now ||
          !isWithinProviderAvailability(
            schedule,
            appointment.proposedStartsAt,
            appointment.durationMinutes,
          )
        ) {
          return { kind: "unavailable" as const };
        }
        if (
          await findConflictingAppointment(
            tx,
            provider.id,
            appointment.proposedStartsAt,
            appointment.proposedEndsAt,
            appointment.id,
          )
        ) {
          return { kind: "conflict" as const };
        }
        updates.startsAt = appointment.proposedStartsAt;
        updates.endsAt = appointment.proposedEndsAt;
        updates.proposedStartsAt = null;
        updates.proposedEndsAt = null;
        updates.previousStatus = null;
        updates.status = "confirmed";
        message = `La nueva hora para la cita de ${appointment.petName} fue aceptada: ${appointment.proposedStartsAt.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: schedule.timezone })}.`;
      } else {
        if (!isOwner || appointment.status !== "reschedule_pending") {
          return { kind: "invalid_state" as const };
        }
        updates.status = appointment.previousStatus ?? "confirmed";
        updates.previousStatus = null;
        updates.proposedStartsAt = null;
        updates.proposedEndsAt = null;
        message = `La propuesta de cambio de horario para la cita de ${appointment.petName} fue rechazada.`;
      }

      const [updatedAppointment] = await tx
        .update(appointmentsTable)
        .set(updates)
        .where(eq(appointmentsTable.id, appointment.id))
        .returning();
      const recipientProfileId = isOwner ? provider.userId : appointment.ownerId;
      await enqueueNotifications(
        tx,
        updatedAppointment,
        [recipientProfileId],
        "Actualización de cita",
        message,
      );
      return { kind: "updated" as const, appointment: updatedAppointment };
    });

    if (outcome.kind === "not_found") {
      res.status(404).json({ error: "No se encontró la cita." });
      return;
    }
    if (outcome.kind === "forbidden") {
      res.status(403).json({ error: "No participas en esta cita." });
      return;
    }
    if (outcome.kind === "invalid_time") {
      res.status(400).json({ error: "La hora local no existe en la zona horaria del proveedor." });
      return;
    }
    if (outcome.kind === "unavailable") {
      res.status(400).json({ error: "El horario propuesto no está disponible." });
      return;
    }
    if (outcome.kind === "conflict") {
      res.status(409).json({ error: "El proveedor ya tiene una cita en ese horario." });
      return;
    }
    if (outcome.kind === "invalid_state") {
      res.status(400).json({ error: "La acción no está permitida en el estado actual de la cita." });
      return;
    }
    res.json(ActOnAppointmentResponse.parse(outcome.appointment));
  },
);

export default router;
