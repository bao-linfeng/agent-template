CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"realm" varchar(16),
	"actor_id" uuid,
	"actor_email" varchar(255),
	"action" varchar(200) NOT NULL,
	"method" varchar(10) NOT NULL,
	"route" text NOT NULL,
	"path" text NOT NULL,
	"resource_id" varchar(100),
	"params" jsonb,
	"query" jsonb,
	"body" jsonb,
	"status_code" integer NOT NULL,
	"error_code" varchar(64),
	"duration_ms" integer NOT NULL,
	"ip" varchar(64),
	"user_agent" text,
	"request_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_index" ON "audit_logs" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_created_at_index" ON "audit_logs" USING btree ("actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_at_index" ON "audit_logs" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_resource_id_index" ON "audit_logs" USING btree ("resource_id") WHERE "audit_logs"."resource_id" is not null;