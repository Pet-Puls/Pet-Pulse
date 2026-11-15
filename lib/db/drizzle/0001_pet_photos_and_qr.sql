ALTER TABLE "petpulse_pets" ADD COLUMN "photo_path" text;
--> statement-breakpoint
ALTER TABLE "petpulse_pets" ADD COLUMN "qr_token" text;
--> statement-breakpoint
ALTER TABLE "petpulse_pets" ADD COLUMN "share_emergency_contact" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "petpulse_pets_qr_token_idx" ON "petpulse_pets" USING btree ("qr_token");
