CREATE TYPE "public"."petpulse_lost_pet_report_status" AS ENUM('active', 'closed', 'expired');--> statement-breakpoint
CREATE TABLE "petpulse_lost_pet_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pet_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"location_description" text NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"notes" text,
	"consented_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "petpulse_lost_pet_report_status" DEFAULT 'active' NOT NULL,
	"previous_pet_status" "petpulse_pet_status" NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petpulse_lost_pet_reports" ADD CONSTRAINT "petpulse_lost_pet_reports_pet_id_petpulse_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."petpulse_pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpulse_lost_pet_reports" ADD CONSTRAINT "petpulse_lost_pet_reports_owner_id_petpulse_user_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."petpulse_user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "petpulse_lost_pet_reports_active_pet_idx" ON "petpulse_lost_pet_reports" USING btree ("pet_id") WHERE "petpulse_lost_pet_reports"."status" = 'active';--> statement-breakpoint
CREATE INDEX "petpulse_lost_pet_reports_owner_created_idx" ON "petpulse_lost_pet_reports" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "petpulse_lost_pet_reports_status_expires_idx" ON "petpulse_lost_pet_reports" USING btree ("status","expires_at");