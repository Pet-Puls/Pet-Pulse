import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const accountRoleEnum = pgEnum("petpulse_account_role", ["owner", "provider"]);

export const userProfilesTable = pgTable(
  "petpulse_user_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneNumber: text("phone_number"),
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    whatsappOptInAt: timestamp("whatsapp_opt_in_at", { withTimezone: true }),
    displayName: text("display_name").notNull(),
    role: accountRoleEnum("role").notNull().default("owner"),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "petpulse_user_profiles_phone_format_check",
      sql`${table.phoneNumber} IS NULL OR ${table.phoneNumber} ~ '^\\+[1-9][0-9]{1,14}$'`,
    ),
    check(
      "petpulse_user_profiles_whatsapp_consent_check",
      sql`(${table.whatsappOptIn} = false AND ${table.whatsappOptInAt} IS NULL) OR (${table.whatsappOptIn} = true AND ${table.whatsappOptInAt} IS NOT NULL AND ${table.phoneNumber} IS NOT NULL)`,
    ),
  ],
);

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertUserProfile = typeof userProfilesTable.$inferInsert;
