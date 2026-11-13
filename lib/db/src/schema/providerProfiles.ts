import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./userProfiles";

export const providerCategoryEnum = pgEnum("petpulse_provider_category", [
  "veterinary",
  "daycare",
  "walker",
  "shelter",
  "store",
  "other",
]);

export const providerApprovalStatusEnum = pgEnum(
  "petpulse_provider_approval_status",
  ["pending", "approved", "suspended"],
);

export const providerProfilesTable = pgTable(
  "petpulse_provider_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: providerCategoryEnum("category").notNull(),
    neighborhood: text("neighborhood").notNull(),
    description: text("description"),
    websiteUrl: text("website_url"),
    instagramUrl: text("instagram_url"),
    facebookUrl: text("facebook_url"),
    whatsappUrl: text("whatsapp_url"),
    approvalStatus: providerApprovalStatusEnum("approval_status")
      .notNull()
      .default("pending"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("petpulse_provider_profiles_status_idx").on(table.approvalStatus),
  ],
);

export type ProviderProfileRecord = typeof providerProfilesTable.$inferSelect;
export type InsertProviderProfileRecord = typeof providerProfilesTable.$inferInsert;
