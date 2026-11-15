import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { petsTable, petStatusEnum } from "./pets";
import { userProfilesTable } from "./userProfiles";

export const lostPetReportStatusEnum = pgEnum("petpulse_lost_pet_report_status", [
  "active",
  "closed",
  "expired",
]);

export const lostPetReportsTable = pgTable(
  "petpulse_lost_pet_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    locationDescription: text("location_description").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: lostPetReportStatusEnum("status").notNull().default("active"),
    previousPetStatus: petStatusEnum("previous_pet_status").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("petpulse_lost_pet_reports_active_pet_idx")
      .on(table.petId)
      .where(sql`${table.status} = 'active'`),
    index("petpulse_lost_pet_reports_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
    index("petpulse_lost_pet_reports_status_expires_idx").on(
      table.status,
      table.expiresAt,
    ),
  ],
);

export type LostPetReportRecord = typeof lostPetReportsTable.$inferSelect;
