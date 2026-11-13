import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profiles: new Map<string, Record<string, unknown>>(),
  clerkUsers: new Map<string, Record<string, unknown>>(),
  pets: [] as Array<Record<string, unknown>>,
  getUser: vi.fn(async (userId: string) => mocks.clerkUsers.get(userId) ?? {}),
  tables: {
    userProfiles: { clerkUserId: { name: "clerkUserId" } },
    pets: {
      ownerId: { name: "ownerId" },
      createdAt: { name: "createdAt" },
      qrToken: { name: "qrToken" },
    },
    lostPetReports: {
      id: { name: "id" },
      petId: { name: "petId" },
      previousPetStatus: { name: "previousPetStatus" },
      expiresAt: { name: "expiresAt" },
      status: { name: "status" },
    },
  },
}));

vi.mock("@clerk/express", () => ({
  clerkClient: { users: { getUser: mocks.getUser } },
  getAuth: (request: { get: (name: string) => string | undefined }) => ({
    userId: request.get("x-test-clerk-user") ?? null,
  }),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  asc: (column: unknown) => ({ column, direction: "asc" }),
  eq: (column: unknown, value: string) => ({ column, value }),
  lte: (column: unknown, value: Date) => ({ column, value }),
  sql: () => ({}),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: { column: { name: string }; value: string }) => {
          if (table === mocks.tables.lostPetReports) {
            return Promise.resolve([]);
          }
          const matchingRows = () => {
            if (condition.column.name === "clerkUserId") {
              const profile = mocks.profiles.get(condition.value);
              return profile ? [profile] : [];
            }
            if (condition.column.name === "ownerId") {
              return mocks.pets.filter(pet => pet.ownerId === condition.value);
            }
            return [];
          };
          return {
            limit: async () => matchingRows().slice(0, 1),
            orderBy: async () => matchingRows(),
          };
        },
      }),
    }),
  },
  lostPetReportsTable: mocks.tables.lostPetReports,
  petsTable: mocks.tables.pets,
  userProfilesTable: mocks.tables.userProfiles,
}));

vi.mock("../src/lib/petPhotoStorage", () => ({
  deletePetPhoto: vi.fn(),
  getPetPhotoMaxBytes: () => 5 * 1024 * 1024,
  getPetPhotoUrl: vi.fn(),
  uploadPetPhoto: vi.fn(),
}));

import express from "express";
import { requireAuth, requireRole } from "../src/middlewares/auth";
import petsRouter from "../src/routes/pets";

const app = express();
app.use("/api", petsRouter);
app.get(
  "/owner",
  requireAuth,
  requireRole("owner"),
  (request, response) => response.json({
    role: request.petPulseRole,
    profileId: request.petPulseProfile?.id,
  }),
);
app.get(
  "/admin",
  requireAuth,
  requireRole("admin"),
  (request, response) => response.json({
    role: request.petPulseRole,
    profileId: request.petPulseProfile?.id,
  }),
);

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeEach(async () => {
  mocks.profiles.clear();
  mocks.clerkUsers.clear();
  mocks.pets.length = 0;
  mocks.getUser.mockClear();
  delete process.env.PETPULSE_ADMIN_EMAILS;
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
  delete process.env.PETPULSE_ADMIN_EMAILS;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

function addProfile(
  userId: string,
  role: "owner" | "provider" | "admin",
  onboardingCompleted = true,
) {
  const profile = {
    id: `${userId}-profile`,
    clerkUserId: userId,
    role,
    onboardingCompleted,
  };
  mocks.profiles.set(userId, profile);
  return profile;
}

describe("API authorization middleware", () => {
  it("rejects requests without an authenticated identity", async () => {
    const response = await fetch(`${baseUrl}/owner`);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Se requiere iniciar sesión." });
    expect(mocks.profiles.size).toBe(0);
  });

  it("rejects users who have not completed onboarding", async () => {
    addProfile("owner-unonboarded", "owner", false);
    const response = await fetch(`${baseUrl}/owner`, {
      headers: { "x-test-clerk-user": "owner-unonboarded" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Completa la configuración de tu cuenta.",
    });
  });

  it("denies a provider from owner-only routes", async () => {
    addProfile("provider-user", "provider");
    const response = await fetch(`${baseUrl}/owner`, {
      headers: { "x-test-clerk-user": "provider-user" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Tu cuenta no tiene permiso para esta acción.",
    });
  });

  it("allows an onboarded owner and attaches the resolved profile to the request", async () => {
    const profile = addProfile("owner-user", "owner");
    const response = await fetch(`${baseUrl}/owner`, {
      headers: { "x-test-clerk-user": "owner-user" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      role: "owner",
      profileId: profile.id,
    });
  });

  it("lists only pets belonging to the authenticated owner", async () => {
    const owner = addProfile("owner-user", "owner");
    const otherOwner = addProfile("other-owner", "owner");
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    mocks.pets.push(
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        ownerId: owner.id,
        name: "Luna",
        species: "Perro",
        breed: null,
        age: null,
        emergencyContact: null,
        photoPath: null,
        qrToken: null,
        shareEmergencyContact: false,
        status: "home",
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        ownerId: otherOwner.id,
        name: "Toby",
        species: "Gato",
        breed: null,
        age: null,
        emergencyContact: null,
        photoPath: null,
        qrToken: null,
        shareEmergencyContact: false,
        status: "home",
        createdAt,
        updatedAt: createdAt,
      },
    );

    const response = await fetch(`${baseUrl}/api/pets`, {
      headers: { "x-test-clerk-user": "owner-user" },
    });

    expect(response.status).toBe(200);
    const pets = await response.json() as Array<{ name: string }>;
    expect(pets.map(pet => pet.name)).toEqual(["Luna"]);
  });

  it("does not grant configured-admin access to an unverified email", async () => {
    addProfile("candidate-admin", "owner");
    process.env.PETPULSE_ADMIN_EMAILS = "admin@example.com";
    mocks.clerkUsers.set("candidate-admin", {
      primaryEmailAddress: {
        emailAddress: "ADMIN@example.com",
        verification: { status: "unverified" },
      },
    });

    const response = await fetch(`${baseUrl}/admin`, {
      headers: { "x-test-clerk-user": "candidate-admin" },
    });

    expect(response.status).toBe(403);
    expect(mocks.getUser).toHaveBeenCalledWith("candidate-admin");
  });

  it("grants configured-admin access only for a verified matching email", async () => {
    const profile = addProfile("candidate-admin", "owner");
    process.env.PETPULSE_ADMIN_EMAILS = "admin@example.com";
    mocks.clerkUsers.set("candidate-admin", {
      primaryEmailAddress: {
        emailAddress: "ADMIN@example.com",
        verification: { status: "verified" },
      },
    });

    const response = await fetch(`${baseUrl}/admin`, {
      headers: { "x-test-clerk-user": "candidate-admin" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      role: "admin",
      profileId: profile.id,
    });
  });
});
