import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type Condition =
  | { kind: "eq"; column: { name: string }; value: unknown }
  | { kind: "and" | "or"; conditions: Condition[] }
  | { kind: "ilike"; column: { name: string }; pattern: string };

const mocks = vi.hoisted(() => {
  const profiles: Row[] = [];
  const providers: Row[] = [];
  const userProfilesTable = {
    tableName: "petpulse_user_profiles",
    id: { name: "id" },
    clerkUserId: { name: "clerkUserId" },
  };
  const providerProfilesTable = {
    tableName: "petpulse_provider_profiles",
    id: { name: "id" },
    userId: { name: "userId" },
    name: { name: "name" },
    category: { name: "category" },
    neighborhood: { name: "neighborhood" },
    description: { name: "description" },
    websiteUrl: { name: "websiteUrl" },
    instagramUrl: { name: "instagramUrl" },
    facebookUrl: { name: "facebookUrl" },
    whatsappUrl: { name: "whatsappUrl" },
    approvalStatus: { name: "approvalStatus" },
    approvedAt: { name: "approvedAt" },
  };

  function matches(condition: Condition, row: Row): boolean {
    if (condition.kind === "eq") {
      return row[condition.column.name] === condition.value;
    }
    if (condition.kind === "and") {
      return condition.conditions.every(item => matches(item, row));
    }
    if (condition.kind === "or") {
      return condition.conditions.some(item => matches(item, row));
    }
    const value = String(row[condition.column.name] ?? "").toLowerCase();
    const needle = condition.pattern
      .replace(/^%|%$/g, "")
      .replace(/[\\%_]/g, "")
      .toLowerCase();
    return value.includes(needle);
  }

  function query(selection?: Record<string, unknown>) {
    let rows: Row[] = [];
    let condition: Condition | undefined;
    let limit = Number.POSITIVE_INFINITY;
    let offset = 0;
    const builder = {
      from(table: { tableName: string }) {
        rows = table.tableName === "petpulse_user_profiles" ? profiles : providers;
        return builder;
      },
      where(value: Condition) {
        condition = value;
        return builder;
      },
      orderBy() {
        return builder;
      },
      limit(value: number) {
        limit = value;
        return builder;
      },
      offset(value: number) {
        offset = value;
        return builder;
      },
      then(
        resolve: (value: Row[]) => unknown,
        reject: (reason: unknown) => unknown,
      ) {
        try {
          const filtered = condition
            ? rows.filter(row => matches(condition!, row))
            : [...rows];
          if (selection?.count) {
            return Promise.resolve(resolve([{ count: filtered.length }]));
          }
          const selected = filtered.slice(offset, offset + limit);
          return Promise.resolve(resolve(selected));
        } catch (error) {
          return Promise.resolve(reject(error));
        }
      },
    };
    return builder;
  }

  return {
    profiles,
    providers,
    userProfilesTable,
    providerProfilesTable,
    query,
    insertValues: vi.fn(),
    getUserId: vi.fn(),
  };
});

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: mocks.getUserId() }),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: Condition[]) => ({ kind: "and", conditions }),
  asc: (column: unknown) => column,
  eq: (column: { name: string }, value: unknown) => ({ kind: "eq", column, value }),
  ilike: (column: { name: string }, pattern: string) => ({ kind: "ilike", column, pattern }),
  or: (...conditions: Condition[]) => ({ kind: "or", conditions }),
  sql: () => ({ kind: "count" }),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: (selection?: Record<string, unknown>) => mocks.query(selection),
    insert: () => ({
      values: (values: Row) => {
        mocks.insertValues(values);
        return {
          onConflictDoUpdate: (configuration: { set: Row }) => ({
            returning: async () => {
              const index = mocks.providers.findIndex(
                item => item.userId === values.userId,
              );
              const next = {
                ...(index === -1 ? {} : mocks.providers[index]),
                ...values,
                ...configuration.set,
                id: index === -1
                  ? "550e8400-e29b-41d4-a716-446655440003"
                  : mocks.providers[index].id,
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-02T00:00:00.000Z"),
              };
              if (index === -1) mocks.providers.push(next);
              else mocks.providers[index] = next;
              return [next];
            },
          }),
        };
      },
    }),
  },
  providerProfilesTable: mocks.providerProfilesTable,
  userProfilesTable: mocks.userProfilesTable,
}));

import express from "express";
import providerProfileRouter from "../src/routes/providerProfile";

const app = express();
app.use(express.json());
app.use("/api", providerProfileRouter);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeEach(async () => {
  mocks.profiles.length = 0;
  mocks.providers.length = 0;
  mocks.insertValues.mockClear();
  mocks.getUserId.mockReturnValue(null);
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

function addProviderIdentity() {
  mocks.profiles.push({
    id: "550e8400-e29b-41d4-a716-446655440001",
    clerkUserId: "provider-user",
    role: "provider",
    onboardingCompleted: true,
  });
  mocks.getUserId.mockReturnValue("provider-user");
}

describe("provider profile routes", () => {
  it("saves social links and resets an approved profile to pending review", async () => {
    addProviderIdentity();
    mocks.providers.push({
      id: "550e8400-e29b-41d4-a716-446655440002",
      userId: "550e8400-e29b-41d4-a716-446655440001",
      approvalStatus: "approved",
      approvedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await fetch(`${baseUrl}/api/provider-profile`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-test-clerk-user": "provider-user",
      },
      body: JSON.stringify({
        name: " Clínica Luna ",
        category: "veterinary",
        neighborhood: " Laureles ",
        websiteUrl: "https://clinic.example",
        instagramUrl: "https://www.instagram.com/clinicaluna",
      }),
    });

    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
      name: "Clínica Luna",
      neighborhood: "Laureles",
      websiteUrl: "https://clinic.example",
      instagramUrl: "https://www.instagram.com/clinicaluna",
      approvalStatus: "pending",
    });
    expect(mocks.providers[0]).toMatchObject({
      approvalStatus: "pending",
      approvedAt: null,
    });
  });

  it("rejects a social URL that belongs to a different network", async () => {
    addProviderIdentity();

    const response = await fetch(`${baseUrl}/api/provider-profile`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-test-clerk-user": "provider-user",
      },
      body: JSON.stringify({
        name: "Clínica Luna",
        category: "veterinary",
        neighborhood: "Laureles",
        facebookUrl: "https://instagram.com/clinicaluna",
      }),
    });

    expect(response.status).toBe(400);
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("publishes links only for approved provider profiles", async () => {
    mocks.providers.push(
      {
        id: "550e8400-e29b-41d4-a716-446655440004",
        name: "Clínica Abierta",
        category: "veterinary",
        neighborhood: "Centro",
        description: null,
        websiteUrl: "https://approved.example",
        instagramUrl: "https://instagram.com/approved",
        facebookUrl: null,
        whatsappUrl: null,
        approvalStatus: "approved",
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440005",
        name: "Clínica Pendiente",
        category: "veterinary",
        neighborhood: "Centro",
        description: null,
        websiteUrl: "https://pending.example",
        instagramUrl: null,
        facebookUrl: null,
        whatsappUrl: null,
        approvalStatus: "pending",
      },
    );

    const response = await fetch(`${baseUrl}/api/providers`);

    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
      total: 1,
      items: [{
        id: "550e8400-e29b-41d4-a716-446655440004",
        websiteUrl: "https://approved.example",
        instagramUrl: "https://instagram.com/approved",
      }],
    });
  });
});
