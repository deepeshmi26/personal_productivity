---
name: threads-clustering
description: Use when implementing or tuning the Threads auto-clustering system in Learn5 — online nearest-centroid assignment, centroid maintenance, the cold-start/growth/mature lifecycle, split heuristics, auto-rename gates, and threshold calibration. Trigger on any work touching the nightly cluster cron, the `threads`/`response_threads` tables, thread labelling, or the cosine-similarity thresholds defined in the threads PRD.
---

# Threads Clustering (Learn5)

> The algorithm here is fixed by [docs/product/threads-intelligent-question-generation.md](../../../docs/product/threads-intelligent-question-generation.md) — read PRD §1 (assumptions) and §4 (E3 row) before changing anything. This skill encodes the *how*; the PRD owns the *what*.

## When to load this skill

- Implementing the nightly cluster cron
- Adjusting the cosine threshold or split criterion
- Adding lifecycle handling (cold-start gating, mature-split detection)
- Auto-rename gate work
- Threshold calibration (Phase 1.5 of the roadmap)

## 1. The algorithm (online nearest-centroid)

For each new (or recently-touched) embedding:

```
1. Compute cosine similarity to every existing thread's centroid.
2. Find the best match: best_thread, best_sim.
3. If best_sim ≥ THRESHOLD_ATTACH (0.78):
     → attach to best_thread
     → update centroid: incremental mean
4. Else if we're past cold-start (≥15 non-noise entries total):
     → seed a new thread (centroid = this embedding, label = TBD until next re-label)
5. Else:
     → defer (don't seed yet; entry stays unclustered until cold-start ends)
```

**Why online, not batch?** Streaming write pattern fits the capture loop, makes nightly cron cheap (only touches new + recently-touched threads), and avoids re-shuffling thread membership the user has grown used to. Batch re-cluster is reserved for Phase-3-and-beyond, and even then runs scoped to threads with detected drift.

## 2. Constants (single source of truth)

Pull these from one config module — never hardcode at call sites.

```ts
// artifacts/api-server/src/lib/clustering-config.ts
export const CLUSTERING = {
  THRESHOLD_ATTACH: 0.78,        // cosine SIMILARITY (1 − distance). Distance form: 0.22.
  THRESHOLD_SPLIT_VARIANCE: 0.15, // when intra-cluster variance exceeds this, run split check
  THRESHOLD_RENAME_DRIFT: 0.10,  // centroid moved by this much since last label → re-label
  COLD_START_MIN_ENTRIES: 15,    // global gate: don't surface Threads UI below this
  THREAD_LIVE_MIN_ENTRIES: 5,    // per-thread gate: thread doesn't show in filter below this
  MATURE_THREAD_MIN_ENTRIES: 40, // above this, run split checks
} as const;
```

If you change a constant, update the PRD §1 assumptions table in the same PR. Drift between code and PRD is a real bug class.

## 3. Centroid maintenance

Centroids are **stored**, not recomputed on every query. Keep them on the `threads` table:

```ts
// Add to threads schema:
centroid: vector("centroid", { dimensions: 1536 }).notNull(),
entryCount: integer("entry_count").notNull().default(0),
```

### Incremental update on attach
```ts
// new_centroid = (old_centroid * n + new_embedding) / (n + 1)
function updateCentroid(old: number[], n: number, incoming: number[]): number[] {
  return old.map((v, i) => (v * n + incoming[i]) / (n + 1));
}
```

Then UPDATE `threads` setting `centroid = new_centroid, entry_count = n + 1`.

**Re-normalize?** OpenAI embeddings are L2-normalized, so the mean of unit vectors is *not* a unit vector. For cosine similarity ranking that's fine (cosine is invariant under positive scaling of either input). If you ever switch to inner-product, re-normalize after each update.

### Full recompute on split or merge
Splits and merges invalidate the incremental state. After either, recompute the centroid from scratch over current members.

## 4. Lifecycle stages

The PRD calls out three stages. They differ in **which decisions are allowed**:

| Stage | Trigger | What's allowed |
|---|---|---|
| **Cold start** | global entry count < 15 | Attach to existing threads only. **No new thread seeding** (avoids singleton spam). |
| **Growth** | 15 ≤ count < 40 per thread | Attach or seed new threads. No split checks yet (not enough data). |
| **Mature** | thread has ≥40 entries | Attach + seed + run periodic **split check** on this thread. |

Encode this as a single function:

```ts
type Stage = "cold_start" | "growth" | "mature";
function stageFor(globalCount: number, threadCount: number): Stage {
  if (globalCount < CLUSTERING.COLD_START_MIN_ENTRIES) return "cold_start";
  if (threadCount >= CLUSTERING.MATURE_THREAD_MIN_ENTRIES) return "mature";
  return "growth";
}
```

## 5. Split heuristic (mature threads only)

A mature thread can drift — e.g. "React" picks up enough React-Native entries that the centroid is no longer informative for either sub-topic. Detect with **intra-cluster variance**:

```ts
const variance = mean(members.map(m => 1 - cosineSim(m.embedding, thread.centroid)));
if (variance > CLUSTERING.THRESHOLD_SPLIT_VARIANCE) {
  // candidate for split — run k=2 k-means restricted to this thread's members
}
```

Split procedure:
1. K-means with k=2 over the thread's member embeddings (cap iterations at 20).
2. If the two resulting sub-centroids have cosine similarity to each other < 0.65, the split is real. Otherwise, leave it.
3. Per PRD: **locked label stays on the larger child**; smaller child gets a fresh auto-label (unlocked).

Run split checks **weekly**, not nightly. Splits are jarring; throttle them.

## 6. Auto-rename gate

**Primary trigger only: centroid drift.** Per PRD, keyword shift is *not* a parallel trigger — drop it to avoid two signals disagreeing.

```ts
const drift = 1 - cosineSim(thread.centroid, thread.lastLabelCentroid);
if (drift > CLUSTERING.THRESHOLD_RENAME_DRIFT && !thread.labelLocked) {
  // call gpt-5-mini for a new 3-word label; store it; update lastLabelCentroid
}
```

`lastLabelCentroid` is a separate column — the snapshot of the centroid at the time the label was generated. Without it you can't measure drift since last label.

**User renames always win.** When the user renames, set `label_locked = true` and never auto-rename. Splits inherit lock per §5.

## 7. Cron design

```
[nightly @ 02:00 user-local]
  ├─ for each response embedded in the last 36h (overlap covers timezone slop)
  │    └─ assignToThread(embedding) — §1 algorithm
  │
  ├─ for each thread touched today
  │    ├─ re-snapshot centroid + entry_count
  │    └─ if drift > THRESHOLD_RENAME_DRIFT → enqueue for re-label
  │
  └─ [weekly, Sunday]
       └─ for each mature thread
            └─ split check
```

**Idempotency:** assignToThread must be safe to re-run. Check `response_threads` before attaching:
```ts
const existing = await db.select().from(responseThreads).where(eq(responseThreads.responseId, id));
if (existing.length) return; // already assigned
```

**Don't re-cluster everything every night.** That scales O(n·k) and the PRD §6 explicitly flags it as a multi-user risk. Solo-scale you can get away with full re-cluster, but write the incremental path *first* — switching back later is a real refactor.

## 8. Calibration (Phase 1.5)

PRD §5 carves out a 2-week window between MVP and V2 to tune the constants. **Don't skip it** — `0.78` is the educated-guess starting point, not the answer.

### Metrics that gate "tuned"
1. **Singleton-thread %** — fraction of threads with exactly 1 entry. Target: **<20%**. Higher means threshold is too strict (everything seeds new threads).
2. **Label stability week-over-week** — fraction of threads whose auto-label changes *without* contents drift. Target: **<10%**. Higher means the rename gate is too sensitive (or the label prompt is non-deterministic).
3. **Manual coherence spot-check** — sample 20 random threads, eyeball-rate "tight / loose / mixed". Target: **≥70% tight**.

### Tuning order
1. Set threshold → check singleton %.
2. Set rename drift → check label stability.
3. Set split variance → check whether obvious split-needed threads actually trigger.

Tune one constant at a time. Changing two in parallel makes attribution impossible.

### Instrumentation
Emit a daily JSON blob to logs (the existing pino logger):
```ts
logger.info({
  type: "clustering_snapshot",
  date: today,
  thread_count: ...,
  singleton_pct: ...,
  label_changes_today: ...,
  avg_intra_variance: ...,
}, "clustering health");
```

Then a small endpoint or SQL query aggregates these for the calibration dashboard. Don't build a UI; a `psql` view is enough during tuning.

## 9. Edge cases worth thinking about up front

- **A response is edited.** Re-embed, re-assign. The previous `response_threads` row may need to move.
- **A response is marked as noise after assignment.** Remove from `response_threads`. Recompute the centroid if `entry_count` was small (large threads barely shift).
- **A thread loses all members** (all entries marked noise). Delete the thread. Don't keep zombie threads — they pollute the filter and weight averages.
- **A response is restored from noise.** Treat as a fresh capture: embed + assign.
- **Two threads converge** (centroids drift toward each other). Out of scope for V2 (merge UI parked per PRD), but log when `min(thread_pair_cosine)` exceeds 0.85 so the founder sees it coming.

## 10. Anti-patterns to reject in review

- Hardcoded threshold at a call site (must come from the config module)
- Re-cluster-everything nightly (won't scale, breaks user familiarity)
- Re-naming a thread on every cron tick without the drift gate
- Splitting in cold-start or growth stages
- Treating cosine *distance* and *similarity* interchangeably without converting
- Missing idempotency check on assignment
- Allowing a locked label to be overwritten by auto-rename

## 11. References in this repo

- Threads PRD: [docs/product/threads-intelligent-question-generation.md](../../../docs/product/threads-intelligent-question-generation.md) — §1 (assumptions), §3 (E3a / E3b epics), §4 (tech reconciliation), §6 risk 6 (nightly cost)
- Embedding storage: governed by the `pgvector-in-drizzle` skill
- Pipeline orchestration: governed by the `llm-pipeline-orchestration` skill
- Existing cron-style scheduling reference: `artifacts/focus-app/lib/scheduling.ts` (different domain, but the "pure helpers, not embedded in handlers" pattern is the one to mirror on the server side)
