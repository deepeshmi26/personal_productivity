import { pgTable, integer, serial } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  reminderIntervalMinutes: integer("reminder_interval_minutes").notNull().default(5),
});

export type SettingsRow = typeof settingsTable.$inferSelect;
