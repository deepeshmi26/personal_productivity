import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { responsesTable } from "./responses";

export const responseProcessingJobStatusEnum = pgEnum("response_processing_job_status", [
    "pending",
    "running",
    "completed",
    "failed",
]);


export const responseProcessingJobsTable = pgTable("response_processing_jobs", {
    id: serial("id").primaryKey(),
    responseId: integer("response_id")
        .notNull()
        .unique()
        .references(() => responsesTable.id, { onDelete: "cascade" }),
    status: responseProcessingJobStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    priority: integer("priority").notNull().default(0),
    // backfill: -10
    // normal live response: 0
    // session-needed recent response: 10
    // manual repair: 50
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),

});

export type ResponseProcessingJobRow = typeof responseProcessingJobsTable.$inferSelect