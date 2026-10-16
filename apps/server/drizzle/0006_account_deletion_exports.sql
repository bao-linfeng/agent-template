CREATE TYPE "public"."account_export_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "account_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "account_export_status" DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"size_bytes" integer,
	"error" text,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "deletion_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_exports" ADD CONSTRAINT "account_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_exports_user_id_created_at_index" ON "account_exports" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "account_exports_expires_at_index" ON "account_exports" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_exports_active_unique" ON "account_exports" USING btree ("user_id") WHERE "account_exports"."status" in ('pending', 'processing');--> statement-breakpoint
CREATE INDEX "users_deletion_scheduled_at_idx" ON "users" USING btree ("deletion_scheduled_at") WHERE "users"."deletion_scheduled_at" is not null;