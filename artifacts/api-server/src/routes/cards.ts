import { Router, type IRouter } from "express";
import { db, responsesTable, cardReviewsTable } from "@workspace/db";
import { eq, desc, sql, and, gte, isNull } from "drizzle-orm";

const router: IRouter = Router();

router.get("/cards/session", async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db.execute(sql`
    WITH recent AS (
      SELECT r.id, r.text, r.skipped, r.created_at
      FROM responses r
      WHERE r.skipped = false
        AND r.created_at >= ${thirtyDaysAgo.toISOString()}
    ),
    last_review AS (
      SELECT DISTINCT ON (cr.response_id)
        cr.response_id,
        cr.result,
        cr.reviewed_at
      FROM card_reviews cr
      ORDER BY cr.response_id, cr.reviewed_at DESC
    )
    SELECT
      recent.id,
      recent.text,
      recent.skipped,
      recent.created_at AS "createdAt",
      CASE
        WHEN lr.result = 'forgot' THEN 0
        WHEN lr.result IS NULL     THEN 1
        ELSE                            2
      END AS priority,
      lr.reviewed_at
    FROM recent
    LEFT JOIN last_review lr ON lr.response_id = recent.id
    ORDER BY priority ASC, RANDOM()
    LIMIT 10
  `);

  type Row = { id: number; text: string; skipped: boolean; createdAt: Date };
  const rowArr = (rows as unknown as { rows: Row[] }).rows ?? (rows as unknown as Row[]);
  res.json(
    rowArr.map((r) => ({
      id: r.id,
      text: r.text,
      skipped: r.skipped,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
  );
});

router.post("/cards/:responseId/review", async (req, res) => {
  const responseId = parseInt(req.params["responseId"] ?? "", 10);
  if (isNaN(responseId)) {
    res.status(400).json({ error: "Invalid responseId" });
    return;
  }

  const result = req.body?.result;
  if (result !== "remembered" && result !== "forgot") {
    res.status(400).json({ error: "result must be 'remembered' or 'forgot'" });
    return;
  }

  const existing = await db
    .select({ id: responsesTable.id })
    .from(responsesTable)
    .where(eq(responsesTable.id, responseId))
    .limit(1);

  if (!existing.length) {
    res.status(404).json({ error: "Response not found" });
    return;
  }

  await db.insert(cardReviewsTable).values({ responseId, result });
  res.status(204).send();
});

export default router;
