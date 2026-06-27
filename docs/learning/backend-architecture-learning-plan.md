# Backend Architecture Learning Plan

This plan keeps User's backend mentorship calibrated across sessions.

## Goal

Build backend architecture fluency for fullstack and system-design interviews, grounded in hands-on Learn5 implementation.

The target is not to become a backend specialist in isolation. The target is to understand how backend systems are decomposed, implemented, debugged, and scaled well enough to reason through "design X" interviews with confidence.

## Calibration

- User is a 5-year frontend engineer. Do not spend learning time on generic frontend concepts like component state, hooks, React Query basics, loading/error states, or visual UI mechanics.
- Frontend work is allowed when it closes a backend feature loop, but the learning focus should stay on API contracts, generated clients, mutation semantics, cache correctness, and end-to-end verification.
- Backend knowledge is uneven:
  - API/HTTP basics: moderate and improving.
  - Express/request lifecycle: beginner-to-intermediate.
  - SQL: conceptually improving, syntax and query-shape recall still need reps.
  - Indexes/query plans: first pass complete; needs spaced reinforcement.
  - Transactions/concurrency/pooling: strong first pass; needs application in real features.
  - Data modeling, async jobs, caching, observability, auth, deployment/scaling: mostly surface-level or unknown until practiced.
- Avoid introducing new syntax or side concepts mid-lesson unless necessary. If necessary, explain the new concept briefly before using it. If optional, park it.
- End topics deliberately once the learning objective is met. Do not continue drilling just because one answer was imprecise unless it indicates a serious conceptual hole.

## Teaching Pattern

Use problem ladders:

```text
tiny working version
→ expose the hidden backend problem
→ introduce the backend concept
→ improve the implementation
→ test or reason through the failure case
→ extract the system-design/interview lesson
```

Prefer concept-first, Learn5-applied learning:

```text
pick backend concept
→ find or create Learn5 work that naturally exercises it
→ implement/reason through it
→ update journal and coverage map
```

## Coverage Map

Track these areas over time so the Learn5 roadmap does not accidentally skip interview-relevant backend concepts.

| Area | Current status | Learn5 application ideas |
|---|---|---|
| API contracts and generated clients | In progress | Finish `PATCH /responses/:id` integration loop; compare OpenAPI, route, generated hook, cache invalidation. |
| Data modeling and migrations | Next strong candidate | Threads schema: `threads`, `response_threads`, job/status tables, constraints. |
| SQL query design and indexes | First pass complete, needs reps | Thread filters, digest queries, review stats, EXPLAIN on real query shapes. |
| Transactions and race conditions | First pass complete, needs use | Review-once-per-day, settings updates, job claiming, duplicate generation prevention. |
| Caching and invalidation | Surface-level backend | Thread digests, stats caching, cache invalidation on new responses/reviews. |
| Async jobs and queues | Likely weak | OpenAI question generation/noise filtering: request-time naive path → background jobs → retries/idempotency. |
| External API integration and retries | Partially touched via OpenAI plans | OpenAI timeout, retry, fallback, structured failure states. |
| Auth and authorization | Weak/unknown | Later: multi-user Learn5 or design-only drill if product does not need it soon. |
| Observability | Weak/unknown | Request IDs, structured logs, health checks, job metrics, error diagnostics. |
| Deployment and runtime scaling | Weak/unknown | API server deployment model, DB connection limits, environment config, health checks. |
| Storage/search/vector retrieval | Not yet practiced | pgvector embeddings for Threads, similarity search, clustering. |
| System-design translation | Main target | After each feature, ask what breaks at 10x, 100x, 1M users and what tradeoffs appear. |

## Near-Term Sequence

1. API contract and generated-client integration
   - Close the `PATCH /responses/:id` loop lightly.
   - Focus: OpenAPI operation, Orval hook/key helpers, mutation input shape, invalidation target, backend/frontend contract drift.
   - Avoid: teaching generic React Query or UI state.

2. Data modeling and migrations
   - Use Threads as the Learn5 vehicle.
   - Start from requirements and model tables/relationships/constraints.
   - Focus: one-to-many vs many-to-many, unique constraints, foreign keys, nullable fields, migration safety.

3. Async jobs and external API reliability
   - Use OpenAI question generation/noise filtering.
   - Start naive with request-time generation, then expose timeout/failure/cost/retry problems.
   - Introduce background jobs, idempotency, retry state, and observability.

4. Caching and read performance
   - Use thread digest/review stats.
   - Start with direct queries, then expose repeated-read cost and staleness.
   - Introduce cache keys, TTL, invalidation, denormalized summaries if needed.

5. Observability and production debugging
   - Add structured logs, request IDs, health checks, job metrics.
   - Practice diagnosing failures from logs/metrics instead of guessing.

## Session Rules

- Start each backend session by naming the concept, the Learn5 work that exercises it, and what will be learned.
- Ask questions only when they reveal a backend decision, misconception, or tradeoff.
- Assume frontend competence unless the issue is repo-specific codegen/integration behavior.
- For any feature, close with a short system-design translation: what changes at higher scale, what failure mode appears, and what tradeoff was chosen.
- Update `backend-journal.md` after meaningful learning milestones, not after every small exchange.
