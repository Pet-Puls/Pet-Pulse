import {
  index,
  pgEnum,
  pgTable,
  uniqueIndex,
  boolean,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { userProfilesTable } from "./userProfiles";

export const petStatusEnum = pgEnum("petpulse_pet_status", [
  "home",
  "walking",
  "lost",
]);

export const petsTable = pgTable(
  "petpulse_pets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    species: text("species").notNull(),
    breed: text("breed"),
    age: text("age"),
    emergencyContact: text("emergency_contact"),
    photoPath: text("photo_path"),
    qrToken: text("qr_token"),
    shareEmergencyContact: boolean("share_emergency_contact").notNull().default(false),
    status: petStatusEnum("status").notNull().default("home"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("petpulse_pets_owner_id_idx").on(table.ownerId),
    uniqueIndex("petpulse_pets_qr_token_idx").on(table.qrToken),
  ],
);

export type PetRecord = typeof petsTable.$inferSelect;
export type InsertPetRecord = typeof petsTable.$inferInsert;
