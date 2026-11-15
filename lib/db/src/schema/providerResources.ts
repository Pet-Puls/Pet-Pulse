import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { providerProfilesTable } from "./providerProfiles";

export type AvailabilityWindow = {
  startTime: string;
  endTime: string;
};

export type WeeklyAvailabilityWindow = AvailabilityWindow & {
  dayOfWeek: number;
};

export type AvailabilityException = {
  date: string;
  isClosed: boolean;
  windows: AvailabilityWindow[];
};

export const providerServicesTable = pgTable(
  "petpulse_provider_services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerProfileId: uuid("provider_profile_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCop: integer("price_cop"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("petpulse_provider_services_profile_idx").on(table.providerProfileId),
    check(
      "petpulse_provider_services_duration_check",
      sql`${table.durationMinutes} BETWEEN 5 AND 480`,
    ),
    check(
      "petpulse_provider_services_price_check",
      sql`${table.priceCop} IS NULL OR ${table.priceCop} >= 0`,
    ),
  ],
);

export const providerAvailabilityTable = pgTable(
  "petpulse_provider_availability",
  {
    providerProfileId: uuid("provider_profile_id")
      .primaryKey()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    timezone: text("timezone").notNull().default("America/Bogota"),
    weeklyWindows: jsonb("weekly_windows")
      .$type<WeeklyAvailabilityWindow[]>()
      .notNull()
      .default([]),
    exceptions: jsonb("exceptions")
      .$type<AvailabilityException[]>()
      .notNull()
      .default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export type ProviderServiceRecord = typeof providerServicesTable.$inferSelect;
export type InsertProviderServiceRecord = typeof providerServicesTable.$inferInsert;
export type ProviderAvailabilityRecord = typeof providerAvailabilityTable.$inferSelect;
