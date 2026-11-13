import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Column = { name: string };
type Condition =
  | { kind: "eq" | "gt" | "lte"; column: Column; value: unknown }
  | { kind: "in"; column: Column; values: unknown[] }
  | { kind: "and" | "or"; conditions: Array<Condition | undefined> };

const mocks = vi.hoisted(() => {
  const profiles: Row[] = [];
  const pets: Row[] = [];
  const reports: Row[] = [];
  const getUser = vi.fn(async () => ({}));
  const tables = {
    userProfilesTable: {
      tableName: "petpulse_user_profiles",
      id: { name: "id" },
      clerkUserId: { name: "clerkUserId" },
      role: { name: "role" },
      onboardingCompleted: { name: "onboardingCompleted" },
    },
    petsTable: {
      tableName: "petpulse_pets",
      id: { name: "id" },
      ownerId: { name: "ownerId" },
      name: { name: "name" },
      species: { name: "species" },
      breed: { name: "breed" },
      photoPath: { name: "photoPath" },
      status: { name: "status" },
    },
    lostPetReportsTable: {
      tableName: "petpulse_lost_pet_reports",
      id: { name: "id" },
      petId: { name: "petId" },
      ownerId: { name: "ownerId" },
      status: { name: "status" },
      expiresAt: { name: "expiresAt" },
      previousPetStatus: { name: "previousPetStatus" },
      createdAt: { name: "createdAt" },
    },
  };

  function rowsFor(tableName: string): Row[] {
    if (tableName === tables.userProfilesTable.tableName) return profiles;
    if (tableName === tables.petsTable.tableName) return pets;
    return reports;
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
    if (condition.kind === "gt") return actual > (condition.value as never);
    return actual <= (condition.value as never);
  }

  function query(selection?: Record<string, unknown>) {
    let rows: Row[] = [];
    let condition: Condition | undefined;
    let joinTable: { tableName: string } | undefined;
    function filteredRows() {
      const source = rows.filter(row => matches(condition, row));
      const joined = joinTable?.tableName === tables.petsTable.tableName
        ? source.flatMap(report => {
          const pet = pets.find(item => item.id === report.petId);
          return pet ? [{ ...pet, ...report, __report: report }] : [];
        })
        : source;
      if (!selection) return joined;
      return joined.map(row => Object.fromEntries(
        Object.entries(selection).map(([key, value]) => [
          key,
          value === tables.lostPetReportsTable
            ? row.__report
            : typeof value === "object" && value !== null && "name" in value
              ? row[(value as Column).name]
              : undefined,
        ]),
      ));
    }
    const builder = {
      from(table: { tableName: string }) {
        rows = rowsFor(table.tableName);
        return builder;
      },
      innerJoin(table: { tableName: string }) {
        joinTable = table;
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
    return builder;
  }

  function insert() {
    let values: Row = {};
    const builder = {
      values(input: Row) {
        values = input;
        return builder;
      },
      returning: async () => {
        const row = {
          id: "550e8400-e29b-41d4-a716-446655440099",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
          closedAt: null,
          ...values,
        };
        reports.push(row);
        return [row];
      },
    };
    return builder;
  }

  function update(table: { tableName: string }) {
    let values: Row = {};
    let condition: Condition | undefined;
    function apply() {
      const row = rowsFor(table.tableName).find(item => matches(condition, item));
      if (!row) return undefined;
      Object.assign(row, values);
      return row;
    }
    const builder = {
      set(input: Row) {
        values = input;
        return builder;
      },
      where(value: Condition) {
        condition = value;
        return builder;
      },
      returning: async () => {
        const row = apply();
        return row ? [row] : [];
      },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve().then(() => resolve(apply()), reject);
      },
    };
    return builder;
  }

  const db = {
    select: query,
    insert,
    update,
    transaction: (callback: (tx: Record<string, unknown>) => unknown) =>
      callback({ execute: vi.fn(), select: query, insert, update }),
  };

  return {
    db,
    getUser,
    profiles,
    pets,
    reports,
    tables,
    reset() {
      profiles.length = 0;
      pets.length = 0;
      reports.length = 0;
      getUser.mockClear();
    },
  };
});

vi.mock("@clerk/express", () => ({
  clerkClient: { users: { getUser: mocks.getUser } },
  getAuth: (request: { get: (name: string) => string | undefined }) => ({
    userId: request.get("x-test-clerk-user") ?? null,
  }),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: Array<Condition | undefined>) => ({ kind: "and", conditions }),
  asc: (column: unknown) => column,
  desc: (column: unknown) => column,
  eq: (column: Column, value: unknown) => ({ kind: "eq", column, value }),
  gt: (column: Column, value: unknown) => ({ kind: "gt", column, value }),
  inArray: (column: Column, values: unknown[]) => ({ kind: "in", column, values }),
  lte: (column: Column, value: unknown) => ({ kind: "lte", column, value }),
  or: (...conditions: Array<Condition | undefined>) => ({ kind: "or", conditions }),
  sql: () => ({}),
}));

vi.mock("@workspace/db", () => ({
  db: mocks.db,
  userProfilesTable: mocks.tables.userProfilesTable,
  petsTable: mocks.tables.petsTable,
  lostPetReportsTable: mocks.tables.lostPetReportsTable,
}));

vi.mock("../src/lib/petPhotoStorage", () => ({
  getPetPhotoUrl: vi.fn(),
}));

import express from "express";
import lostPetReportsRouter from "../src/routes/lostPetReports";

const app = express();
app.use(express.json());
app.use("/api", lostPetReportsRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
const ownerId = "550e8400-e29b-41d4-a716-446655440001";
const otherOwnerId = "550e8400-e29b-41d4-a716-446655440002";
const petId = "550e8400-e29b-41d4-a716-446655440011";
const ownerUserId = "owner-one";

beforeEach(async () => {
  mocks.reset();
  mocks.profiles.push(
    {
      id: ownerId,
      clerkUserId: ownerUserId,
      role: "owner",
      onboardingCompleted: true,
    },
    {
      id: otherOwnerId,
      clerkUserId: "owner-two",
      role: "owner",
      onboardingCompleted: true,
    },
  );
  mocks.pets.push({
    id: petId,
    ownerId,
    name: "Luna",
    species: "Perro",
    breed: "Criolla",
    photoPath: null,
    status: "home",
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

function headers(userId = ownerUserId) {
  return { "content-type": "application/json", "x-test-clerk-user": userId };
}

function reportInput(consentToShareLocation = true) {
  return {
    locationDescription: "Laureles, Medellín",
    lastSeenAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    consentToShareLocation,
  };
}

describe("lost-pet report routes", () => {
  it("requires explicit consent and creates a report that expires after 72 hours", async () => {
    const withoutConsent = await fetch(`${baseUrl}/api/pets/${petId}/lost-reports`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(reportInput(false)),
    });
    expect(withoutConsent.status).toBe(400);
    expect(mocks.reports).toHaveLength(0);

    const created = await fetch(`${baseUrl}/api/pets/${petId}/lost-reports`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(reportInput()),
    });
    expect(created.status, await created.clone().text()).toBe(201);
    const report = await created.json();
    expect(report.status).toBe("active");
    expect(report.canManage).toBe(true);
    expect(report.locationDescription).toBe("Laureles, Medellín");
    const remaining = new Date(report.expiresAt).getTime() - Date.now();
    expect(remaining).toBeGreaterThan(71 * 60 * 60 * 1000);
    expect(remaining).toBeLessThanOrEqual(72 * 60 * 60 * 1000);
    expect(mocks.pets[0].status).toBe("lost");

    const response = await fetch(`${baseUrl}/api/lost-pet-reports`, {
      headers: headers("owner-two"),
    });
    expect(response.status).toBe(200);
    const memberReports = await response.json();
    expect(memberReports).toHaveLength(1);
    expect(memberReports[0].locationDescription).toBe("Laureles, Medellín");
    expect(memberReports[0].canManage).toBe(false);
  });

  it("allows only the owner to close a report and renews with fresh consent", async () => {
    const created = await fetch(`${baseUrl}/api/pets/${petId}/lost-reports`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(reportInput()),
    });
    expect(created.status).toBe(201);
    const report = await created.json();

    const wrongOwnerClose = await fetch(`${baseUrl}/api/lost-pet-reports/${report.id}/close`, {
      method: "POST",
      headers: headers("owner-two"),
    });
    expect(wrongOwnerClose.status).toBe(404);
    expect(mocks.reports[0].status).toBe("active");

    const renewed = await fetch(`${baseUrl}/api/lost-pet-reports/${report.id}/renew`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        ...reportInput(),
        locationDescription: "El Poblado, Medellín",
      }),
    });
    expect(renewed.status, await renewed.clone().text()).toBe(200);
    expect((await renewed.json()).locationDescription).toBe("El Poblado, Medellín");

    const closed = await fetch(`${baseUrl}/api/lost-pet-reports/${report.id}/close`, {
      method: "POST",
      headers: headers(),
    });
    expect(closed.status, await closed.clone().text()).toBe(200);
    expect((await closed.json()).status).toBe("closed");
    expect(mocks.pets[0].status).toBe("home");

    const renewClosed = await fetch(`${baseUrl}/api/lost-pet-reports/${report.id}/renew`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(reportInput()),
    });
    expect(renewClosed.status).toBe(409);
  });

  it("expires reports after their deadline and hides expired reports from other members", async () => {
    const now = new Date();
    mocks.pets[0].status = "lost";
    mocks.reports.push({
      id: "550e8400-e29b-41d4-a716-446655440088",
      petId,
      ownerId,
      locationDescription: "Laureles, Medellín",
      lastSeenAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      notes: null,
      consentedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now.getTime() - 1),
      status: "active",
      previousPetStatus: "home",
      closedAt: null,
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    });

    const ownerResponse = await fetch(`${baseUrl}/api/lost-pet-reports`, {
      headers: headers(),
    });
    expect(ownerResponse.status).toBe(200);
    expect((await ownerResponse.json())[0].status).toBe("expired");
    expect(mocks.pets[0].status).toBe("home");

    const memberResponse = await fetch(`${baseUrl}/api/lost-pet-reports`, {
      headers: headers("owner-two"),
    });
    expect(memberResponse.status).toBe(200);
    expect(await memberResponse.json()).toHaveLength(0);
  });

  it("does not let an owner report another account's pet", async () => {
    mocks.pets[0].ownerId = otherOwnerId;
    const response = await fetch(`${baseUrl}/api/pets/${petId}/lost-reports`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(reportInput()),
    });
    expect(response.status).toBe(404);
    expect(mocks.reports).toHaveLength(0);
  });

  it("does not expose the reports endpoint to signed-out visitors", async () => {
    const response = await fetch(`${baseUrl}/api/lost-pet-reports`);
    expect(response.status).toBe(401);
  });
});
