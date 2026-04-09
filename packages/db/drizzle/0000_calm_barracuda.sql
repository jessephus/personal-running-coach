CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('athlete', 'coach', 'system', 'integration');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."coach_memory_category" AS ENUM('goal', 'injury', 'preference', 'pattern');--> statement-breakpoint
CREATE TYPE "public"."coaching_style" AS ENUM('direct', 'supportive');--> statement-breakpoint
CREATE TYPE "public"."goal_priority" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('telegram', 'dashboard', 'system');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound', 'system');--> statement-breakpoint
CREATE TYPE "public"."raw_import_status" AS ENUM('pending', 'processed', 'failed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."source_connection_status" AS ENUM('pending', 'connected', 'paused', 'error');--> statement-breakpoint
CREATE TYPE "public"."source_provider" AS ENUM('strava', 'telegram', 'manual');--> statement-breakpoint
CREATE TYPE "public"."workout_type" AS ENUM('easy', 'tempo', 'interval', 'long', 'recovery');--> statement-breakpoint
CREATE TABLE "athlete_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_key" text NOT NULL,
	"display_name" text NOT NULL,
	"timezone" text NOT NULL,
	"preferred_long_run_day" text NOT NULL,
	"coaching_style" "coaching_style" NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"injury_flags_ciphertext" text,
	"injury_flags_preview" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"outcome" "audit_outcome" NOT NULL,
	"ip_address_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"category" "coach_memory_category" NOT NULL,
	"title" text NOT NULL,
	"detail_ciphertext" text NOT NULL,
	"detail_summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"source_connection_id" uuid,
	"channel" "message_channel" NOT NULL,
	"direction" "message_direction" NOT NULL,
	"external_message_id" text,
	"body_ciphertext" text NOT NULL,
	"body_preview" text NOT NULL,
	"message_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "completed_workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"raw_import_id" uuid,
	"source" "source_provider" DEFAULT 'strava' NOT NULL,
	"source_workout_id" text,
	"date" date NOT NULL,
	"type" "workout_type" NOT NULL,
	"distance_km" numeric(6, 2) NOT NULL,
	"duration_minutes" integer NOT NULL,
	"perceived_effort" integer NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "completed_workouts_distance_non_negative" CHECK ("completed_workouts"."distance_km" >= 0),
	CONSTRAINT "completed_workouts_duration_positive" CHECK ("completed_workouts"."duration_minutes" > 0),
	CONSTRAINT "completed_workouts_perceived_effort_range" CHECK ("completed_workouts"."perceived_effort" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_date" date NOT NULL,
	"priority" "goal_priority" NOT NULL,
	"notes" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"source_connection_id" uuid,
	"provider" "source_provider" NOT NULL,
	"import_type" text NOT NULL,
	"source_object_id" text,
	"status" "raw_import_status" DEFAULT 'pending' NOT NULL,
	"raw_payload_ciphertext" text NOT NULL,
	"raw_payload_sha256" text NOT NULL,
	"failure_reason" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"provider" "source_provider" NOT NULL,
	"status" "source_connection_status" DEFAULT 'pending' NOT NULL,
	"external_athlete_id" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"access_token_ciphertext" text,
	"refresh_token_ciphertext" text,
	"token_expires_at" timestamp with time zone,
	"webhook_secret_ciphertext" text,
	"connected_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_memories" ADD CONSTRAINT "coach_memories_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_source_connection_id_source_connections_id_fk" FOREIGN KEY ("source_connection_id") REFERENCES "public"."source_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completed_workouts" ADD CONSTRAINT "completed_workouts_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completed_workouts" ADD CONSTRAINT "completed_workouts_raw_import_id_raw_imports_id_fk" FOREIGN KEY ("raw_import_id") REFERENCES "public"."raw_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_imports" ADD CONSTRAINT "raw_imports_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_imports" ADD CONSTRAINT "raw_imports_source_connection_id_source_connections_id_fk" FOREIGN KEY ("source_connection_id") REFERENCES "public"."source_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_athlete_id_athlete_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "athlete_profiles_external_key_idx" ON "athlete_profiles" USING btree ("external_key");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "coach_memories_athlete_category_idx" ON "coach_memories" USING btree ("athlete_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_messages_athlete_channel_external_id_idx" ON "coach_messages" USING btree ("athlete_id","channel","external_message_id");--> statement-breakpoint
CREATE INDEX "coach_messages_athlete_sent_at_idx" ON "coach_messages" USING btree ("athlete_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "completed_workouts_raw_import_idx" ON "completed_workouts" USING btree ("raw_import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "completed_workouts_athlete_source_identity_idx" ON "completed_workouts" USING btree ("athlete_id","source","source_workout_id");--> statement-breakpoint
CREATE INDEX "completed_workouts_athlete_date_idx" ON "completed_workouts" USING btree ("athlete_id","date");--> statement-breakpoint
CREATE INDEX "goals_athlete_target_date_idx" ON "goals" USING btree ("athlete_id","target_date");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_imports_athlete_provider_source_object_idx" ON "raw_imports" USING btree ("athlete_id","provider","source_object_id");--> statement-breakpoint
CREATE INDEX "raw_imports_athlete_status_idx" ON "raw_imports" USING btree ("athlete_id","status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_connections_athlete_provider_idx" ON "source_connections" USING btree ("athlete_id","provider");--> statement-breakpoint
CREATE INDEX "source_connections_status_idx" ON "source_connections" USING btree ("status","provider");
