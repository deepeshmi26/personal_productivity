import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const responsesTable = pgTable("responses", {
  id: serial("id").primaryKey(),
  text: text("text").notNull().default(""),
  skipped: boolean("skipped").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResponseSchema = createInsertSchema(responsesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertResponse = z.infer<typeof insertResponseSchema>;
export type LearningResponseRow = typeof responsesTable.$inferSelect;
