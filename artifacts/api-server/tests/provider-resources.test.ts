import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Condition =
  | { kind: "eq"; column: { name: string }; value: unknown }
  | { kind: "and"; conditions: Condition[] };

const mocks = vi.hoisted(() => {
  const profiles: Row[] = [];
  const businesses: Row[] = [];
  const services: Row[] = [];
  const availabilities: Row[] = [];
  const userProfilesTable = {
    tableName: "petpulse_user_profiles",
    clerkUserId: { name: "clerkUserId" },
  };
  const providerProfilesTable = {
    tableName: "petpulse_provider_profiles",
    id: { name: "id" },
    userId: { name: "userId" },
  };
  const providerServicesTable = {
    tableName: "petpulse_provider_services",
    id: { name: "id" },
    providerProfileId: { name: "providerProfileId" },
    createdAt: { name: "createdAt" },
  };
  const providerAvailabilityTable = {
    tableName: "petpulse_provider_availability",
    providerProfileId: { name: "providerProfileId" },
  };
  let nextServiceId = 1;

  function matches(condition: Condition, row: Row): boolean {
    if (condition.kind === "and") {
      return condition.conditions.every((item) => matches(item, row));
    }
    return row[condition.column.name] === condition.value;
  }

  function rowsFor(tableName: string): Row[] {
    if (tableName === userProfilesTable.tableName) return profiles;
    if (tableName === providerProfilesTable.tableName) return businesses;
    if (tableName === providerServicesTable.tableName) return services;
    return availabilities;
  }

  function query() {
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
      then(
        resolve: (value: Row[]) => unknown,
        reject: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(filteredRows()).then(resolve, reject);
      },
    };
    function filteredRows() {
      return condition ? rows.filter((row) => matches(condition!, row)) : [...rows];
    }
    return builder;
  }

  function insert(table: { tableName: string }) {
    let values: Row = {};
    const builder = {
      values(row: Row) {
        values = row;
        return builder;
      },
      returning: async () => {
        const now = new Date("2026-01-02T00:00:00.000Z");
        const inserted = {
          ...values,
          ...(table.tableName === providerServicesTable.tableName
            ? {
                id: `550e8400-e29b-41d4-a716-${String(nextServiceId++).padStart(12, "0")}`,
                isActive: true,
                createdAt: now,
                updatedAt: now,
              }
            : { updatedAt: now }),
        };
        rowsFor(table.tableName).push(inserted);
        return [inserted];
      },
      onConflictDoUpdate(configuration: { set: Row }) {
        return {
          returning: async () => {
            const existing = availabilities.find(
              (row) => row.providerProfileId === values.providerProfileId,
            );
            const now = new Date("2026-01-02T00:00:00.000Z");
            const saved = {
              ...(existing ?? values),
              ...configuration.set,
              providerProfileId: values.providerProfileId,
              updatedAt: now,
            };
            if (existing) Object.assign(existing, saved);
            else availabilities.push(saved);
            return [saved];
          },
        };
      },
    };
    return builder;
  }

  function update(table: { tableName: string }) {
    let values: Row = {};
    let condition: Condition = { kind: "and", conditions: [] };
    return {
      set(row: Row) {
        values = row;
        return this;
      },
      where(value: Condition) {
        condition = value;
        return this;
      },
      returning: async () => {
        const row = rowsFor(table.tableName).find((item) => matches(condition, item));
        if (!row) return [];
        Object.assign(row, values);
        return [row];
      },
    };
  }

  return {
    profiles,
    businesses,
    services,
    availabilities,
    userProfilesTable,
    providerProfilesTable,
    providerServicesTable,
    providerAvailabilityTable,
    query,
    insert,
    update,
    getUserId: vi.fn(),
    reset() {
      profiles.length = 0;
      businesses.length = 0;
      services.length = 0;
      availabilities.length = 0;
      nextServiceId = 1;
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
  and: (...conditions: Condition[]) => ({ kind: "and", conditions }),
  asc: (column: unknown) => column,
  eq: (column: { name: string }, value: unknown) => ({ kind: "eq", column, value }),
  sql: () => ({}),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => mocks.query(),
    insert: (table: { tableName: string }) => mocks.insert(table),
    update: (table: { tableName: string }) => mocks.update(table),
    transaction: (callback: (tx: Record<string, unknown>) => unknown) =>
      callback({
        execute: vi.fn(),
        select: () => mocks.query(),
        insert: (table: { tableName: string }) => mocks.insert(table),
        update: (table: { tableName: string }) => mocks.update(table),
      }),
  },
  userProfilesTable: mocks.userProfilesTable,
  providerProfilesTable: mocks.providerProfilesTable,
  providerServicesTable: mocks.providerServicesTable,
  providerAvailabilityTable: mocks.providerAvailabilityTable,
}));

import express from "express";
import providerResourcesRouter from "../src/routes/providerResources";

const app = express();
app.use(express.json());
app.use("/api", providerResourcesRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeEach(async () => {
  mocks.reset();
  mocks.profiles.push(
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      clerkUserId: "provider-one",
      role: "provider",
      onboardingCompleted: true,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440002",
      clerkUserId: "provider-two",
      role: "provider",
      onboardingCompleted: true,
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440003",
      clerkUserId: "owner-one",
      role: "owner",
      onboardingCompleted: true,
    },
  );
  mocks.businesses.push(
    {
      id: "550e8400-e29b-41d4-a716-446655440011",
      userId: "550e8400-e29b-41d4-a716-446655440001",
      approvalStatus: "pending",
    },
    {
      id: "550e8400-e29b-41d4-a716-446655440012",
      userId: "550e8400-e29b-41d4-a716-446655440002",
    },
  );
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
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function providerHeaders(userId: string) {
  return {
    "content-type": "application/json",
    "x-test-clerk-user": userId,
  };
}

describe("provider resource routes", () => {
  it("allows a provider to create services and lists only their own services", async () => {
    mocks.services.push({
      id: "550e8400-e29b-41d4-a716-446655440021",
      providerProfileId: "550e8400-e29b-41d4-a716-446655440012",
      name: "Servicio de otra cuenta",
      description: null,
      durationMinutes: 30,
      priceCop: null,
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const createResponse = await fetch(`${baseUrl}/api/provider-profile/services`, {
      method: "POST",
      headers: providerHeaders("provider-one"),
      body: JSON.stringify({
        name: " Consulta ",
        description: " Revisión general ",
        durationMinutes: 45,
        priceCop: 80000,
      }),
    });
    expect(createResponse.status, await createResponse.clone().text()).toBe(201);
    expect(await createResponse.json()).toMatchObject({
      name: "Consulta",
      description: "Revisión general",
      durationMinutes: 45,
      priceCop: 80000,
      isActive: true,
    });

    const listResponse = await fetch(`${baseUrl}/api/provider-profile/services`, {
      headers: providerHeaders("provider-one"),
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toHaveLength(1);
  });

  it("rejects tutor access and refuses to update another provider's service", async () => {
    mocks.services.push({
      id: "550e8400-e29b-41d4-a716-446655440022",
      providerProfileId: "550e8400-e29b-41d4-a716-446655440012",
      name: "Servicio ajeno",
      description: null,
      durationMinutes: 30,
      priceCop: null,
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const denied = await fetch(`${baseUrl}/api/provider-profile/services`, {
      headers: providerHeaders("owner-one"),
    });
    expect(denied.status).toBe(403);

    const update = await fetch(
      `${baseUrl}/api/provider-profile/services/550e8400-e29b-41d4-a716-446655440022`,
      {
        method: "PATCH",
        headers: providerHeaders("provider-one"),
        body: JSON.stringify({ name: "Cambio no autorizado" }),
      },
    );
    expect(update.status).toBe(404);
    expect(mocks.services[0].name).toBe("Servicio ajeno");
  });

  it("rejects overlapping availability windows without saving them", async () => {
    const response = await fetch(`${baseUrl}/api/provider-profile/availability`, {
      method: "PUT",
      headers: providerHeaders("provider-one"),
      body: JSON.stringify({
        timezone: "America/Bogota",
        weeklyWindows: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
          { dayOfWeek: 1, startTime: "11:00", endTime: "13:00" },
        ],
        exceptions: [],
      }),
    });
    expect(response.status).toBe(400);
    expect(mocks.availabilities).toHaveLength(0);
  });

  it("saves multiple weekly periods and date exceptions as local calendar dates", async () => {
    const response = await fetch(`${baseUrl}/api/provider-profile/availability`, {
      method: "PUT",
      headers: providerHeaders("provider-one"),
      body: JSON.stringify({
        timezone: "America/Bogota",
        weeklyWindows: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
          { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" },
        ],
        exceptions: [
          { date: "2026-06-15", isClosed: true, windows: [] },
          {
            date: "2026-06-16",
            isClosed: false,
            windows: [{ startTime: "10:00", endTime: "14:00" }],
          },
        ],
      }),
    });

    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
      timezone: "America/Bogota",
      weeklyWindows: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
        { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" },
      ],
      exceptions: [
        { date: "2026-06-15", isClosed: true, windows: [] },
        {
          date: "2026-06-16",
          isClosed: false,
          windows: [{ startTime: "10:00", endTime: "14:00" }],
        },
      ],
    });
    expect(mocks.availabilities[0].exceptions).toMatchObject([
      { date: "2026-06-15", isClosed: true },
      { date: "2026-06-16", isClosed: false },
    ]);
  });
});
