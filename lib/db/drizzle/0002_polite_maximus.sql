CREATE TABLE "petpulse_provider_approval_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"actor_profile_id" uuid,
	"actor_email" text NOT NULL,
	"previous_status" "petpulse_provider_approval_status" NOT NULL,
	"approval_status" "petpulse_provider_approval_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "petpulse_provider_approval_audit" ADD CONSTRAINT "petpulse_provider_approval_audit_provider_profile_id_petpulse_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."petpulse_provider_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "petpulse_provider_approval_audit" ADD CONSTRAINT "petpulse_provider_approval_audit_actor_profile_id_petpulse_user_profiles_id_fk" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."petpulse_user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "petpulse_provider_approval_audit_provider_idx" ON "petpulse_provider_approval_audit" USING btree ("provider_profile_id");
