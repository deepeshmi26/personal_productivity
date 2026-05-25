# Threads — Intelligent Question Generation

**Status:** Product plan (pre-implementation)
**Owner:** TBD
**Created:** 2026-05-25
**Author:** product-manager subagent (VoltAgent), brief by user
**Audience:** future Claude Code sessions, engineering agents (`Plan`, `Explore`), human reviewers

> This document is the source of truth for the **"intelligent question generation"** initiative. When picking up related work, read this first before proposing implementation.

---

## Source request (verbatim)

**Agenda:** Make the process of question generation intelligent.

**Problems:**
1. **Noise** — users write low-value journal entries (random, throwaway). These shouldn't become quiz questions.
2. **Topic-filtered quizzing** — when a user has been learning one topic for a stretch, they want to quiz only on that topic.
3. **Topic aggregation view** — fragmented entries on one topic should be viewable as a single consolidated document.

---

## 1. Sharpened requirement

All three asks collapse into one job:

> **JTBD:** *"When I'm capturing fragmented thoughts throughout the day, help me trust that what comes back as a quiz — and what I can review as notes — is actually the stuff I care about learning."*

Today the loop is dumb: every entry becomes a flashcard regardless of whether it's "compound interest = rate × principal × time" or "remember to buy milk." This erodes trust in the SRS queue and gives the user no topical agency. The three problems are three facets of the same gap: **the system has no semantic model of what the user is learning.**

### North Star metric
**Weekly count of correctly-answered questions, scoped to topics where the user has answered at least one question correctly.**

Rationale: measures real learning, not capture volume.
- "Correctly answered" filters out tap-through behaviour — proves retention, not just engagement.
- Scoping to topics the user has engaged with excludes dead topics (zero replies = user doesn't care).
- Entry-level noise (e.g. "I learnt react today") is auto-filtered upstream and never generates a question, so it cannot inflate the metric.

**This is aspirational at solo scale.** Self-rated correctness + N=1 makes the absolute number nearly meaningless. **Operational gating metric for the solo phase is the user-override-tap rate** (% of auto-filtered entries the user restores) — a discrete event, single-user-tolerant, directly tied to the trust risk. North star activates as a real measure at multi-user scale.

Topic vs. entry distinction:
- **Topic** = the semantic bucket (e.g. "React"). A topic is "live" once the user has answered ≥1 question on it correctly.
- **Entry quality** = content density within one capture. Low-quality entries are filtered at the entry level even if they belong to a live topic.

### Supporting metrics (product health)
- Quiz skip rate (proxy for "bad question / don't care") — should drop.
- Session completion rate on topic-filtered vs. shuffled sessions.

### System health metrics (noise filter calibration)
Tracked separately from the north star so noise leaks can't be hidden by strong learning numbers. Internal dashboard, not user-facing.

- **False positive rate** — % of auto-filtered entries the user restores. Signal: filter is too aggressive.
- **False negative rate** — % of entries the user manually marks as noise after they slip through. Signal: filter is too lenient; feeds back into level-1 rules.
- **Noise share** — % of incoming entries auto-filtered. Should stabilize in a band (e.g. 15–25%); sustained drift indicates classifier or input-distribution change.

Noise filtering is a two-tier system: (1) conservative auto-filter at capture, (2) user "mark as noise" button on anything that slips through. The auto-filter stays conservative on purpose so the user-feedback loop remains intact.

### Assumptions (decided, not punted back)

| Assumption | Call | Why |
|---|---|---|
| What's a "topic"? | **Auto-clustered embeddings + editable labels.** | Capture is fast today; manual tagging would add friction the user has not opted into. |
| What's "noise"? | Three classes: empty (<8 tokens), non-learning intent (todos/feelings/logistics), near-duplicates. Off-topic-within-a-topic is NOT noise. | Off-topic is a *filter* problem, not a *noise* problem. |
| Destructive filtering? | **Soft-flag only.** Stays in `responses`, excluded from card pool, user can unflag. | Cheap insurance against classifier errors. |
| Topic granularity? | ~5–40 entries per topic via cosine threshold ~0.78. | Avoid topic-per-entry and "Tech"-mega-cluster failure modes. |
| When does a thread become "live" (visible in filter)? | **≥5 entries per thread.** Below that it stays hidden — entries still attach internally, but the thread doesn't show up as a filter option. | Prevents the filter chip from being cluttered with tiny one-off threads during cold start. 5 matches the lower bound of the granularity range. |
| When does the Threads UI surface at all? | **≥15 non-noise entries total** across the user's corpus. Below that, the filter chip / dropdown is hidden entirely. | Two cold-start gates answering different questions: **15 total** unlocks the Threads UI globally; **5 per thread** unlocks an individual thread within it. |
| Membership over time? | Nightly re-cluster; user edits sticky. | Topics drift as corpus grows. |
| Cluster lifecycle? | Three stages: **cold start** (sparse — most assignments are obvious yes/no, risk is premature topic creation), **growth** (enough neighbours to confidently assign), **mature** (large thread needs periodic split check to spin off drifted sub-topics, e.g. "React Native" leaking into "React"). | Clustering quality changes with data density; the algorithm should adapt thresholds and run split checks accordingly. |
| Auto-rename gate? | **Primary:** centroid drift past threshold. Keyword shift is *not* a parallel trigger — drop it to avoid two signals disagreeing. User renames always sticky. | Renaming a thread the user is used to is jarring; rename only when the thread genuinely no longer matches its label. One trigger keeps behaviour predictable. |
| What happens to a locked label when a thread splits? | When a mature thread splits (e.g. "React" → "React" + "React Native"), the **locked label stays on the larger child**. The smaller child gets a fresh auto-generated label (unlocked). | Preserves the user's intent on the dominant thread; doesn't silently re-purpose a user-chosen name onto a sub-topic. |
| What happens to existing quiz cards when a user marks the source entry as noise? | **Suppress from future sessions; keep the rows.** Card session endpoint filters out cards whose source response has `is_noise = true AND user_override = false`. Don't hard-delete — preserves analytics on classifier behaviour and lets a restore re-activate the card. | Avoids a destructive operation triggered by a single tap; reversible by design. |
| How is "correct answer" judged? | **Self-rated only** (tap [Yes]/[No] after revealing the answer). LLM-grading explicitly out of scope — typed answers would slow the tap-through rhythm SRS depends on. | Self-rated ships fast at zero cost. Accept that the north star will be optimistic; document it as a known bias rather than fix it with friction. |

---

## 2. The feature — "Threads"

Learn5's semantic layer. Every entry is silently embedded and either (a) attached to an existing thread, (b) seeds a new one, or (c) filtered as noise. Threads power three surfaces: **noise-aware card generator**, **thread-scoped quiz (optional)**, **thread digest view**.

**Mixed-topic quiz remains the default** session type. Thread-scoped quiz is an *additional* option layered on top — the user chooses a thread explicitly if they want to drill one area. Interleaving across topics is a known retention booster, so removing the mixed mode would hurt learning even when scoped sessions look engaging.

**In scope:** noise classification, embeddings + auto-clustering, thread-scoped sessions *as an opt-in alongside the existing mixed session*, raw digest, minimal management (rename/merge/hide).

**Out of scope:** manual tagging at capture, shared threads, re-generating existing questions, multi-question-per-response.

### Success criteria

**Solo-user phase (current — N=1, population metrics are noise):**
1. Skip rate on quiz questions trends down week-over-week as the classifier matures.
2. Founder starts a thread-scoped session **≥2×/week** voluntarily (not as a test).
3. Founder ends up with **3–7 live threads** after ~4 weeks of capture (granularity sanity check at single-user scale).
4. Founder restores **<5%** of auto-filtered entries (false-positive trust check).

**Multi-user phase (activates only after the product has real users):**
1. Skip rate on generated questions **−30%** vs. pre-Threads baseline.
2. **≥40%** of WAU start a thread-scoped session weekly.
3. Median user has **3–7 live threads**.

---

## 3. Epics

| # | Epic | User story | Size |
|---|---|---|---|
| E1 | Noise classifier | "Don't quiz me on my grocery list." | S |
| E2 | Response embeddings | (Infra) Every non-noise response gets a vector. | S |
| E3a | Clustering infrastructure | Nightly cron groups embeddings, auto-labels threads. Lifecycle handling (cold start / growth / mature-split). | M |
| E3b | Threshold calibration (time-boxed) | 2-week tuning window on real embeddings before V2 ships. Tune cosine threshold, mature-thread split criterion, auto-rename gate. **Measured by:** (1) **singleton-thread %** — should fall below 20%; (2) **label stability week-over-week** — fraction of threads whose auto-label changes without contents drift; (3) **manual coherence spot-check** — founder reviews 20 random threads, marks "tight / loose / mixed". Targets define "tuned"; otherwise "tuning" becomes "vibes". | M |
| E4 | Thread data model + API | `threads`, `response_threads`, CRUD endpoints. | S |
| E5 | Thread filter on review screen | "See what topics I'm actively learning." Filter chip / dropdown / search on the existing review screen — not a new nav tab. | S |
| E6 | Thread-scoped session (opt-in, alongside default mixed quiz) | "Quiz me only on Postgres today." Mixed-topic quiz remains default. | M |
| E7 | Thread digest view | "Show me everything I've captured on X as one doc." | M |
| E8 | Thread management | **Rename only.** Merge and hide both parked. Only filtering mechanism in the product is "Mark as noise" (E9), applied at the entry/question level — never at the thread level. | XS |
| E9 | Noise refinement UI | **Three concrete surfaces:** (a) a **"Filtered" section in the journal** lists entries auto-flagged as noise, each with a "Restore" CTA — this is the only surface where false-positive recovery can happen, since filtered entries don't generate quiz questions; (b) **"Mark as noise" on the generated question during a quiz** — catches false negatives at the moment of friction; (c) **"Mark as noise" on the journal entry view** — lets the user pre-empt noise without waiting for it to surface in a quiz. All four signals (rules, LLM, user-during-quiz, user-on-entry) feed `response_noise_flags`. | M |
| E10 | AI-summarized digest | LLM TL;DR atop each thread (V3). | M |

---

## 4. Tech reconciliation against the stack

The existing background job in [artifacts/api-server/src/routes/cards.ts](../../artifacts/api-server/src/routes/cards.ts) that calls `gpt-5-mini` per response is the natural choke point — extend it, don't parallel-build.

| Epic | Approach | Cost | Verdict |
|---|---|---|---|
| **E1 Noise** | Synchronous pre-step in existing background job. **Rules scoped narrowly** — only fire when the entry *is* the matched phrase (e.g. entry = `"buy milk"`, not entries that merely *contain* `"buy"`). Length check (<8 tokens) + exact-match short phrases. Anything longer or ambiguous goes to one `gpt-5-mini` classify call → `{is_noise, reason}`. Short-circuit question gen. Avoids eating legitimate entries like `"todo: read more about Postgres MVCC"`. | +1 cheap LLM call/entry (~$0.0001). Saves question-gen on 15–25% of entries → **likely net cheaper**. | Ship in MVP. |
| **E2 Embeddings** | Add `pgvector` extension to Postgres. New `response_embeddings(response_id PK, embedding vector(1536))`. Use `text-embedding-3-small` in same background job. Drizzle has pgvector support. | ~$0.00002/entry. Negligible. | Cheap. |
| **E3 Clustering** | Nightly cron. Online algo: nearest thread centroid; cosine sim >0.78 → attach, else seed new. Re-label weekly via one `gpt-5-mini` call per thread (`"3-word label for these entries"`). | ~$0.005/user/week. Trivial. | Medium — threshold tuning is the real work, not infra. |
| **E4 Data model** | `threads(id, label, label_locked, created_at)`, `response_threads(response_id, thread_id, confidence)` many-to-many. | — | Cheap. |
| **E5 Thread filter** | Filter chip / dropdown on the existing review screen (not a new tab). Threads ordered by recent activity / entry count / cards-due. Links out to E7 digest. | — | Small (modifies existing screen, no new nav). |
| **E6 Thread-scoped session** | `GET /cards/session?thread_id=X`. Reuse existing 3-bucket logic + join on `response_threads`. | — | Cheap, ~30 backend LOC. |
| **E7 Digest** | `GET /threads/:id/digest` — entries grouped by day. Pure read, no LLM. | — | Cheap. |
| **E8 Management** | **Rename only.** Sets `label_locked=true` so the cron stops overwriting. Merge and hide both out of scope (merge parked; hide not supported — only filtering mechanism is entry-level "Mark as noise"). | — | Cheap. |
| **E9 Refinement** | Three surfaces: (a) "Filtered" section in journal — restore CTA per entry (only place restore can live, since filtered entries don't generate questions); (b) "Mark as noise" on the quiz question; (c) "Mark as noise" on the journal entry. All write to `response_noise_flags` for E1 tuning. | — | Medium (two write surfaces + the Filtered list view). |
| **E10 AI digest** | One `gpt-5-mini` call per thread per view, cached 24h or until new entries arrive. | ~$0.002/view; cap at 1 regen/day/thread. | Defer to V3. |

**Cut / defer:**
- E10 → V3.
- Thread merge UI → V2 (start rename-only).
- Confidence scores → internal-only field, not surfaced.
- Multi-question-per-response → separate initiative, not part of Threads.

### New DB objects (proposed)

```
-- Postgres extension
CREATE EXTENSION IF NOT EXISTS vector;

response_embeddings (
  response_id  int PK REFERENCES responses(id) ON DELETE CASCADE,
  embedding    vector(1536) NOT NULL,
  model        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
)

-- Row exists only when an entry IS flagged as noise. Absence of row = not noise.
-- Effective state = (row exists) AND NOT user_override.
response_noise_flags (
  response_id   int PK REFERENCES responses(id) ON DELETE CASCADE,
  reason        text NOT NULL,   -- enum: 'empty' | 'todo' | 'feeling' | 'logistics' | 'duplicate' | 'other'
  flagged_by    text NOT NULL,   -- enum: 'rules' | 'llm' | 'user_in_quiz' | 'user_on_entry'
  user_override boolean NOT NULL DEFAULT false,  -- user restored a false positive
  created_at    timestamptz NOT NULL DEFAULT now()
)

threads (
  id            serial PK,
  label         text NOT NULL,
  label_locked  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
)

response_threads (
  response_id  int REFERENCES responses(id) ON DELETE CASCADE,
  thread_id    int REFERENCES threads(id) ON DELETE CASCADE,
  confidence   real NOT NULL,
  PRIMARY KEY (response_id, thread_id)
)
```

### Card session pipeline (post-change)

```
new response
   │
   ▼
[background job]
   ├── rules-based noise check ──► flag, stop
   ├── gpt-5-mini noise classify ─► flag, stop
   ├── text-embedding-3-small ───► store in response_embeddings
   └── gpt-5-mini question ──────► store in card_questions

[on E9 restore of a previously filtered entry]
   └── re-trigger embedding + question generation
       (filtered entries skip embedding, so restores must re-embed)

[nightly cron]
   └── cluster embeddings ───────► upsert threads + response_threads
       └── weekly re-label threads via gpt-5-mini (skip if label_locked)
```

---

## 5. Roadmap

### Phase 1 — MVP (≈4 weeks): "Stop the noise"
- E1 Noise classifier
- E2 Embeddings (infra only, no user-facing use yet — silently accumulate)
- E9 Noise refinement UI (both directions: restore + mark-as-noise — two surfaces, needs feedback log)

**Gates to ship (solo phase):**
- **Quantitative:** override-tap rate **<5%** measured over a rolling window of the founder's last 100 auto-filtered entries. (Skip rate trend is too noisy at N=1 to gate on.)
- **Qualitative:** founder confirms the "Filtered" section in the journal feels accurate on a manual spot-check of the most recent 30 filtered entries — no high-value misses.

**Gates to ship (multi-user phase, deferred):** skip rate −20% vs. pre-Threads baseline over a 2-week window with ≥1000 questions answered; override-tap rate <5% across cohort.

### Phase 1.5 — Threshold calibration (≈2 weeks)
- E3b runs against the corpus of embeddings accumulated in Phase 1.
- Tune cosine threshold, mature-split criterion, auto-rename gate using real data.
- **Gate to enter Phase 2:** clustering produces 3–7 threads on the founder's corpus and labels feel right on a manual review.

### Phase 2 — V2 (≈4 weeks): "Threads land"
- E3a Clustering infrastructure
- E4 Data model
- E5 Thread filter on review screen
- E6 Thread-scoped session
- E7 Thread digest (raw, no AI summary) — also serves as empty-state fallback for E5
- E8 Management — rename only (merge parked, hide not supported)

**Dependency:** E2 must have ≥2 weeks of embeddings accumulated so V2 launches with non-empty threads.

**Gates to ship (solo phase):**
- Founder's corpus produces **3–7 live threads** after Phase 1.5 calibration.
- Founder voluntarily uses the thread filter **≥2×/week** for two consecutive weeks.
- Mixed-topic session volume does not drop after the filter ships (no cannibalization).

**Gates to ship (multi-user phase, deferred):** ≥30% of WAU open the filter in week 1; median 3–7 live threads/user; mixed-session volume holds.

### Phase 3 — V3 (≈3 weeks): "Threads get smart"
- E10 AI digest summary
- Thread merge UI
- Thread-level SRS health ("12 cards due in *Rust ownership*")
- Smart nudges ("5 entries added to *Postgres* today — quiz now?")

**V3 is explicitly exploratory.** No hard adoption gate; ship if AI summaries and nudges feel additive on manual founder review, kill any sub-feature that doesn't pull weight after 4 weeks of usage. Multi-user adoption gates revisit only post-launch.

---

## 6. Risks & open questions

### Open questions deferred to multi-user
- **Embedding retention / privacy.** Personal journal embeddings sit in pgvector indefinitely. Solo-use is fine; multi-user needs an explicit retention + deletion policy (right-to-be-forgotten, per-user index scoping). Flag now so it isn't a retrofit during multi-tenant migration.
- **Self-rated correctness bias.** North star uses self-graded correctness, which inflates. A cheap mitigation worth considering later: every Nth correct answer, prompt the user to type the answer once to calibrate the gap between self-rated and actual. Turns the bias from "documented" into "bounded". Not in scope now since typing was explicitly ruled out for speed.

### Top risks
1. **Classifier false positives erode trust.** A single "this was actually important" misfilter is worse than no filter. *Mitigation:* conservative threshold + prominent override + weekly review of override-tap rate.
2. **Cold-start clustering looks dumb.** First ~2 weeks per user, thread labels will be bad. *Mitigation:* don't surface Threads tab until ≥15 non-noise entries.
3. **OpenAI cost creep.** 1 call/entry → ~2.1 calls/entry. *Mitigation:* rules-based noise pre-filter catches obvious cases without an LLM call.
4. **Auto-topic granularity is the whole game.** 0.78 cosine threshold is a guess — budget 2 weeks of tuning post-MVP on real corpora.
5. **Entries spanning topics.** Many-to-many internally avoids data loss; single-assignment in UI to avoid "why is this in two threads?" confusion.
6. **Nightly re-cluster cost at scale.** Clustering all embeddings nightly is roughly O(n·k) — fine at solo scale, but at ~10k entries/user the cron stops being free. Not urgent (solo-user phase punts this), but flagged so the multi-user migration doesn't get blindsided. *Mitigation when relevant:* switch from full re-cluster to incremental (only new + recently-touched threads); cap nightly compute budget.

### Resolved decisions (from developer, 2026-05-25)
1. **Threads surface:** filter chip / dropdown / search on the **existing review screen** — not a new nav tab. Revisit usability after launch based on actual engagement.
2. **Existing data:** **DB cleanup before launch** — no backfill needed because existing entries will be wiped. Threads start from a clean slate at GA. Product has not been launched yet; DB is internal/test only.
3. **Noise classifier visibility:** **visible during the tuning window** (solo-user phase + early multi-user). Re-evaluate at GA — visible filtering aids calibration but every visible decision is also a trust-erosion opportunity on a miss. Not baked in as "always visible".
4. **Scale assumption:** solo user for now. Cost / re-cluster performance can be revisited at scale.
5. **`responses.skipped` semantics:** **user-marked only** — the user tapped "skip" on a quiz question. System-driven exclusion (noise, hidden thread) uses separate flags, not this column.
6. **Thread merge UI:** parked. Trust the classifier for now; revisit only if duplicate threads become a recurring problem.
7. **Thread-level hide/mute:** **not supported.** The only filtering mechanism is entry-level "Mark as noise" (E9). Threads themselves can't be hidden — keeps the model simple and avoids a second, redundant filtering concept.
8. **Review ↔ digest navigation:** from the review screen (with a thread filter applied), the user can jump to the **thread digest view** to see all entries inside that thread as notes.
9. **Empty filter state:** if the selected thread has no due questions, show a clear "no questions due" message with a CTA to **open the digest for revision** instead of leaving the user stuck.

---

## Pointers for future agents

- **Current question-gen code:** [artifacts/api-server/src/routes/cards.ts](../../artifacts/api-server/src/routes/cards.ts)
- **Cached question table:** [lib/db/src/schema/card_questions.ts](../../lib/db/src/schema/card_questions.ts)
- **OpenAI integration entry point:** `@workspace/integrations-openai-ai-server` (see `batchProcess`)
- When implementing any epic above, start by re-reading sections 1 (assumptions), 4 (tech reconciliation for that specific epic), and 6 (risks). The epic table in §3 is intentionally light — §4 is where the design lives.
