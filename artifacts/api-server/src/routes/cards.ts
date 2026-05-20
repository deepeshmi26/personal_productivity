import { Router, type IRouter } from "express";
import { db, responsesTable, cardReviewsTable, cardQuestionsTable } from "@workspace/db";
import { eq, desc, gte, and, inArray } from "drizzle-orm";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";
import { logger } from "../lib/logger";
import type { openai as OpenAIInstance } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

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
      {
        role: "user",
        content: text,
      },
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

router.get("/cards/session", async (req, res) => {
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

  if (session.length === 0) {
    res.json([]);
    return;
  }

  const sessionIds = session.map((r) => r.id);

  const cachedQuestions = await db
    .select()
    .from(cardQuestionsTable)
    .where(inArray(cardQuestionsTable.responseId, sessionIds));

  const questionMap = new Map<number, string>(
    cachedQuestions.map((q) => [q.responseId, q.question]),
  );

  const uncached = session.filter((r) => !questionMap.has(r.id));

  if (uncached.length > 0) {
    const results = await batchProcess(
      uncached,
      async (card) => {
        try {
          const question = await generateQuestion(card.text);
          if (!question) {
            logger.warn({ responseId: card.id }, "AI returned empty question");
          }
          return question ? { responseId: card.id, question } : null;
        } catch (err) {
          logger.error({ responseId: card.id, err }, "Failed to generate question");
          return null;
        }
      },
      { concurrency: 2, retries: 3 },
    );

    const toInsert: { responseId: number; question: string }[] = [];
    for (const result of results) {
      if (result && result.question) {
        questionMap.set(result.responseId, result.question);
        toInsert.push(result);
      }
    }

    if (toInsert.length > 0) {
      await db
        .insert(cardQuestionsTable)
        .values(toInsert)
        .onConflictDoNothing();
    }
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

  await db.insert(cardReviewsTable).values({ responseId, result });
  res.status(204).send();
});

export default router;
