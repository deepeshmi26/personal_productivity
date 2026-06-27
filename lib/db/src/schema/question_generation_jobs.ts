import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { responsesTable } from "./responses";

export const questionGenerationJobStatusEnum = pgEnum("question_generation_job_status", [
    "pending",
    "running",
    "completed",
    "failed",
]);


export const questionGenerationJobsTable = pgTable("question_generation_jobs", {
    id: serial("id").primaryKey(),
    responseId: integer("response_id")
        .notNull()
        .unique()
        .references(() => responsesTable.id, { onDelete: "cascade" }),
    status: questionGenerationJobStatusEnum("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),

});

export type QuestionGenerationJobRow = typeof questionGenerationJobsTable.$inferSelect