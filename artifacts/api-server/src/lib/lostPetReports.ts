import { and, eq, lte, sql } from "drizzle-orm";
import { db, lostPetReportsTable, petsTable } from "@workspace/db";

export async function expireLostPetReports(now = new Date()): Promise<void> {
  const expired = await db
    .select({
      id: lostPetReportsTable.id,
      petId: lostPetReportsTable.petId,
      previousPetStatus: lostPetReportsTable.previousPetStatus,
    })
    .from(lostPetReportsTable)
    .where(
      and(
        eq(lostPetReportsTable.status, "active"),
        lte(lostPetReportsTable.expiresAt, now),
      ),
    );

  for (const report of expired) {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${report.petId})::bigint)`,
      );
      const [updated] = await tx
        .update(lostPetReportsTable)
        .set({ status: "expired", updatedAt: now })
        .where(
          and(
            eq(lostPetReportsTable.id, report.id),
            eq(lostPetReportsTable.status, "active"),
            lte(lostPetReportsTable.expiresAt, now),
          ),
        )
        .returning({ id: lostPetReportsTable.id });
      if (updated) {
        const previousPetStatus =
          report.previousPetStatus === "walking" ? "walking" : "home";
        await tx
          .update(petsTable)
          .set({ status: previousPetStatus, updatedAt: now })
          .where(
            and(
              eq(petsTable.id, report.petId),
              eq(petsTable.status, "lost"),
            ),
          );
      }
    });
  }
}
