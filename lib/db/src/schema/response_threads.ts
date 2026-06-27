import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, real, timestamp } from "drizzle-orm/pg-core";
import { responsesTable } from "./responses";
import { threadsTable } from "./threads";

export const responseThreadsTable = pgTable(
    "response_threads",
    {
        responseId: integer("response_id")
            .notNull()
            .references(() => responsesTable.id, { onDelete: "cascade" }),
        threadId: integer("thread_id")
            .notNull()
            .references(() => threadsTable.id, { onDelete: "cascade" }),
        confidence: real("confidence").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (t) => [primaryKey({
        columns: [t.responseId, t.threadId],
        name: "response_threads_response_id_thread_id_pk",
    }),
    check(
        "response_threads_confidence_range",
        sql`${t.confidence} >= 0 AND ${t.confidence} <= 1`,
    )]
)

export type ResponseThreadsRow = typeof responseThreadsTable.$inferSelect;