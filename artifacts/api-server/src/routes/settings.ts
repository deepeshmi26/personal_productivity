import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const SETTINGS_ID = 1;

async function ensureSettings() {
  const existing = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID))
    .limit(1);
  if (existing.length > 0 && existing[0]) return existing[0];
  const [row] = await db
    .insert(settingsTable)
    .values({ id: SETTINGS_ID, reminderIntervalMinutes: 5 })
    .returning();
  if (!row) throw new Error("Failed to create settings");
  return row;
}

router.get("/settings", async (_req, res) => {
  const row = await ensureSettings();
  res.json({ reminderIntervalMinutes: row.reminderIntervalMinutes });
});

router.put("/settings", async (req, res) => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await ensureSettings();
  const [row] = await db
    .update(settingsTable)
    .set({ reminderIntervalMinutes: parsed.data.reminderIntervalMinutes })
    .where(eq(settingsTable.id, SETTINGS_ID))
    .returning();
  if (!row) {
    res.status(500).json({ error: "Update failed" });
    return;
  }
  res.json({ reminderIntervalMinutes: row.reminderIntervalMinutes });
});

export default router;
