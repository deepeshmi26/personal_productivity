CREATE TYPE "public"."question_generation_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"skipped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"reminder_interval_minutes" integer DEFAULT 5 NOT NULL,
	"quiet_hours_enabled" boolean DEFAULT false NOT NULL,
	"quiet_hours_start" varchar(5) DEFAULT '22:00' NOT NULL,
	"quiet_hours_end" varchar(5) DEFAULT '07:00' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"response_id" integer NOT NULL,
	"result" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"response_id" integer NOT NULL,
	"question" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_questions_response_id_unique" UNIQUE("response_id")
);
--> statement-breakpoint
CREATE TABLE "card_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"response_id" integer NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"due_date" date DEFAULT CURRENT_DATE NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_schedules_response_id_unique" UNIQUE("response_id")
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"label_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_threads" (
	"response_id" integer NOT NULL,
	"thread_id" integer NOT NULL,
	"confidence" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "response_threads_response_id_thread_id_pk" PRIMARY KEY("response_id","thread_id"),
	CONSTRAINT "response_threads_confidence_range" CHECK ("response_threads"."confidence" >= 0 AND "response_threads"."confidence" <= 1)
);
--> statement-breakpoint
CREATE TABLE "question_generation_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"response_id" integer NOT NULL,
	"status" "question_generation_job_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_generation_jobs_response_id_unique" UNIQUE("response_id")
);
--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_questions" ADD CONSTRAINT "card_questions_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_schedules" ADD CONSTRAINT "card_schedules_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_threads" ADD CONSTRAINT "response_threads_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_threads" ADD CONSTRAINT "response_threads_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_generation_jobs" ADD CONSTRAINT "question_generation_jobs_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;