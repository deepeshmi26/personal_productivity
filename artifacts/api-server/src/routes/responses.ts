import { Router, type IRouter } from "express";
import { db, responsesTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { CreateResponseBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/responses", async (_req, res) => {
  const rows = await db
    .select()
    .from(responsesTable)
    .orderBy(desc(responsesTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      text: r.text,
      skipped: r.skipped,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/responses", async (req, res) => {
  const parsed = CreateResponseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [row] = await db
    .insert(responsesTable)
    .values({
      text: parsed.data.text,
      skipped: parsed.data.skipped,
    })
    .returning();
  if (!row) {
    res.status(500).json({ error: "Insert failed" });
    return;
  }
  res.status(201).json({
    id: row.id,
    text: row.text,
    skipped: row.skipped,
    createdAt: row.createdAt.toISOString(),
  });
});

router.get("/responses/stats", async (_req, res) => {
  const totals = await db
    .select({
      total: sql<number>`count(*)::int`,
      answered: sql<number>`sum(case when ${responsesTable.skipped} = false then 1 else 0 end)::int`,
      skipped: sql<number>`sum(case when ${responsesTable.skipped} = true then 1 else 0 end)::int`,
    })
    .from(responsesTable);

  const days = await db
    .select({
      date: sql<string>`to_char(${responsesTable.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(responsesTable)
    .groupBy(sql`to_char(${responsesTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${responsesTable.createdAt}, 'YYYY-MM-DD') desc`)
    .limit(30);

  const t = totals[0] ?? { total: 0, answered: 0, skipped: 0 };
  res.json({
    total: t.total ?? 0,
    answered: t.answered ?? 0,
    skipped: t.skipped ?? 0,
    days: days.map((d) => ({ date: d.date, count: d.count ?? 0 })),
  });
});

export default router;
