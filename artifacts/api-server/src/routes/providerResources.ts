import { and, asc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ArchiveProviderServiceParams,
  ArchiveProviderServiceResponse,
  CreateProviderServiceBody,
  CreateProviderServiceResponse,
  GetProviderAvailabilityResponse,
  ListProviderServicesResponse,
  SaveProviderAvailabilityBody,
  UpdateProviderServiceBody,
  UpdateProviderServiceParams,
  UpdateProviderServiceResponse,
} from "@workspace/api-zod";
import {
  db,
  providerAvailabilityTable,
  providerProfilesTable,
  providerServicesTable,
  type AvailabilityException,
  type InsertProviderServiceRecord,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.use("/provider-profile", requireAuth);

async function findCurrentProviderProfileId(userProfileId: string) {
  const [provider] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userProfileId))
    .limit(1);
  return provider?.id;
}

function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasInvalidDateOnlys(body: unknown): boolean {
  if (!body || typeof body !== "object" || !("exceptions" in body)) {
    return false;
  }
  const exceptions = body.exceptions;
  return Array.isArray(exceptions) &&
    exceptions.some(
      (exception) =>
        !exception ||
        typeof exception !== "object" ||
        !("date" in exception) ||
        !isValidDateOnly(exception.date),
    );
}

function hasValidWindows(
  windows: Array<{ startTime: string; endTime: string }>,
): boolean {
  const sorted = [...windows].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return sorted.every(
    (window, index) =>
      window.startTime < window.endTime &&
      (index === 0 || sorted[index - 1].endTime <= window.startTime),
  );
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function availabilityResponse(value: {
  timezone: string;
  weeklyWindows: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  exceptions: AvailabilityException[];
}) {
  const parsed = GetProviderAvailabilityResponse.parse(value);
  return {
    ...parsed,
    exceptions: parsed.exceptions.map((exception) => ({
      ...exception,
      date: exception.date.toISOString().slice(0, 10),
    })),
  };
}

router.get(
  "/provider-profile/services",
  requireRole("provider"),
  async (req, res): Promise<void> => {
    const userProfileId = req.petPulseProfile?.id;
    if (!userProfileId) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }
    const providerProfileId = await findCurrentProviderProfileId(userProfileId);
    if (!providerProfileId) {
      res.status(404).json({ error: "Primero guarda tu perfil comercial." });
      return;
    }

    const services = await db
      .select()
      .from(providerServicesTable)
      .where(eq(providerServicesTable.providerProfileId, providerProfileId))
      .orderBy(asc(providerServicesTable.createdAt), asc(providerServicesTable.id));
    res.json(ListProviderServicesResponse.parse(services));
  },
);

router.post(
  "/provider-profile/services",
  requireRole("provider"),
  async (req, res): Promise<void> => {
    const parsed = CreateProviderServiceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const name = parsed.data.name.trim();
    if (!name) {
      res.status(400).json({ error: "El nombre del servicio es obligatorio." });
      return;
    }

    const userProfileId = req.petPulseProfile?.id;
    if (!userProfileId) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }
    const providerProfileId = await findCurrentProviderProfileId(userProfileId);
    if (!providerProfileId) {
      res.status(404).json({ error: "Primero guarda tu perfil comercial." });
      return;
    }

    const [service] = await db
      .insert(providerServicesTable)
      .values({
        providerProfileId,
        name,
        description: parsed.data.description?.trim() || null,
        durationMinutes: parsed.data.durationMinutes,
        priceCop: parsed.data.priceCop ?? null,
      })
      .returning();
    res.status(201).json(CreateProviderServiceResponse.parse(service));
  },
);

router.patch(
  "/provider-profile/services/:serviceId",
  requireRole("provider"),
  async (req, res): Promise<void> => {
    const parsedParams = UpdateProviderServiceParams.safeParse(req.params);
    const parsedBody = UpdateProviderServiceBody.safeParse(req.body);
    if (!parsedParams.success) {
      res.status(400).json({ error: parsedParams.error.message });
      return;
    }
    if (!parsedBody.success) {
      res.status(400).json({ error: parsedBody.error.message });
      return;
    }
    if (Object.keys(parsedBody.data).length === 0) {
      res.status(400).json({ error: "Indica al menos un campo para actualizar." });
      return;
    }

    const userProfileId = req.petPulseProfile?.id;
    if (!userProfileId) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }
    const providerProfileId = await findCurrentProviderProfileId(userProfileId);
    if (!providerProfileId) {
      res.status(404).json({ error: "Primero guarda tu perfil comercial." });
      return;
    }

    const values: Partial<InsertProviderServiceRecord> = {
      updatedAt: new Date(),
    };
    if (parsedBody.data.name !== undefined) {
      const name = parsedBody.data.name.trim();
      if (!name) {
        res.status(400).json({ error: "El nombre del servicio es obligatorio." });
        return;
      }
      values.name = name;
    }
    if (parsedBody.data.description !== undefined) {
      values.description = parsedBody.data.description?.trim() || null;
    }
    if (parsedBody.data.durationMinutes !== undefined) {
      values.durationMinutes = parsedBody.data.durationMinutes;
    }
    if (parsedBody.data.priceCop !== undefined) {
      values.priceCop = parsedBody.data.priceCop;
    }
    if (parsedBody.data.isActive !== undefined) {
      values.isActive = parsedBody.data.isActive;
    }

    const [service] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${providerProfileId})::bigint)`,
      );
      return tx
        .update(providerServicesTable)
        .set(values)
        .where(
          and(
            eq(providerServicesTable.id, parsedParams.data.serviceId),
            eq(providerServicesTable.providerProfileId, providerProfileId),
          ),
        )
        .returning();
    });
    if (!service) {
      res.status(404).json({ error: "No se encontró ese servicio en tu perfil." });
      return;
    }
    res.json(UpdateProviderServiceResponse.parse(service));
  },
);

router.delete(
  "/provider-profile/services/:serviceId",
  requireRole("provider"),
  async (req, res): Promise<void> => {
    const parsedParams = ArchiveProviderServiceParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: parsedParams.error.message });
      return;
    }
    const userProfileId = req.petPulseProfile?.id;
    if (!userProfileId) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }
    const providerProfileId = await findCurrentProviderProfileId(userProfileId);
    if (!providerProfileId) {
      res.status(404).json({ error: "Primero guarda tu perfil comercial." });
      return;
    }

    const [service] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${providerProfileId})::bigint)`,
      );
      return tx
        .update(providerServicesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(providerServicesTable.id, parsedParams.data.serviceId),
            eq(providerServicesTable.providerProfileId, providerProfileId),
          ),
        )
        .returning();
    });
    if (!service) {
      res.status(404).json({ error: "No se encontró ese servicio en tu perfil." });
      return;
    }
    res.json(ArchiveProviderServiceResponse.parse(service));
  },
);

router.get(
  "/provider-profile/availability",
  requireRole("provider"),
  async (req, res): Promise<void> => {
    const userProfileId = req.petPulseProfile?.id;
    if (!userProfileId) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }
    const providerProfileId = await findCurrentProviderProfileId(userProfileId);
    if (!providerProfileId) {
      res.status(404).json({ error: "Primero guarda tu perfil comercial." });
      return;
    }
    const [availability] = await db
      .select()
      .from(providerAvailabilityTable)
      .where(eq(providerAvailabilityTable.providerProfileId, providerProfileId))
      .limit(1);

    res.json(
      availabilityResponse({
        timezone: availability?.timezone ?? "America/Bogota",
        weeklyWindows: availability?.weeklyWindows ?? [],
        exceptions: availability?.exceptions ?? [],
      }),
    );
  },
);

router.put(
  "/provider-profile/availability",
  requireRole("provider"),
  async (req, res): Promise<void> => {
    if (hasInvalidDateOnlys(req.body)) {
      res.status(400).json({ error: "Cada excepción debe usar una fecha válida (AAAA-MM-DD)." });
      return;
    }
    const parsed = SaveProviderAvailabilityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { timezone, weeklyWindows } = parsed.data;
    const exceptions = parsed.data.exceptions.map((exception) => ({
      ...exception,
      date: exception.date.toISOString().slice(0, 10),
    }));

    const weeklyByDay = new Map<number, Array<{ startTime: string; endTime: string }>>();
    for (const window of weeklyWindows) {
      const windows = weeklyByDay.get(window.dayOfWeek) ?? [];
      windows.push(window);
      weeklyByDay.set(window.dayOfWeek, windows);
    }
    const invalidWeeklyWindows = [...weeklyByDay.values()].some(
      (windows) => !hasValidWindows(windows),
    );
    const exceptionDates = new Set<string>();
    const invalidExceptions = exceptions.some((exception) => {
      if (
        exceptionDates.has(exception.date) ||
        (exception.isClosed && exception.windows.length > 0) ||
        (!exception.isClosed && exception.windows.length === 0) ||
        !hasValidWindows(exception.windows)
      ) {
        return true;
      }
      exceptionDates.add(exception.date);
      return false;
    });
    if (!isValidTimezone(timezone)) {
      res.status(400).json({ error: "Indica una zona horaria IANA válida." });
      return;
    }
    if (invalidWeeklyWindows || invalidExceptions) {
      res.status(400).json({
        error: "Los horarios deben ser válidos, no superponerse y tener excepciones coherentes.",
      });
      return;
    }

    const userProfileId = req.petPulseProfile?.id;
    if (!userProfileId) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }
    const providerProfileId = await findCurrentProviderProfileId(userProfileId);
    if (!providerProfileId) {
      res.status(404).json({ error: "Primero guarda tu perfil comercial." });
      return;
    }

    const [availability] = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${providerProfileId})::bigint)`,
      );
      return tx
        .insert(providerAvailabilityTable)
        .values({ providerProfileId, timezone, weeklyWindows, exceptions })
        .onConflictDoUpdate({
          target: providerAvailabilityTable.providerProfileId,
          set: {
            timezone,
            weeklyWindows,
            exceptions,
            updatedAt: new Date(),
          },
        })
        .returning();
    });
    res.json(availabilityResponse(availability));
  },
);

export default router;
