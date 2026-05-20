import { pgTable, serial, integer, date, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { responsesTable } from "./responses";

export const cardSchedulesTable = pgTable("card_schedules", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id")
    .notNull()
    .unique()
    .references(() => responsesTable.id, { onDelete: "cascade" }),
  intervalDays: integer("interval_days").notNull().default(0),
  dueDate: date("due_date").notNull().default(sql`CURRENT_DATE`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CardScheduleRow = typeof cardSchedulesTable.$inferSelect;
