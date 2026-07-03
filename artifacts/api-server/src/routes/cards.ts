import { Router, type IRouter } from "express";
import {
  db,
  responsesTable,
  cardReviewsTable,
  cardQuestionsTable,
  cardSchedulesTable,
  responseProcessingJobsTable,
} from "@workspace/db";
import { eq, lte, desc, gt, gte, and, isNull, sql, inArray } from "drizzle-orm";

const router: IRouter = Router();

// New cards introduced per session. Wrong-answer and due-correct cards are
// unlimited — they grow/shrink based on what's actually due that day.
const NEW_CARDS_PER_SESSION = 20;

// ─── Spaced-repetition schedule ───────────────────────────────────────────────
// After a correct answer the card advances to the next interval.
// After a wrong answer it resets to 0 (due every day until correct again).
const SRS_INTERVALS = [1, 2, 3, 7, 14, 30]; // days

function nextIntervalDays(current: number): number {
  for (const i of SRS_INTERVALS) {
    if (current < i) return i;
  }
  return 30; // already at max
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!; // YYYY-MM-DD
}

function dueDateStr(addDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  return d.toISOString().split("T")[0]!;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.get("/cards/session", async (_req, res) => {
  const today = todayStr();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  // Bucket 1: wrong-answer cards (interval = 0, due today or overdue)
  const wrongCards = await db
    .select({
      id: responsesTable.id,
      text: responsesTable.text,
      skipped: responsesTable.skipped,
      createdAt: responsesTable.createdAt,
      question: cardQuestionsTable.question,
    })
    .from(cardSchedulesTable)
    .innerJoin(responsesTable, eq(cardSchedulesTable.responseId, responsesTable.id))
    .innerJoin(cardQuestionsTable, eq(cardQuestionsTable.responseId, responsesTable.id))
    .where(
      and(
        eq(responsesTable.skipped, false),
        eq(cardSchedulesTable.intervalDays, 0),
        lte(cardSchedulesTable.dueDate, today),
      ),
    );

  // Bucket 2: new cards — no schedule yet, last 30 days, not skipped
  const newCards = await db
    .select({
      id: responsesTable.id,
      text: responsesTable.text,
      skipped: responsesTable.skipped,
      createdAt: responsesTable.createdAt,
      question: cardQuestionsTable.question,
    })
    .from(responsesTable)
    .leftJoin(cardSchedulesTable, eq(responsesTable.id, cardSchedulesTable.responseId))
    .innerJoin(cardQuestionsTable, eq(cardQuestionsTable.responseId, responsesTable.id))
    .where(
      and(
        eq(responsesTable.skipped, false),
        gte(responsesTable.createdAt, thirtyDaysAgo),
        isNull(cardSchedulesTable.id),
      ),
    );

  // Bucket 3: correct-answer cards due today (interval > 0, due today or overdue)
  const dueCorrectCards = await db
    .select({
      id: responsesTable.id,
      text: responsesTable.text,
      skipped: responsesTable.skipped,
      createdAt: responsesTable.createdAt,
      question: cardQuestionsTable.question,
    })
    .from(cardSchedulesTable)
    .innerJoin(responsesTable, eq(cardSchedulesTable.responseId, responsesTable.id))
    .innerJoin(cardQuestionsTable, eq(cardQuestionsTable.responseId, responsesTable.id))
    .where(
      and(
        eq(responsesTable.skipped, false),
        gt(cardSchedulesTable.intervalDays, 0),
        lte(cardSchedulesTable.dueDate, today),
      ),
    );

  let highPriorityRows = await db
    .select({ id: responseProcessingJobsTable.id })
    .from(responseProcessingJobsTable)
    .where(
      and(
        inArray(responseProcessingJobsTable.status, ["pending", "running"]),
        eq(responseProcessingJobsTable.priority, 10)
      )
    )
    .limit(10);

  if (10 - highPriorityRows.length > 0) {
    const rowsToBoost = await db
      .select({ id: responseProcessingJobsTable.id })
      .from(responseProcessingJobsTable)
      .innerJoin(responsesTable, eq(responseProcessingJobsTable.responseId, responsesTable.id))
      .leftJoin(cardQuestionsTable, eq(cardQuestionsTable.responseId, responsesTable.id))
      .where(
        and(
          eq(responseProcessingJobsTable.status, "pending"),
          eq(responsesTable.skipped, false),
          isNull(cardQuestionsTable.id) // Only include responses where question hasn't been generated yet
        )
      )
      .orderBy(desc(responseProcessingJobsTable.createdAt)) // latest to oldest
      .limit(10 - highPriorityRows.length);



    if (rowsToBoost.length > 0) {
      await db
        .update(responseProcessingJobsTable)
        .set({ priority: 10 })
        .where(
          inArray(
            responseProcessingJobsTable.id,
            rowsToBoost.map((row) => row.id),
          ),
        );
      highPriorityRows = highPriorityRows.concat(rowsToBoost);
    }
  }


  // Ordered: wrong → new (capped) → due correct (shuffled within each bucket)
  const session = [
    ...shuffle(wrongCards),
    ...shuffle(newCards).slice(0, NEW_CARDS_PER_SESSION),
    ...shuffle(dueCorrectCards),
  ];

  res.json({
    cards: session.map((r) => ({
      id: r.id,
      text: r.text,
      skipped: r.skipped,
      createdAt: r.createdAt.toISOString(),
      question: r.question,
    })),
    isProcessing: highPriorityRows.length > 0,
  });
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

  // Record raw review history
  await db.insert(cardReviewsTable).values({ responseId, result });

  // Update SRS schedule
  const [current] = await db
    .select({ intervalDays: cardSchedulesTable.intervalDays })
    .from(cardSchedulesTable)
    .where(eq(cardSchedulesTable.responseId, responseId))
    .limit(1);

  let newIntervalDays: number;
  let newDueDate: string;

  if (result === "forgot") {
    newIntervalDays = 0;
    newDueDate = todayStr(); // overdue immediately → appears every day
  } else {
    newIntervalDays = nextIntervalDays(current?.intervalDays ?? 0);
    newDueDate = dueDateStr(newIntervalDays);
  }

  await db
    .insert(cardSchedulesTable)
    .values({ responseId, intervalDays: newIntervalDays, dueDate: newDueDate })
    .onConflictDoUpdate({
      target: cardSchedulesTable.responseId,
      set: {
        intervalDays: newIntervalDays,
        dueDate: newDueDate,
        updatedAt: sql`NOW()`,
      },
    });

  res.status(204).send();
});

export default router;
