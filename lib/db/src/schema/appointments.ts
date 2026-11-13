import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { petsTable } from "./pets";
import { providerProfilesTable } from "./providerProfiles";
import { providerServicesTable } from "./providerResources";
import { userProfilesTable } from "./userProfiles";

export const appointmentStatusEnum = pgEnum("petpulse_appointment_status", [
  "pending",
  "confirmed",
  "declined",
  "cancelled",
  "reschedule_pending",
]);

export const appointmentNotificationChannelEnum = pgEnum(
  "petpulse_appointment_notification_channel",
  ["email", "whatsapp"],
);

export const appointmentNotificationStatusEnum = pgEnum(
  "petpulse_appointment_notification_status",
  ["pending", "sending", "sent", "failed", "deferred", "cancelled"],
);

export const appointmentsTable = pgTable(
  "petpulse_appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    providerProfileId: uuid("provider_profile_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => providerServicesTable.id, { onDelete: "cascade" }),
    petId: uuid("pet_id")
      .notNull()
      .references(() => petsTable.id, { onDelete: "cascade" }),
    providerName: text("provider_name").notNull(),
    serviceName: text("service_name").notNull(),
    petName: text("pet_name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    priceCop: integer("price_cop"),
    timezone: text("timezone").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    proposedStartsAt: timestamp("proposed_starts_at", { withTimezone: true }),
    proposedEndsAt: timestamp("proposed_ends_at", { withTimezone: true }),
    previousStatus: appointmentStatusEnum("previous_status"),
    status: appointmentStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("petpulse_appointments_owner_start_idx").on(table.ownerId, table.startsAt),
    index("petpulse_appointments_provider_start_idx").on(
      table.providerProfileId,
      table.startsAt,
    ),
    check(
      "petpulse_appointments_interval_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
    check(
      "petpulse_appointments_duration_check",
      sql`${table.durationMinutes} BETWEEN 5 AND 480`,
    ),
    check(
      "petpulse_appointments_price_check",
      sql`${table.priceCop} IS NULL OR ${table.priceCop} >= 0`,
    ),
    check(
      "petpulse_appointments_reschedule_state_check",
      sql`(${table.status} = 'reschedule_pending' AND ${table.previousStatus} IN ('pending', 'confirmed') AND ${table.proposedStartsAt} IS NOT NULL AND ${table.proposedEndsAt} > ${table.proposedStartsAt}) OR (${table.status} <> 'reschedule_pending' AND ${table.previousStatus} IS NULL AND ${table.proposedStartsAt} IS NULL AND ${table.proposedEndsAt} IS NULL)`,
    ),
  ],
);

export const appointmentNotificationsTable = pgTable(
  "petpulse_appointment_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointmentsTable.id, { onDelete: "cascade" }),
    recipientProfileId: uuid("recipient_profile_id")
      .notNull()
      .references(() => userProfilesTable.id, { onDelete: "cascade" }),
    channel: appointmentNotificationChannelEnum("channel").notNull(),
    destination: text("destination"),
    subject: text("subject"),
    message: text("message").notNull(),
    status: appointmentNotificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("petpulse_appointment_notifications_delivery_idx").on(
      table.channel,
      table.status,
      table.nextAttemptAt,
    ),
    check(
      "petpulse_appointment_notifications_destination_check",
      sql`${table.destination} IS NOT NULL`,
    ),
    check(
      "petpulse_appointment_notifications_attempts_check",
      sql`${table.attempts} >= 0`,
    ),
  ],
);

export type AppointmentRecord = typeof appointmentsTable.$inferSelect;
export type InsertAppointmentRecord = typeof appointmentsTable.$inferInsert;
export type AppointmentNotificationRecord =
  typeof appointmentNotificationsTable.$inferSelect;
