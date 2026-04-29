import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const SETTINGS_ID = 1;

const DEFAULT_SETTINGS = {
  id: SETTINGS_ID,
  reminderIntervalMinutes: 5,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

async function ensureSettings() {
  const existing = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID))
    .limit(1);
  if (existing.length > 0 && existing[0]) return existing[0];
  const [row] = await db
    .insert(settingsTable)
    .values(DEFAULT_SETTINGS)
    .returning();
  if (!row) throw new Error("Failed to create settings");
  return row;
}

function serialize(row: typeof settingsTable.$inferSelect) {
  return {
    reminderIntervalMinutes: row.reminderIntervalMinutes,
    quietHoursEnabled: row.quietHoursEnabled,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
  };
}

router.get("/settings", async (_req, res) => {
  const row = await ensureSettings();
  res.json(serialize(row));
});

router.put("/settings", async (req, res) => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await ensureSettings();
  const updates: Partial<typeof settingsTable.$inferInsert> = {};
  if (parsed.data.reminderIntervalMinutes !== undefined) {
    updates.reminderIntervalMinutes = parsed.data.reminderIntervalMinutes;
  }
  if (parsed.data.quietHoursEnabled !== undefined) {
    updates.quietHoursEnabled = parsed.data.quietHoursEnabled;
  }
  if (parsed.data.quietHoursStart !== undefined) {
    updates.quietHoursStart = parsed.data.quietHoursStart;
  }
  if (parsed.data.quietHoursEnd !== undefined) {
    updates.quietHoursEnd = parsed.data.quietHoursEnd;
  }
  const [row] = await db
    .update(settingsTable)
    .set(updates)
    .where(eq(settingsTable.id, SETTINGS_ID))
    .returning();
  if (!row) {
    res.status(500).json({ error: "Update failed" });
    return;
  }
  res.json(serialize(row));
});

export default router;
