import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { responsesTable } from "./responses";

export const cardReviewsTable = pgTable("card_reviews", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id")
    .notNull()
    .references(() => responsesTable.id, { onDelete: "cascade" }),
  result: text("result").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CardReviewRow = typeof cardReviewsTable.$inferSelect;
