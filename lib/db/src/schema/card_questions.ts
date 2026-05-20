import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { responsesTable } from "./responses";

export const cardQuestionsTable = pgTable(
  "card_questions",
  {
    id: serial("id").primaryKey(),
    responseId: integer("response_id")
      .notNull()
      .references(() => responsesTable.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("card_questions_response_id_unique").on(t.responseId)],
);

export type CardQuestionRow = typeof cardQuestionsTable.$inferSelect;
