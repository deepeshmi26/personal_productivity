import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const threadsTable = pgTable(
    "threads",
    {
        id: serial("id").primaryKey(),
        label: text("label").notNull(),
        labelLocked: boolean("label_locked").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),

    },
)

export type ThreadRow = typeof threadsTable.$inferSelect;