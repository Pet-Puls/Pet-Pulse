import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Column = { name: string };
type Condition =
  | { kind: "eq" | "ne" | "lt" | "gt"; column: Column; value: unknown }
  | { kind: "in"; column: Column; values: unknown[] }
  | { kind: "and" | "or"; conditions: Array<Condition | undefined> };

const mocks = vi.hoisted(() => {
  const profiles: Row[] = [];
  const providers: Row[] = [];
  const services: Row[] = [];
  const pets: Row[] = [];
  const availability: Row[] = [];
  const appointments: Row[] = [];
  const notifications: Row[] = [];
  const tables = {
    userProfilesTable: {
      tableName: "petpulse_user_profiles",
      id: { name: "id" },
      clerkUserId: { name: "clerkUserId" },
      email: { name: "email" },
      emailVerified: { name: "emailVerified" },
      phoneNumber: { name: "phoneNumber" },
      whatsappOptIn: { name: "whatsappOptIn" },
    },
    providerProfilesTable: {
      tableName: "petpulse_provider_profiles",
      id: { name: "id" },
      userId: { name: "userId" },
    },
    providerServicesTable: {
      tableName: "petpulse_provider_services",
      id: { name: "id" },
      providerProfileId: { name: "providerProfileId" },
      isActive: { name: "isActive" },
    },
    petsTable: {
      tableName: "petpulse_pets",
      id: { name: "id" },
      ownerId: { name: "ownerId" },
    },
    providerAvailabilityTable: {
      tableName: "petpulse_provider_availability",
      providerProfileId: { name: "providerProfileId" },
    },
    appointmentsTable: {
      tableName: "petpulse_appointments",
      id: { name: "id" },
      ownerId: { name: "ownerId" },
      providerProfileId: { name: "providerProfileId" },
      startsAt: { name: "startsAt" },
      endsAt: { name: "endsAt" },
      proposedStartsAt: { name: "proposedStartsAt" },
      proposedEndsAt: { name: "proposedEndsAt" },
      status: { name: "status" },
    },
    appointmentNotificationsTable: {
      tableName: "petpulse_appointment_notifications",
      id: { name: "id" },
      recipientProfileId: { name: "recipientProfileId" },
    },
  };
  let nextId = 100;

  function rowsFor(tableName: string): Row[] {
    switch (tableName) {
      case tables.userProfilesTable.tableName: return profiles;
      case tables.providerProfilesTable.tableName: return providers;
      case tables.providerServicesTable.tableName: return services;
      case tables.petsTable.tableName: return pets;
      case tables.providerAvailabilityTable.tableName: return availability;
      case tables.appointmentsTable.tableName: return appointments;
      default: return notifications;
    }
  }

  function matches(condition: Condition | undefined, row: Row): boolean {
    if (!condition) return true;
    if (condition.kind === "and") {
      return condition.conditions.every(item => matches(item, row));
    }
    if (condition.kind === "or") {
      return condition.conditions.some(item => matches(item, row));
    }
    const actual = row[condition.column.name];
    if (condition.kind === "in") return condition.values.includes(actual);
    if (condition.kind === "eq") return actual === condition.value;
    if (condition.kind === "ne") return actual !== condition.value;
    if (actual === null || actual === undefined) return false;
    if (condition.kind === "lt") return actual < (condition.value as never);
    return actual > (condition.value as never);
  }

  function query(selection?: Record<string, Column>) {
    let rows: Row[] = [];
    let condition: Condition | undefined;
    const builder = {
      from(table: { tableName: string }) {
        rows = rowsFor(table.tableName);
        return builder;
      },
      where(value: Condition) {
        condition = value;
        return builder;
      },
      orderBy() {
        return builder;
      },
      limit(limit: number) {
        return Promise.resolve(filteredRows().slice(0, limit));
      },
      then(resolve: (value: Row[]) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve(filteredRows()).then(resolve, reject);
      },
    };
    function filteredRows() {
      const result = rows.filter(row => matches(condition, row));
      return selection
        ? result.map(row => Object.fromEntries(
          Object.entries(selection).map(([key, column]) => [key, row[column.name]]),
        ))
        : result.map(row => ({ ...row }));
    }
    return builder;
  }

  function insert(table: { tableName: string }) {
    let values: Row | Row[] = {};
    let insertedRows: Row[] | null = null;
    function persist() {
      if (insertedRows) return insertedRows;
      insertedRows = (Array.isArray(values) ? values : [values]).map(value => {
        const row = {
          id: `550e8400-e29b-41d4-a716-${String(nextId++).padStart(12, "0")}`,
          createdAt: new Date("2099-01-01T00:00:00.000Z"),
          updatedAt: new Date("2099-01-01T00:00:00.000Z"),
          status: "pending",
          attempts: 0,
          proposedStartsAt: null,
          proposedEndsAt: null,
          priceCop: null,
          ...value,
        };
        rowsFor(table.tableName).push(row);
        return row;
      });
      return insertedRows;
    }
    const builder = {
      values(input: Row | Row[]) {
        values = input;
        return builder;
      },
      returning: async () => persist(),
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        persist();
        return Promise.resolve().then(() => resolve(undefined), reject);
      },
    };
    return builder;
  }

  function update(table: { tableName: string }) {
    let values: Row = {};
    let condition: Condition | undefined;
    return {
      set(value: Row) {
        values = value;
        return this;
      },
      where(value: Condition) {
        condition = value;
        return this;
      },
      returning: async () => {
        const row = rowsFor(table.tableName).find(item => matches(condition, item));
        if (!row) return [];
        Object.assign(row, values);
        return [row];
      },
    };
  }

  return {
    ...tables,
    profiles,
    providers,
    services,
    pets,
    availability,
    appointments,
    notifications,
    query,
    insert,
    update,
    reset() {
      profiles.length = 0;
      providers.length = 0;
      services.length = 0;
      pets.length = 0;
      availability.length = 0;
      appointments.length = 0;
      notifications.length = 0;
      nextId = 100;
    },
  };
});

vi.mock("@clerk/express", () => ({
  clerkClient: { users: { getUser: vi.fn() } },
  getAuth: (request: { get: (name: string) => string | undefined }) => ({
    userId: request.get("x-test-clerk-user") ?? null,
  }),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: Array<Condition | undefined>) => ({ kind: "and", conditions }),
  asc: (column: unknown) => column,
  eq: (column: Column, value: unknown) => ({ kind: "eq", column, value }),
  gt: (column: Column, value: unknown) => ({ kind: "gt", column, value }),
  inArray: (column: Column, values: unknown[]) => ({ kind: "in", column, values }),
  lt: (column: Column, value: unknown) => ({ kind: "lt", column, value }),
  ne: (column: Column, value: unknown) => ({ kind: "ne", column, value }),
  or: (...conditions: Array<Condition | undefined>) => ({ kind: "or", conditions }),
  sql: () => ({}),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: (selection?: Record<string, Column>) => mocks.query(selection),
    insert: (table: { tableName: string }) => mocks.insert(table),
    update: (table: { tableName: string }) => mocks.update(table),
    transaction: (callback: (tx: Record<string, unknown>) => unknown) =>
      callback({
        execute: vi.fn(),
        select: (selection?: Record<string, Column>) => mocks.query(selection),
        insert: (table: { tableName: string }) => mocks.insert(table),
        update: (table: { tableName: string }) => mocks.update(table),
      }),
  },
  ...Object.fromEntries(
    Object.entries(mocks).filter(([name]) => name.endsWith("Table")),
  ),
}));

import express from "express";
import appointmentsRouter from "../src/routes/appointments";

const app = express();
app.use(express.json());
app.use("/api", appointmentsRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
const ownerId = "550e8400-e29b-41d4-a716-446655440001";
const providerUserId = "550e8400-e29b-41d4-a716-446655440002";
const providerId = "550e8400-e29b-41d4-a716-446655440011";
const serviceId = "550e8400-e29b-41d4-a716-446655440021";
const petId = "550e8400-e29b-41d4-a716-446655440031";
const bookingDate = "2099-12-31";
const bookingDay = new Date(`${bookingDate}T12:00:00.000Z`).getUTCDay();

beforeEach(async () => {
  mocks.reset();
  mocks.profiles.push(
    {
      id: ownerId,
      clerkUserId: "owner-one",
      email: "owner@example.com",
      emailVerified: true,
      phoneNumber: null,
      whatsappOptIn: false,
      role: "owner",
      onboardingCompleted: true,
    },
    {
      id: providerUserId,
      clerkUserId: "provider-one",
      email: "provider@example.com",
      emailVerified: true,
      phoneNumber: null,
      whatsappOptIn: false,
      role: "provider",
      onboardingCompleted: true,
    },
  );
  mocks.providers.push({
    id: providerId,
    userId: providerUserId,
    name: "Clínica Monka",
    approvalStatus: "approved",
  });
  mocks.services.push({
    id: serviceId,
    providerProfileId: providerId,
    name: "Consulta",
    durationMinutes: 30,
    priceCop: 50000,
    isActive: true,
  });
  mocks.pets.push({ id: petId, ownerId, name: "Luna" });
  mocks.availability.push({
    providerProfileId: providerId,
    timezone: "America/Bogota",
    weeklyWindows: [{ dayOfWeek: bookingDay, startTime: "09:00", endTime: "12:00" }],
    exceptions: [],
  });
  server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

function headers(userId: string) {
  return { "content-type": "application/json", "x-test-clerk-user": userId };
}

async function requestAppointment(time: string, userId = "owner-one") {
  return fetch(`${baseUrl}/api/appointments`, {
    method: "POST",
    headers: headers(userId),
    body: JSON.stringify({ providerId, serviceId, petId, date: bookingDate, time }),
  });
}

describe("appointment routes", () => {
  it("prevents overlapping reservations and applies participant-only rescheduling", async () => {
    const created = await requestAppointment("10:00");
    expect(created.status, await created.clone().text()).toBe(201);
    const appointment = await created.json() as { id: string; status: string };
    expect(appointment.status).toBe("pending");
    expect(mocks.notifications).toHaveLength(2);

    const overlapping = await requestAppointment("10:15");
    expect(overlapping.status).toBe(409);

    const ownerConfirm = await fetch(`${baseUrl}/api/appointments/${appointment.id}/actions`, {
      method: "POST",
      headers: headers("owner-one"),
      body: JSON.stringify({ action: "confirm" }),
    });
    expect(ownerConfirm.status).toBe(400);

    const confirmed = await fetch(`${baseUrl}/api/appointments/${appointment.id}/actions`, {
      method: "POST",
      headers: headers("provider-one"),
      body: JSON.stringify({ action: "confirm" }),
    });
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).status).toBe("confirmed");

    const proposal = await fetch(`${baseUrl}/api/appointments/${appointment.id}/actions`, {
      method: "POST",
      headers: headers("provider-one"),
      body: JSON.stringify({ action: "propose_reschedule", date: bookingDate, time: "11:00" }),
    });
    expect(proposal.status).toBe(200);
    expect((await proposal.json()).status).toBe("reschedule_pending");

    const proposedSlot = await requestAppointment("11:00");
    expect(proposedSlot.status).toBe(409);

    const accepted = await fetch(`${baseUrl}/api/appointments/${appointment.id}/actions`, {
      method: "POST",
      headers: headers("owner-one"),
      body: JSON.stringify({ action: "accept_reschedule" }),
    });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).status).toBe("confirmed");
    expect(mocks.appointments[0].startsAt).toEqual(new Date("2099-12-31T16:00:00.000Z"));
  });

  it("limits appointment requests to owners and private to the appointment participants", async () => {
    const deniedRequest = await requestAppointment("10:00", "provider-one");
    expect(deniedRequest.status).toBe(403);

    const created = await requestAppointment("10:00");
    const appointment = await created.json() as { id: string };
    const deniedAction = await fetch(`${baseUrl}/api/appointments/${appointment.id}/actions`, {
      method: "POST",
      headers: headers("unknown-user"),
      body: JSON.stringify({ action: "cancel" }),
    });
    expect(deniedAction.status).toBe(403);
  });

  it("only queues WhatsApp notices for a phone number with explicit consent", async () => {
    Object.assign(mocks.profiles[0], {
      phoneNumber: "+573001234567",
      whatsappOptIn: true,
    });
    const response = await requestAppointment("10:00");
    expect(response.status).toBe(201);
    expect(mocks.notifications).toContainEqual(
      expect.objectContaining({
        channel: "whatsapp",
        destination: "+573001234567",
        status: "deferred",
      }),
    );
    expect(mocks.notifications.filter(row => row.channel === "whatsapp")).toHaveLength(1);
  });
});
