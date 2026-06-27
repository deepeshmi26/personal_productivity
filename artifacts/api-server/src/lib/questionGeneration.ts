import { logger } from "./logger";
import type { openai as OpenAIInstance } from "@workspace/integrations-openai-ai-server";

const QUESTION_TIMEOUT_MS = 8000;

type OpenAIClient = typeof OpenAIInstance;
let clientPromise: Promise<OpenAIClient | null> | null = null;

function getOpenAIClientPromise(): Promise<OpenAIClient | null> {
  if (!clientPromise) {
    clientPromise = import("@workspace/integrations-openai-ai-server")
      .then((m) => m.openai)
      .catch((err: unknown) => {
        logger.warn({ err }, "OpenAI client unavailable — AI questions disabled");
        return null;
      });
  }
  return clientPromise;
}

export async function generateQuestion(text: string): Promise<string> {
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
