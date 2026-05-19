import { Router, type IRouter } from "express";
import { db, responsesTable, cardReviewsTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/cards/session", async (_req, res) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [responses, allReviews] = await Promise.all([
    db
      .select()
      .from(responsesTable)
      .where(
        and(
          eq(responsesTable.skipped, false),
          gte(responsesTable.createdAt, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(responsesTable.createdAt)),
    db
      .select({
        responseId: cardReviewsTable.responseId,
        result: cardReviewsTable.result,
        reviewedAt: cardReviewsTable.reviewedAt,
      })
      .from(cardReviewsTable)
      .orderBy(desc(cardReviewsTable.reviewedAt)),
  ]);

  const lastResult = new Map<number, string>();
  for (const r of allReviews) {
    if (!lastResult.has(r.responseId)) {
      lastResult.set(r.responseId, r.result);
    }
  }

  const priority = (id: number): number => {
    const r = lastResult.get(id);
    if (r === "forgot") return 0;
    if (r === undefined) return 1;
    return 2;
  };

  const shuffled = [...responses].sort(() => Math.random() - 0.5);
  shuffled.sort((a, b) => priority(a.id) - priority(b.id));
  const session = shuffled.slice(0, 10);

  res.json(
    session.map((r) => ({
      id: r.id,
      text: r.text,
      skipped: r.skipped,
      createdAt: r.createdAt.toISOString(),
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
