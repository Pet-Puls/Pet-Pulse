CREATE TABLE "petpulse_provider_availability" (
	"provider_profile_id" uuid PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"weekly_windows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "petpulse_provider_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"price_cop" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "petpulse_provider_services_duration_check" CHECK ("petpulse_provider_services"."duration_minutes" BETWEEN 5 AND 480),
	CONSTRAINT "petpulse_provider_services_price_check" CHECK ("petpulse_provider_services"."price_cop" IS NULL OR "petpulse_provider_services"."price_cop" >= 0)
);
--> statement-breakpoint
ALTER TABLE "petpulse_provider_availability" ADD CONSTRAINT "petpulse_provider_availability_provider_profile_id_petpulse_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."petpulse_provider_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpulse_provider_services" ADD CONSTRAINT "petpulse_provider_services_provider_profile_id_petpulse_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."petpulse_provider_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "petpulse_provider_services_profile_idx" ON "petpulse_provider_services" USING btree ("provider_profile_id");