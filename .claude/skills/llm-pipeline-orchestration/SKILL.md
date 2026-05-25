---
name: llm-pipeline-orchestration
description: Use when designing or extending multi-stage OpenAI pipelines in Learn5 — chaining rules → classify → embed → generate calls, structured outputs (JSON / tool calling), timeout & fallback patterns, idempotency, cost guardrails, and graceful degradation when the LLM is down. Trigger on any work touching `gpt-5-mini`, `text-embedding-3-small`, OpenAI batch processing, the existing card-question background job, or new pipelines for noise classification, thread labeling, or AI summaries.
---

# LLM Pipeline Orchestration (Learn5)

> The existing pattern is in [artifacts/api-server/src/routes/cards.ts](../../../artifacts/api-server/src/routes/cards.ts). **Read it before changing anything.** This skill encodes why it looks the way it does and how to extend it without breaking those properties.

## When to load this skill

- Adding a stage to the background job (noise classifier, embeddings, thread labels)
- Designing a new multi-call OpenAI pipeline
- Switching prompts to structured outputs
- Debugging hangs, retry storms, or unexplained cost spikes
- Adding any new `import("@workspace/integrations-openai-ai-server")` call

## 1. The invariants (don't violate these)

The current `cards.ts` pipeline holds 5 properties. Any new stage must preserve all of them.

1. **API responses never block on LLM calls.** Cached → return immediately. Uncached → fire-and-forget, return `""`, fill on next session load.
2. **OpenAI client is lazy-imported.** `getOpenAIClientPromise()` — server boots even if the integration package fails to load. Crash-safe by design.
3. **Every external call has a timeout via `Promise.race`.** Currently 8s. No call hangs the job.
4. **Failures degrade, never throw.** A failed question returns `""`; the response is still served. Logged, not rethrown.
5. **Writes are idempotent.** `onConflictDoNothing` / `onConflictDoUpdate`. Re-running the job on the same response produces the same row.

If you can't keep all 5, you're changing the architecture — surface that explicitly before writing code.

## 2. Multi-stage pipeline pattern (Threads)

The Threads PRD adds three new stages to the existing per-response background job:

```
new response
   │
   ▼
[1] rules-based noise check ──► flag, STOP
   │ (no LLM call)
   ▼
[2] gpt-5-mini noise classify ──► flag, STOP
   │ (one cheap structured call)
   ▼
[3] text-embedding-3-small ──► store in response_embeddings
   │
   ▼
[4] gpt-5-mini question ──► store in card_questions
```

**Two rules govern stage ordering:**

- **Cheapest filters first.** Rules-based check is free; LLM classification is $0.0001; embedding is $0.00002; question gen is $0.0001+. If a stage can short-circuit the rest, run it first.
- **Independent stages can parallelize.** Once we pass the noise gates, embed + question gen are independent — `Promise.all` them. Don't serialize when you don't need to.

Skeleton:

```ts
async function processResponse(card: Card) {
  // Stage 1: cheap rules
  const rulesFlag = noiseRulesCheck(card.text);
  if (rulesFlag) {
    await flagNoise(card.id, rulesFlag, "rules");
    return;
  }

  // Stage 2: LLM classify (cheap structured call)
  const cls = await classifyNoise(card.text); // returns {is_noise, reason}
  if (cls.is_noise) {
    await flagNoise(card.id, cls.reason, "llm");
    return;
  }

  // Stages 3 & 4: independent — parallelize
  const [embedResult, questionResult] = await Promise.allSettled([
    embedAndStore(card),
    generateAndStoreQuestion(card),
  ]);

  if (embedResult.status === "rejected") logger.error({ err: embedResult.reason, responseId: card.id }, "embed failed");
  if (questionResult.status === "rejected") logger.error({ err: questionResult.reason, responseId: card.id }, "question failed");
}
```

**Use `Promise.allSettled`, not `Promise.all`.** A failed embed shouldn't lose the question, and vice versa. They're independent — failure modes should be independent too.

## 3. Structured outputs

For anything that needs a discriminated answer (`{is_noise, reason}`, `{label, confidence}`), use OpenAI's **JSON mode** with a Zod schema validating the result. Don't parse free text.

```ts
import { z } from "zod/v4";

const NoiseClassificationSchema = z.object({
  is_noise: z.boolean(),
  reason: z.enum(["empty", "todo", "feeling", "logistics", "duplicate", "other"]),
});

const response = await client.chat.completions.create({
  model: "gpt-5-mini",
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: NOISE_CLASSIFIER_PROMPT }, // must mention JSON in the prompt for json_object mode
    { role: "user", content: text },
  ],
});

const raw = response.choices[0]?.message?.content ?? "{}";
const parsed = NoiseClassificationSchema.safeParse(JSON.parse(raw));
if (!parsed.success) {
  logger.warn({ raw, responseId: card.id }, "noise classifier returned invalid JSON");
  return { is_noise: false, reason: "other" } as const; // fail-open: don't filter on parse failure
}
return parsed.data;
```

**Fail-open vs fail-closed:**
- Noise classifier: **fail-open** (treat as not-noise). False negative is recoverable via E9 "Mark as noise"; false positive erodes trust.
- Question generator: **fail-open** (return `""`). The card session pipeline already handles missing questions.
- Anything that costs money on failure: **fail-closed** with an explicit error log.

## 4. Timeout & fallback

Every external call wrapped in `Promise.race` against a timeout. Reuse the existing pattern:

```ts
const TIMEOUT_MS = 8000;
const timeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error("LLM call timed out")), TIMEOUT_MS),
);

const result = await Promise.race([client.chat.completions.create({...}), timeout]);
```

**Don't share one timeout across stages.** Each stage gets its own, sized to the call's expected latency:
- Embeddings: 5s
- Classification: 5s
- Question generation: 8s
- Thread labeling: 8s

## 5. Idempotency

Every write the pipeline performs must be safe to repeat. Patterns:

| Write | Pattern |
|---|---|
| Insert noise flag | `INSERT ... ON CONFLICT (response_id) DO UPDATE` (later signals override earlier — user > LLM > rules) |
| Insert embedding | `INSERT ... ON CONFLICT (response_id) DO NOTHING` (don't waste API calls re-embedding) |
| Insert question | `INSERT ... ON CONFLICT (response_id) DO NOTHING` (existing pattern, keep it) |
| Insert thread label | `INSERT ... ON CONFLICT (thread_id) DO UPDATE WHERE label_locked = false` (preserve user renames) |

**Before** calling the LLM, check if the result already exists:

```ts
const existing = await db.select().from(table).where(eq(table.responseId, id)).limit(1);
if (existing.length) return; // already done
```

This is the difference between a $0 re-run and a $50 re-run.

## 6. Batch processing

Use `batchProcess` from `@workspace/integrations-openai-ai-server` for fan-out. Current default in `cards.ts`: `{ concurrency: 2, retries: 3 }`.

- **Concurrency 2** is conservative — fine for solo use. Raise to 4–8 once you have rate-limit headroom.
- **Retries 3** with exponential backoff is the integration's default. Don't lower it; LLM APIs are flaky.
- **Don't batch within a single user request path.** Batching is for the background job. User-facing endpoints stay synchronous and return cached or empty.

## 7. Cost guardrails

- **Cheapest-stage-first ordering** does most of the work. Quantify it: if rules+classify filter 20% of entries, you save 20% of question-gen + embedding cost.
- **Log token usage per stage** to `logger.debug` and aggregate into a daily roll-up. Set a daily $-spend alarm (e.g. >$2 → alert).
- **Cache aggressively.** `card_questions` is a 100% cache hit on re-asking. Anything LLM-generated and stable should follow the same pattern.
- **Re-label gating.** Thread labels regenerate weekly *and* only on centroid drift (per PRD). Don't re-label on every cron tick.

## 8. Graceful degradation

The app must run in Expo Go without the API; the API must run without OpenAI. Both already do. When extending:

- New LLM stages catch their own errors, log via `pino`, return a safe default. Never propagate to the HTTP layer.
- New endpoints that depend on LLM-generated data must handle the "not generated yet" case (return `""` / `null` / empty array, not 503).
- Don't add a new env var the server *requires* to boot. Optional integrations stay lazy-imported.

## 9. Prompts: keep them short, name them

Inline prompts grow weeds. Once a prompt is non-trivial, extract it:

```ts
// artifacts/api-server/src/prompts/noise-classifier.ts
export const NOISE_CLASSIFIER_PROMPT = `
You are a noise classifier for a learning-capture app...
Output JSON: {is_noise: boolean, reason: "empty"|"todo"|"feeling"|"logistics"|"duplicate"|"other"}.
`.trim();
```

Reasons:
- Diffs of prompt changes become readable.
- Easy to A/B test by swapping import.
- Tests can assert prompt structure without parsing the call site.

## 10. Anti-patterns to flag in review

- New LLM call without a timeout → reject.
- New LLM call inside a synchronous route handler → reject (move to background job).
- Free-text parsing where structured output would do → reject.
- `try { ... } catch { /* swallow */ }` without a log → reject.
- A new stage that doesn't check the cache before calling → reject.
- `Promise.all` where `Promise.allSettled` belongs → reject.

## 11. References in this repo

- Existing pipeline: [artifacts/api-server/src/routes/cards.ts](../../../artifacts/api-server/src/routes/cards.ts)
- OpenAI integration: `@workspace/integrations-openai-ai-server` (exports `openai`, `batchProcess`)
- Logger: `artifacts/api-server/src/lib/logger.ts` (pino-style)
- Threads PRD §4 ("Tech reconciliation") and the pipeline diagram in §4
