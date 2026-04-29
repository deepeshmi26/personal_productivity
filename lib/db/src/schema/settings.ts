import { pgTable, integer, serial, boolean, varchar } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  reminderIntervalMinutes: integer("reminder_interval_minutes")
    .notNull()
    .default(5),
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 })
    .notNull()
    .default("22:00"),
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 })
    .notNull()
    .default("07:00"),
});

export type SettingsRow = typeof settingsTable.$inferSelect;
