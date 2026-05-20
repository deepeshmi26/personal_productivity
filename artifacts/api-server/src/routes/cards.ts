import { Router, type IRouter } from "express";
import {
  db,
  responsesTable,
  cardReviewsTable,
  cardQuestionsTable,
  cardSchedulesTable,
} from "@workspace/db";
import { eq, lte, gt, gte, and, inArray, isNull, sql } from "drizzle-orm";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";
import { logger } from "../lib/logger";
import type { openai as OpenAIInstance } from "@workspace/integrations-openai-ai-server";

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

// ─── AI question generation ───────────────────────────────────────────────────
const QUESTION_TIMEOUT_MS = 8000;

type OpenAIClient = typeof OpenAIInstance;
let _clientPromise: Promise<OpenAIClient | null> | null = null;

function getOpenAIClientPromise(): Promise<OpenAIClient | null> {
  if (!_clientPromise) {
    _clientPromise = import("@workspace/integrations-openai-ai-server")
      .then((m) => m.openai)
      .catch((err: unknown) => {
        logger.warn({ err }, "OpenAI client unavailable — AI questions disabled");
        return null;
      });
  }
  return _clientPromise;
}

async function generateQuestion(text: string): Promise<string> {
  const client = await getOpenAIClientPromise();
  if (!client) return "";

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Question generation timed out")),
      QUESTION_TIMEOUT_MS,
    ),
  );

  const aiCall = client.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a spaced-repetition quiz assistant. Given a learning note, write a single, concise quiz question (max 15 words) that tests whether the learner can recall the key insight. Return only the question, no explanation.",
      },
      { role: "user", content: text },
    ],
  });

  const response = await Promise.race([aiCall, timeout]);
  const choice = response.choices[0];
  logger.debug(
    { finishReason: choice?.finish_reason, content: choice?.message?.content },
    "AI question response",
  );
  return choice?.message?.content?.trim() ?? "";
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
    })
    .from(cardSchedulesTable)
    .innerJoin(responsesTable, eq(cardSchedulesTable.responseId, responsesTable.id))
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
    })
    .from(responsesTable)
    .leftJoin(cardSchedulesTable, eq(responsesTable.id, cardSchedulesTable.responseId))
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
    })
    .from(cardSchedulesTable)
    .innerJoin(responsesTable, eq(cardSchedulesTable.responseId, responsesTable.id))
    .where(
      and(
        eq(responsesTable.skipped, false),
        gt(cardSchedulesTable.intervalDays, 0),
        lte(cardSchedulesTable.dueDate, today),
      ),
    );

  // Ordered: wrong → new (capped) → due correct (shuffled within each bucket)
  const session = [
    ...shuffle(wrongCards),
    ...shuffle(newCards).slice(0, NEW_CARDS_PER_SESSION),
    ...shuffle(dueCorrectCards),
  ];

  if (session.length === 0) {
    res.json([]);
    return;
  }

  const sessionIds = session.map((r) => r.id);

  // Attach only already-cached AI questions — respond immediately, don't block on AI
  const cachedQuestions = await db
    .select()
    .from(cardQuestionsTable)
    .where(inArray(cardQuestionsTable.responseId, sessionIds));

  const questionMap = new Map<number, string>(
    cachedQuestions.map((q) => [q.responseId, q.question]),
  );

  // Fire-and-forget: generate questions for uncached cards in the background.
  // On the next session load they'll already be cached.
  const uncached = session.filter((r) => !questionMap.has(r.id));
  if (uncached.length > 0) {
    void (async () => {
      try {
        const results = await batchProcess(
          uncached,
          async (card: { id: number; text: string; skipped: boolean; createdAt: Date }) => {
            try {
              const question = await generateQuestion(card.text);
              if (!question) logger.warn({ responseId: card.id }, "AI returned empty question");
              return question ? { responseId: card.id, question } : null;
            } catch (err) {
              logger.error({ responseId: card.id, err }, "Failed to generate question");
              return null;
            }
          },
          { concurrency: 2, retries: 3 },
        );
        const toInsert = results.filter(
          (r): r is { responseId: number; question: string } => r !== null && !!r.question,
        );
        if (toInsert.length > 0) {
          await db.insert(cardQuestionsTable).values(toInsert).onConflictDoNothing();
          logger.info({ count: toInsert.length }, "Background: cached new AI questions");
        }
      } catch (err) {
        logger.error({ err }, "Background question generation failed");
      }
    })();
  }

  res.json(
    session.map((r) => ({
      id: r.id,
      text: r.text,
      skipped: r.skipped,
      createdAt: r.createdAt.toISOString(),
      question: questionMap.get(r.id) ?? "",
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
