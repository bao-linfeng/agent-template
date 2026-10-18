CREATE TYPE "public"."announcement_audience" AS ENUM('all', 'user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."announcement_level" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TABLE "admin_announcement_reads" (
	"account_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_announcement_reads_account_id_announcement_id_pk" PRIMARY KEY("account_id","announcement_id")
);
--> statement-breakpoint
CREATE TABLE "admin_notification_preferences" (
	"account_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"channels" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_notification_preferences_account_id_category_pk" PRIMARY KEY("account_id","category")
);
--> statement-breakpoint
CREATE TABLE "admin_notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"link" varchar(500),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"level" "announcement_level" DEFAULT 'info' NOT NULL,
	"audience" "announcement_audience" DEFAULT 'all' NOT NULL,
	"published_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_announcement_reads" (
	"account_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_announcement_reads_account_id_announcement_id_pk" PRIMARY KEY("account_id","announcement_id")
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"account_id" uuid NOT NULL,
	"category" varchar(50) NOT NULL,
	"channels" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_preferences_account_id_category_pk" PRIMARY KEY("account_id","category")
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"link" varchar(500),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_announcement_reads" ADD CONSTRAINT "admin_announcement_reads_account_id_admin_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_announcement_reads" ADD CONSTRAINT "admin_announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notification_preferences" ADD CONSTRAINT "admin_notification_preferences_account_id_admin_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_recipient_id_admin_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_updated_by_admin_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_announcement_reads" ADD CONSTRAINT "user_announcement_reads_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_announcement_reads" ADD CONSTRAINT "user_announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_announcement_reads_announcement_id_idx" ON "admin_announcement_reads" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "admin_notifications_recipient_created_idx" ON "admin_notifications" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_notifications_unread_idx" ON "admin_notifications" USING btree ("recipient_id") WHERE "admin_notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "admin_notifications_created_at_idx" ON "admin_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "announcements_published_at_index" ON "announcements" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_announcement_reads_announcement_id_idx" ON "user_announcement_reads" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "user_notifications_recipient_created_idx" ON "user_notifications" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notifications_unread_idx" ON "user_notifications" USING btree ("recipient_id") WHERE "user_notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "user_notifications_created_at_idx" ON "user_notifications" USING btree ("created_at");