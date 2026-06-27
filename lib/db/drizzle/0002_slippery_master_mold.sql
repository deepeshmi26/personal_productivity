ALTER TYPE "public"."question_generation_job_status" RENAME TO "response_processing_job_status";--> statement-breakpoint
ALTER TABLE "question_generation_jobs" RENAME TO "response_processing_jobs";--> statement-breakpoint
ALTER TABLE "response_processing_jobs" DROP CONSTRAINT "question_generation_jobs_response_id_unique";--> statement-breakpoint
ALTER TABLE "response_processing_jobs" DROP CONSTRAINT "question_generation_jobs_response_id_responses_id_fk";
--> statement-breakpoint
ALTER TABLE "response_processing_jobs" ADD CONSTRAINT "response_processing_jobs_response_id_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_processing_jobs" ADD CONSTRAINT "response_processing_jobs_response_id_unique" UNIQUE("response_id");