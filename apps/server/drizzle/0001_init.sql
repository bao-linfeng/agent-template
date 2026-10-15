CREATE TYPE "public"."embedding_provider" AS ENUM('openai_compatible');--> statement-breakpoint
CREATE TYPE "public"."rag_document_source" AS ENUM('file', 'text');--> statement-breakpoint
CREATE TYPE "public"."rag_document_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "ai_embedding_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"provider" "embedding_provider" DEFAULT 'openai_compatible' NOT NULL,
	"base_url" text NOT NULL,
	"model" varchar(200) NOT NULL,
	"dimensions" integer NOT NULL,
	"api_key_encrypted" text,
	"batch_size" integer DEFAULT 32 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_embedding_models_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"previous_refresh_token_hash" text,
	"rotated_at" timestamp with time zone,
	"user_agent" text,
	"ip" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"request_ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"embedding_model_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dimensions" integer NOT NULL,
	"embedding" vector NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"source" "rag_document_source" NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" "rag_document_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL,
	"embedding_model_id" uuid NOT NULL,
	"chunk_size" integer DEFAULT 800 NOT NULL,
	"chunk_overlap" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"nickname" varchar(50) NOT NULL,
	"avatar_key" text,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_knowledge_base_id_rag_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."rag_knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_embedding_model_id_ai_embedding_models_id_fk" FOREIGN KEY ("embedding_model_id") REFERENCES "public"."ai_embedding_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_knowledge_base_id_rag_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."rag_knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_knowledge_bases" ADD CONSTRAINT "rag_knowledge_bases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_knowledge_bases" ADD CONSTRAINT "rag_knowledge_bases_embedding_model_id_ai_embedding_models_id_fk" FOREIGN KEY ("embedding_model_id") REFERENCES "public"."ai_embedding_models"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_embedding_models_single_default" ON "ai_embedding_models" USING btree ("is_default") WHERE "ai_embedding_models"."is_default";--> statement-breakpoint
CREATE INDEX "auth_sessions_user_id_index" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_index" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rag_chunks_knowledge_base_id_index" ON "rag_chunks" USING btree ("knowledge_base_id");--> statement-breakpoint
CREATE INDEX "rag_chunks_document_id_index" ON "rag_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "rag_documents_knowledge_base_id_index" ON "rag_documents" USING btree ("knowledge_base_id");--> statement-breakpoint
CREATE INDEX "rag_knowledge_bases_owner_id_index" ON "rag_knowledge_bases" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_index" ON "user_roles" USING btree ("role_id");