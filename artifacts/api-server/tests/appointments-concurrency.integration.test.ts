import { randomUUID } from "node:crypto";
import express from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/express", () => ({
  clerkClient: { users: { getUser: vi.fn() } },
  getAuth: (request: { get: (name: string) => string | undefined }) => ({
    userId: request.get("x-test-clerk-user") ?? null,
  }),
}));

const integrationUrl = process.env.PETPULSE_INTEGRATION_DATABASE_URL;

describe.skipIf(!integrationUrl)("appointment concurrency with PostgreSQL", () => {
  it("serializes simultaneous requests for the same provider and time", async () => {
    if (!integrationUrl) throw new Error("Missing integration database URL.");
    const url = new URL(integrationUrl);
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== "127.0.0.1" ||
      url.pathname !== "/petpulse_test"
    ) {
      throw new Error("Integration tests require the isolated local petpulse_test database.");
    }

    process.env.DATABASE_URL = integrationUrl;
    process.env.DATABASE_SSL = "false";
    const {
      db, pool, userProfilesTable, petsTable, providerProfilesTable,
      providerServicesTable, providerAvailabilityTable, appointmentsTable,
    } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const { default: appointmentsRouter } = await import("../src/routes/appointments");

    const ownerId = randomUUID();
    const providerUserId = randomUUID();
    const providerId = randomUUID();
    const serviceId = randomUUID();
    const petId = randomUUID();
    const ownerUserId = `qa-${ownerId}`;
    const date = "2099-12-31";
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();

    const app = express();
    app.use(express.json());
    app.use("/api", appointmentsRouter);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const lockClient = await pool.connect();
    let lockHeld = false;
    try {
      await db.insert(userProfilesTable).values([
        { id: ownerId, clerkUserId: ownerUserId, email: "owner@example.test", displayName: "QA owner", role: "owner", onboardingCompleted: true },
        { id: providerUserId, clerkUserId: `qa-${providerUserId}`, email: "provider@example.test", displayName: "QA provider", role: "provider", onboardingCompleted: true },
      ]);
      await db.insert(petsTable).values({ id: petId, ownerId, name: "QA pet", species: "Perro" });
      await db.insert(providerProfilesTable).values({
        id: providerId, userId: providerUserId, name: "QA provider", category: "veterinary",
        neighborhood: "QA", approvalStatus: "approved",
      });
      await db.insert(providerServicesTable).values({
        id: serviceId, providerProfileId: providerId, name: "QA service", durationMinutes: 30,
      });
      await db.insert(providerAvailabilityTable).values({
        providerProfileId: providerId, timezone: "America/Bogota",
        weeklyWindows: [{ dayOfWeek, startTime: "09:00", endTime: "12:00" }], exceptions: [],
      });

      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not bind to TCP.");
      await lockClient.query("BEGIN");
      await lockClient.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)", [providerId]);
      lockHeld = true;
      const send = () => fetch(`http://127.0.0.1:${address.port}/api/appointments`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-clerk-user": ownerUserId },
        body: JSON.stringify({ providerId, serviceId, petId, date, time: "10:00" }),
      });
      const requests = [send(), send()];
      let waiting = 0;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await pool.query<{ waiting: number }>(
          "SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted",
        );
        waiting = result.rows[0].waiting;
        if (waiting >= 2) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await lockClient.query("COMMIT");
      lockHeld = false;
      const responses = await Promise.all(requests);
      expect(waiting).toBe(2);
      expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
      const appointments = await db.select().from(appointmentsTable)
        .where(eq(appointmentsTable.providerProfileId, providerId));
      expect(appointments).toHaveLength(1);
    } finally {
      if (lockHeld) await lockClient.query("ROLLBACK");
      lockClient.release();
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
      await pool.end();
    }
  }, 20_000);
});
