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
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a spaced-repetition quiz assistant. Given a learning note, write a single, concise quiz question (max 15 words) that tests whether the learner can recall the key insight. Return only the question, no explanation.",
      },
      { role: "user", content: text },
    ],
    max_tokens: 3
  });

  const response = await Promise.race([aiCall, timeout]);
  const choice = response.choices[0];
  logger.debug(
    { finishReason: choice?.finish_reason, content: choice?.message?.content },
    "AI question response",
  );
  return choice?.message?.content?.trim() ?? "";
}

export async function noiseClassifier(text: string): Promise<boolean> {
  const client = await getOpenAIClientPromise();
  if (!client) throw new Error("OpenAI client unavailable");

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Noise classification timed out")),
      QUESTION_TIMEOUT_MS,
    ),
  );

  const aiCall = client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a spaced-repetition assistant. Given a learning note, respond with 'YES' if this text contains a meaningful concept, fact, or idea that is suitable for generating a quiz question, or 'NO' if it is just noise (e.g., gibberish, stray characters, or not useful for learning). Return only YES or NO.",
      },
      { role: "user", content: text },
    ],
    max_tokens: 3
  });

  const response = await Promise.race([aiCall, timeout]);
  const answer = response.choices[0]?.message?.content?.trim().toUpperCase();

  logger.debug(
    { input: text, openai_response: answer },
    "AI noise classification response"
  );

  return answer === "NO";
}

export async function classifyThreadCategory(
  text: string,
  existingCategory?: string
): Promise<{ category: string; confidence: number }> {
  const client = await getOpenAIClientPromise();
  if (!client) throw new Error("OpenAI client unavailable");

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Thread category classification timed out")),
      QUESTION_TIMEOUT_MS,
    ),
  );

  // Add hint about an existing category if provided
  let systemContent =
    "You are an expert assistant. Analyze the provided text and respond with the most suitable thread category for this message. Examples of thread categories: 'question', 'discussion', 'feedback', 'announcement', 'help', 'off-topic', or a short descriptive category based on the content. Respond in the following JSON format: {\"category\": \"<category>\", \"confidence\": <confidence between 0 and 1>} where confidence is your best estimate of certainty for the assigned category as a number from 0 to 1. Only output this JSON and nothing else.";
  if (existingCategory) {
    systemContent += ` If the text fits the existing thread category '${existingCategory}', you may choose it, but you are not required to do so.`;
  }

  const aiCall = client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: systemContent,
      },
      { role: "user", content: text },
    ],
    max_tokens: 30,
  });

  const response = await Promise.race([aiCall, timeout]);
  const aiText = response.choices[0]?.message?.content?.trim();

  logger.debug(
    { input: text, existingCategory, openai_response: aiText },
    "AI thread category classification response"
  );

  let output: { category: string; confidence: number } = {
    category: "uncategorized",
    confidence: 0,
  };

  if (aiText) {
    try {
      // Try to parse as JSON, fallback to just the string as category
      const parsed = JSON.parse(aiText);
      if (
        parsed &&
        typeof parsed.category === "string" &&
        typeof parsed.confidence === "number"
      ) {
        output = {
          category: parsed.category.trim(),
          confidence: Math.max(0, Math.min(1, parsed.confidence)),
        };
      } else {
        output = { category: aiText, confidence: 0 };
      }
    } catch (err) {
      // In case parsing fails, treat aiText as the category string
      output = { category: aiText, confidence: 0 };
    }
  }

  return output;
}