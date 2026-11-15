CREATE TYPE "public"."petpulse_appointment_notification_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."petpulse_appointment_notification_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'deferred', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."petpulse_appointment_status" AS ENUM('pending', 'confirmed', 'declined', 'cancelled', 'reschedule_pending');--> statement-breakpoint
CREATE TABLE "petpulse_appointment_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"recipient_profile_id" uuid NOT NULL,
	"channel" "petpulse_appointment_notification_channel" NOT NULL,
	"destination" text,
	"subject" text,
	"message" text NOT NULL,
	"status" "petpulse_appointment_notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petpulse_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"pet_id" uuid NOT NULL,
	"provider_name" text NOT NULL,
	"service_name" text NOT NULL,
	"pet_name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"price_cop" integer,
	"timezone" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"proposed_starts_at" timestamp with time zone,
	"proposed_ends_at" timestamp with time zone,
	"previous_status" "petpulse_appointment_status",
	"status" "petpulse_appointment_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "petpulse_appointments_interval_check" CHECK ("petpulse_appointments"."ends_at" > "petpulse_appointments"."starts_at"),
	CONSTRAINT "petpulse_appointments_duration_check" CHECK ("petpulse_appointments"."duration_minutes" BETWEEN 5 AND 480),
	CONSTRAINT "petpulse_appointments_price_check" CHECK ("petpulse_appointments"."price_cop" IS NULL OR "petpulse_appointments"."price_cop" >= 0)
);
--> statement-breakpoint
ALTER TABLE "petpulse_user_profiles" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "petpulse_user_profiles" ADD COLUMN "whatsapp_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "petpulse_user_profiles" ADD COLUMN "whatsapp_opt_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "petpulse_appointment_notifications" ADD CONSTRAINT "petpulse_appointment_notifications_appointment_id_petpulse_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."petpulse_appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpulse_appointment_notifications" ADD CONSTRAINT "petpulse_appointment_notifications_recipient_profile_id_petpulse_user_profiles_id_fk" FOREIGN KEY ("recipient_profile_id") REFERENCES "public"."petpulse_user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpulse_appointments" ADD CONSTRAINT "petpulse_appointments_owner_id_petpulse_user_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."petpulse_user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpulse_appointments" ADD CONSTRAINT "petpulse_appointments_provider_profile_id_petpulse_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."petpulse_provider_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpulse_appointments" ADD CONSTRAINT "petpulse_appointments_service_id_petpulse_provider_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."petpulse_provider_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpulse_appointments" ADD CONSTRAINT "petpulse_appointments_pet_id_petpulse_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."petpulse_pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "petpulse_appointment_notifications_delivery_idx" ON "petpulse_appointment_notifications" USING btree ("channel","status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "petpulse_appointments_owner_start_idx" ON "petpulse_appointments" USING btree ("owner_id","starts_at");--> statement-breakpoint
CREATE INDEX "petpulse_appointments_provider_start_idx" ON "petpulse_appointments" USING btree ("provider_profile_id","starts_at");