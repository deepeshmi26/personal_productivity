# Backend Learning Journal

---

## Feature 1: `PATCH /responses/:id`

Built an endpoint to edit an existing response. Spec-first (OpenAPI), then handler, then curl-test.

### HTTP semantics I locked in

**Idempotency** = safe to do twice, same result as once. Network failures cause retries — idempotent methods are auto-retried by browsers/proxies; non-idempotent ones aren't.

| Method | Idempotent? | Auto-retry safe? |
|---|---|---|
| GET | Yes | Yes |
| POST | No | No |
| PUT | Yes (by spec) | Yes |
| PATCH | Not guaranteed | No |
| DELETE | Yes | Yes |

- **PUT** = replace whole resource (missing fields wiped).
- **PATCH** = merge partial change. Can be idempotent (`{text:"hi"}`) or not (`{counter:+1}`); spec doesn't promise.
- For non-idempotent ops needing safe retries → **idempotency key**.

**Status codes:** 4xx = client's fault. 5xx = server's fault. 404 is 4xx because the *request* was the problem.

| Code | Meaning |
|---|---|
| 400 | Bad Request — malformed/invalid body |
| 401 | Unauthorized — no/invalid auth |
| 403 | Forbidden — auth'd but not allowed |
| 404 | Not Found |
| 409 | Conflict — conflicts with current state |
| 422 | Unprocessable Entity — valid JSON, semantically wrong |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 502 | Bad Gateway — upstream failure |
| 503 | Service Unavailable |
| 504 | Gateway Timeout |
| 200/201/204 | OK / Created / No Content |

**Don't document 500.** Document codes you *choose* to return. 500 is a contract failure, not a feature.

### DB concepts

**`RETURNING`** (Postgres / Oracle / SQL Server's `OUTPUT`): lets `INSERT`/`UPDATE`/`DELETE` send modified rows back in the same query.

```sql
UPDATE responses SET text = 'hi' WHERE id = 1 RETURNING *;
```

- One round-trip instead of two.
- No race between "did the update happen" and "fetch the row."
- Empty result = no row matched → that's how you detect "not found."

Bigger principle: **push computation toward the data**. One smarter query beats many round-trips. Same idea behind joins (vs N+1), aggregations, and UPSERT.

**Silent successes:** `UPDATE … WHERE id = X` on a non-existent id does NOT error — Postgres returns "0 rows affected" and considers it success. Handler must translate 0 → 404. "Success" in backend doesn't always mean "did the thing."

**UPDATE without WHERE** = updates every row in the table. Cardinal sin.

### Validation contract

- **OpenAPI** = describes (documentation).
- **Zod** = enforces at runtime (`safeParse(req.body)`).
- **TypeScript** = compile-time checks (erased at runtime).

After validation, **always use `parsed.data.*`**, never raw `req.body`. Otherwise validation is decorative.

### JS trap

**Empty arrays and objects are truthy.** `![]` is `false`. `!{}` is `false`. Never use bare `if (x)` to check emptiness — destructure (`const [row] = arr`) or check `.length`.

### API shape discipline

**DB row ≠ API response.** Always project explicitly. New DB columns would otherwise leak into responses, and `createdAt` needs `.toISOString()` to match the contract.

---

## Feature 2: Global error handler

Built `HTTPError` base + subclasses, a 3-arg `notFoundHandler` and 4-arg `errorHandler`. Refactored routes to `throw` instead of manually returning status codes.

### The Express pipeline

- **3-arg middleware = normal lane.** Runs when no error is in flight.
- **4-arg middleware = error lane.** Runs only when an error is in flight.
- Dispatch is by `fn.length`. The signature controls which lane.

Order in `app.ts`:
```
pino → cors → json → urlencoded → router → notFoundHandler → errorHandler
```

### "Error in flight"

A per-request state. Flips `true` on `throw` or `next(err)`. **Propagates forward only** — can't reach back and skip middlewares that already ran. Stays in flight until a 4-arg handler responds.

In Express 5, async throws in route handlers are auto-caught and routed to the error lane.

### Unmatched routes don't auto-404

Express's default is an HTML "Cannot GET …" page. Add a 3-arg `notFoundHandler` that calls `next(new ResourceNotFoundError(...))` to bridge into the error lane.

### `res.headersSent`

Once a response is written, headers are on the wire — you can't change status or write another response. Error handlers must guard:
```ts
if (res.headersSent) return next(err);
```

### Error design

**Two audiences, two outputs:**
- Client → sanitized + brief + consistent shape (`{message: "..."}`).
- Server log → verbose + structured + request id.

**Known vs unknown:**
- Known (you threw an `HttpError`) → use your message + status.
- Unknown (library throw, runtime crash) → generic `"Internal server error"` + 500. Log full stack.

Never leak raw exception text — leaks file paths, library versions, schema details.

**Log stacks proportional to surprise.** Same message can originate from many places. Default to logging stacks.

**Centralized error handling**: routes just `throw`; one handler formats. Every endpoint gets consistent error shape with no duplication.

### Naming

- Throwable classes end in `Error`. `NotFoundError`, not `NotFound`.
- Classes/types = PascalCase. Functions/variables = camelCase.

### Type your boundaries

`ErrorRequestHandler` for 4-arg, `RequestHandler` for 3-arg. Picking the right type catches `req`/`res` swaps and similar typos immediately. Untyped signatures = hidden bugs.

---

## Feature 3: SQL fundamentals — joins, group by, NULL

Worked against the real Learn5 schema (`responses`, `card_reviews`, `card_questions`).

### Joins

- **INNER JOIN** = keep only rows with matches on both sides. Unreviewed responses *disappear*.
- **LEFT JOIN** = keep all rows from the left table. Unmatched right side = NULL columns.
- The left side of a LEFT JOIN is the "must keep" side.
- Choice is **product-driven**, not technical: "zero is a valid answer?" → LEFT JOIN.

**Anti-join pattern** (the one legitimate `WHERE` after LEFT JOIN):
```sql
LEFT JOIN <right> ON ...
WHERE <right>.id IS NULL   -- "rows in left that have no match in right"
```

### LEFT JOIN trap (the silent INNER conversion)

Putting a `WHERE` filter on a right-side column after a LEFT JOIN silently converts it to INNER, because `NULL = anything` is NULL, and WHERE drops non-true rows.

```sql
-- WRONG: drops unreviewed responses
LEFT JOIN card_reviews cr ON cr.response_id = r.id
WHERE cr.result = 'forgot'

-- RIGHT: filter inside ON, preserves LEFT-ness
LEFT JOIN card_reviews cr
  ON cr.response_id = r.id AND cr.result = 'forgot'

-- ALSO RIGHT: filter inside the aggregate
COUNT(*) FILTER (WHERE cr.result = 'forgot')
```

### NULL semantics

- **NULL is not a value, it's the absence of one.**
- Any comparison with NULL (`=`, `<>`, `<`, `>`) returns NULL, not true/false.
- WHERE treats NULL as "not true" and drops the row.
- `NULL = 'x'` → NULL. `NULL <> 'x'` → NULL. `NULL = NULL` → NULL.
- To test for NULL explicitly: `IS NULL` / `IS NOT NULL`.
- Trap: `WHERE result <> 'remembered'` silently drops rows where `result IS NULL`.

### GROUP BY rules

- GROUP BY says: "treat rows that share these column values as one group."
- Every column in SELECT that isn't an aggregate must appear in GROUP BY.
- **Grouping columns shape the meaning of groups.** Adding a column to GROUP BY changes the report — it doesn't "fix" syntax.
- Without GROUP BY, the whole table is one implicit group; aggregates run over everything.
- `COUNT(*)` counts all rows in the group. `COUNT(col)` counts rows where `col` is not NULL.
- **In LEFT JOIN aggregates, COUNT the right-side column** (e.g., `COUNT(cr.id)`) to get 0 for unmatched left rows.

### Canonical clause order

```
SELECT     ← compute columns / aggregates
FROM       ← which tables
JOIN       ← attach others
WHERE      ← filter rows (before grouping)
GROUP BY   ← collapse into groups
HAVING     ← filter groups (after grouping)
ORDER BY   ← sort
LIMIT      ← cap rows
```

Logical execution order is different (FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT), which is why aggregates can't appear in WHERE.

- **`WHERE`** filters individual rows.
- **`HAVING`** filters groups based on aggregate values. Requires `GROUP BY`.
- Use the one that matches *what* you're filtering on.

### Mechanical SQL traps I keep hitting

- **Single quotes for strings, double quotes for identifiers.** `WHERE result = 'forgot'`, not `"forgot"`. Double-quoted `"forgot"` is interpreted as a column name → "column does not exist."
- **Always include the grouped column in SELECT.** Otherwise output rows are unlabeled — you'll see a count column with no way to know which group it belongs to.
- **`ORDER BY result_count` defaults to ascending.** Add `DESC` when you mean descending.
- **`COUNT(*)` vs `COUNT(col)` matters on LEFT JOIN.** `COUNT(*)` counts every row (including unmatched LEFT-side rows where right is NULL → would count 1, not 0). `COUNT(right.id)` counts non-NULL right-side rows → gives 0 for unmatched. Always count the right-side column in LEFT JOIN aggregations.

### FILTER aggregates

Postgres-specific, very clean way to do conditional counts in one pass:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE skipped = false) AS answered,
  COUNT(*) FILTER (WHERE skipped = true) AS skipped
FROM responses;
```

Older SQL writes this as `SUM(CASE WHEN cond THEN 1 ELSE 0 END)` — uglier but portable.

---

## Feature 4: Indexes + EXPLAIN

Seeded 100k responses + 500k card_reviews with skewed distributions, then ran EXPLAIN ANALYZE across queries with and without indexes.

### What an index actually is

A B-tree of (indexed_value → row-pointer) entries in a separate file. Lookups go from linear (read every row) to logarithmic (~20 hops for 500k rows).

- Postgres auto-creates indexes for PKs and UNIQUE constraints.
- Postgres does **not** auto-index foreign keys. This is the most common missing-index in real schemas.
- Costs: disk space, write overhead (every INSERT/UPDATE updates every index), buffer cache pressure.
- 95% of indexes you'll ever create are B-tree.

### Pages — the unit of cost

- A table is a file divided into 8 KB chunks called **pages**.
- Postgres reads and writes in whole pages, never individual rows.
- Data page = chunk of the table file, holds full rows.
- Index page = chunk of the index file, holds (value → row-pointer) entries.
- An index page packs hundreds of compact entries; a data page packs dozens of full rows.
- **The real cost metric is pages touched, not rows examined.**

### Access methods (the EXPLAIN vocabulary worth recognizing)

- **Seq Scan** — read the whole table. Cheap on small tables, painful on big ones.
- **Index Scan** — B-tree lookup + jump to data page. Best for very few rows.
- **Bitmap Index Scan + Bitmap Heap Scan** — use index to build a list of pages, then read them in disk order. Postgres's hybrid for "medium selectivity" (a few hundred to a few thousand rows).
- **Index Only Scan** — index has everything the query needs, no heap fetch. `Heap Fetches: 0` is the win signal.
- **Parallel Seq Scan** — Postgres throws multiple cores at a big scan to mitigate pain. Read it as a *symptom* of a missing index, not a feature.

### Planner intuition (the rules behind the names)

- **Indexes don't always win.** On tiny tables, Seq Scan is faster than Index Scan because reading one page beats reading an index page + a data page.
- **Selectivity gradient**: ~0.001% selective = huge index win; ~2% = meaningful; ~20% = break-even; 50%+ = Seq Scan probably picked anyway.
- **Indexes unlock different access patterns, not just faster ones.** Adding an index can flip the planner from "sort everything, spill to disk" to "nested loop with early exit."
- **`loops=N`** in EXPLAIN means an inner scan ran N times. Total cost = per-loop cost × N.
- **`LIMIT` radically changes plans.** Same query with/without LIMIT can pick fundamentally different algorithms.
- **`external merge Disk:` in EXPLAIN** = sort spilled to disk because it didn't fit in `work_mem`. Often a sign that an index could have provided sorted order for free.

### EXPLAIN line vocabulary (what to actually read)

- **`cost=0.00..6.50`** — planner's *estimated* cost. Made-up units; only meaningful for comparing alternative plans, not for absolute judgment.
- **`rows=N` (estimate) vs `actual rows=M`** — divergence here is a planner-confusion signal. Big divergence (10×+) often means stale stats (`ANALYZE`) or non-sargable predicates.
- **`actual time=0.073..0.075`** — startup..total milliseconds. Total time per loop, not cumulative.
- **`Rows Removed by Filter: 89936`** — the seq-scan tax made visible. The bigger this number, the more an index would help (subject to selectivity).
- **`Heap Blocks: exact=683`** — pages touched in the table file. The real cost unit.
- **`Heap Fetches: 0`** — Index Only Scan won; never had to read the table itself.
- **`Workers Launched: 2`** — Postgres parallelized to mitigate a big seq scan. Read as a "you need an index" symptom.
- **Buffer cache effect:** first run of a query may be slow (read from disk), subsequent runs are faster (pages cached in RAM). Always run EXPLAIN ANALYZE twice if measuring.

### Sargability (the non-sargable trap)

Wrapping a column in a function in WHERE prevents index use, even if an index exists.

Three forms of "find rows from this month" — same result, different speeds:

```sql
WHERE created_at >= '2026-05-01' AND created_at < '2026-06-01'  -- sargable, uses index
WHERE DATE_TRUNC('month', created_at) = '2026-05-01'            -- NOT sargable
WHERE TO_CHAR(created_at, 'YYYY-MM') = '2026-05'                -- NOT sargable
```

Also non-sargable:
```sql
WHERE LOWER(email) = 'x@y.com'
WHERE created_at::date = '2026-05-01'
```

Two costs, not one:
1. The index can't be used.
2. **Planner row estimates go bad** because Postgres only collects stats on raw columns, not on derived expressions. Bad estimates cascade into bad join plans downstream.

Even *without* an index, the non-sargable form was ~6× slower in my tests than the sargable form — pure per-row function-call overhead. The two costs stack.

Workaround exists (expression indexes), but cleaner to rewrite the query sargably.

### `ANALYZE`

- Postgres tracks stats per column (row count, distinct values, common values, distribution).
- These stats are NOT updated automatically after bulk loads — autovacuum is too slow to react.
- After a bulk insert/update/delete: `ANALYZE <table>` to force a stats refresh.
- Stale stats → bad plans.

### Why indexing huge tables is a project

For tables in the billions:

- **Build takes hours** because it has to read every row and sort.
- **Default `CREATE INDEX` locks the table** for writes (and effectively reads) during the build. Use `CREATE INDEX CONCURRENTLY` to avoid downtime, but it takes 2–3× longer and can leave broken indexes behind on failure.
- **The index itself can be hundreds of GB** — disk space, replication lag, backup bloat, buffer cache pressure, per-write overhead forever.
- Big teams use `CREATE INDEX CONCURRENTLY`, build-on-replica-first, partial indexes, and online schema migration tools.

> At small scale, an index is a line of SQL. At large scale, it's a project with downtime risk and capacity planning.

---

## Feature 5: Bulk seeding test data

Filled the DB with realistic skewed data (100k responses, 500k reviews, 500 card_questions) so EXPLAIN had meaningful workload.

### Building blocks

- **`INSERT … SELECT`** — bulk insert from any source.
- **`generate_series(1, N) AS s(i)`** — virtual table of integers 1..N. The standard "give me N rows from nothing" trick. `s(i)` aliases the column as `i`.
- **`||`** — string concatenation. `'response ' || i`.
- **`random()`** — float in `[0.0, 1.0)`. Independent on every call.
- **`floor(...)`** vs **`::int`** — `floor()` rounds down (use for tight ranges to avoid off-by-one); `::int` rounds to nearest.
- **`NOW()`** — current timestamp. **`INTERVAL '7 days'`** — a duration. Add/subtract from timestamps directly.
- **`CASE … WHEN … THEN … ELSE … END`** — SQL's if/else. First matching WHEN wins.
- **`BEGIN; … COMMIT;`** — wrap bulk inserts. Atomic, and ~10× faster than per-row autocommit because of fewer disk syncs.
- **`TRUNCATE <table> RESTART IDENTITY CASCADE`** — fast wipe, reset auto-id, cascade to dependent tables.
- **`ANALYZE <table>`** — refresh planner stats after the load.

### The two sampling patterns (don't mix)

| Goal | Pattern |
|---|---|
| Generate N fake rows from nothing | `FROM generate_series(1, N) AS s(i)` — use `i` as counter |
| Sample N rows from an existing table | `FROM <table> ORDER BY random() LIMIT N` — use real columns |

`ORDER BY random() LIMIT N` guarantees uniqueness (sampling without replacement), which matters when the target has a UNIQUE constraint. Random integer picking can produce duplicates and violate the constraint.

### Gotchas burned in

- **Off-by-one on random ranges.** `floor(random() * 100)::int` produces 0..99. For 1..100, add `+ 1`.
- **Independent `random()` calls.** A CASE ladder with multiple `random()` calls doesn't produce the probabilities the thresholds suggest. For perfect ladders, compute once in a CTE.
- **`CASE` must end with `END`.** Easy to forget the closing keyword.
- **Always `\d <table>`** before seeding — unique constraints, NOT NULL, CHECK constraints all bite at insert time.
- **Random with replacement breaks UNIQUE constraints.** Use `ORDER BY random() LIMIT N` instead, or `ON CONFLICT DO NOTHING`.
- **`ON CONFLICT DO NOTHING`** — Postgres upsert escape hatch. Silently skips rows that would violate a unique constraint. Useful for idempotent seeds.
- **`ORDER BY random()` is slow on big tables** — it has to sort the whole table. Fine for 500 rows from 100k. Don't use on 10M+ row tables.
- **Don't mix the two patterns.** `generate_series` gives you an `i` counter. Sampling a table gives you real columns. There's no `i` when sampling a table — use a column from the row (e.g. `r.id`). Window functions (`ROW_NUMBER() OVER ()`) can synthesize a counter when sampling, but you usually don't need one.
- **`responses r(i)` renames columns**, not just the table. `r.id` becomes `r.i` — and you lose access to all other columns. Plain `responses r` is the right alias.
- **"Current transaction is aborted, commands ignored until end of transaction block"** → `ROLLBACK;` to escape. Always the same fix.
- **Foreign key constraints bite at insert time.** Random `response_id` outside the existing range → "violates foreign key constraint." Pick from `[1, count_of_existing]`, or sample real rows.

---

## Feature 6: Transactions + isolation

The semantic primitive that makes concurrent DB work safe. Built the model from atomicity → isolation → snapshots → MVCC → row locks.

### ACID

- **A — Atomicity.** Transaction is all-or-nothing. Either every statement commits, or every statement rolls back.
- **C — Consistency.** Transaction moves the DB from one valid state to another. Constraints upheld.
- **D — Durability.** Once committed, survives crashes. Implemented by WAL + fsync (parked).
- **I — Isolation.** Concurrent transactions don't see each other's intermediate state.

A and I are where the design decisions live. C and D are mostly automatic.

### Atomicity in practice — error handling

```sql
BEGIN;
  <statements>
COMMIT;       -- or ROLLBACK
```

When a statement errors inside a transaction:
- **Postgres does NOT auto-rollback.** It marks the transaction as **aborted** and refuses every subsequent statement with "current transaction is aborted."
- The transaction stays poisoned until **explicitly ended**.
- `ROLLBACK` discards everything. `COMMIT` on an aborted transaction is auto-converted to ROLLBACK.
- **Library auto-rollback** (e.g., `db.transaction(() => ...)`) is library code wrapping try/catch — not a Postgres feature.
- **Connection-drop rollback** is the safety net. Uncommitted work never persists past a connection's death.

> **An error inside a transaction doesn't roll it back. It poisons it. You (or your library, or a closing connection) must end it explicitly.**

### The four concurrency anomalies

| Anomaly | What goes wrong |
|---|---|
| **Dirty read** | T2 reads T1's uncommitted changes; T1 rolls back; T2 acted on a value that "never happened." |
| **Non-repeatable read** | Same SELECT inside one transaction returns different values because another transaction committed in between. |
| **Phantom read** | Same SELECT inside one transaction returns *different rows* (new rows appeared). |
| **Lost update** | Both transactions read X, both compute X+1, both write — one update silently overwrites the other. |

### Four isolation levels

| Level | Prevents | Postgres notes |
|---|---|---|
| **Read Uncommitted** | (nothing useful) | Postgres treats this as Read Committed. |
| **Read Committed (default)** | Dirty reads | Still allows non-repeatable, phantoms, lost updates. |
| **Repeatable Read** | + non-repeatable, + phantoms | Also detects same-row write conflicts → aborts one with `40001`. |
| **Serializable** | + everything (full serializability illusion) | Optimistic conflict detection. Aborts conflicting transactions at commit. App must retry. |

### Snapshots (the read mechanism)

A snapshot = "everything committed before this moment, frozen." Reads only see data in their snapshot.

- **Read Committed:** new snapshot per statement. You see other transactions' commits in real time between your statements.
- **Repeatable Read:** one snapshot per transaction (taken at first read). The world appears frozen for your transaction's duration.
- **Serializable:** like Repeatable Read + global predicate-level conflict detection.

Implemented via **MVCC** (Multi-Version Concurrency Control): every row internally remembers its history; a snapshot is a timestamp + a list of which transactions had committed by then. Postgres returns the row version current as of your snapshot. Details: parked, but the mental model "what was true at moment T" is enough.

### `SELECT ... FOR UPDATE` — pessimistic row locks

Targeted alternative to upgrading isolation. Locks specific rows inside a transaction; other transactions trying to UPDATE or `FOR UPDATE` those rows **block until you commit**.

```sql
BEGIN;
  SELECT balance FROM acc WHERE id='alice' FOR UPDATE;
  -- ... decide, possibly UPDATE ...
COMMIT;
```

| `FOR UPDATE` | Serializable |
|---|---|
| Pessimistic (block competitors) | Optimistic (let everyone run, abort on conflict) |
| Targeted: only specific rows you lock | Global: every read/write in the transaction |
| Other transactions *wait* | Other transactions *fail with `40001`* |
| No retry logic needed | App must catch & retry |
| Use when you know which rows matter | Use when you don't |

Most production code uses Read Committed everywhere + `FOR UPDATE` on hot rows. Serializable for the rare invariant that can't be expressed otherwise.

### "DB does the math" rule

```sql
-- VULNERABLE (app does the math): two transactions read 500, both write 450.
SELECT balance FROM acc WHERE id='alice';
-- app: balance - 100 = 400
UPDATE acc SET balance = 400 WHERE id='alice';

-- SAFE: row lock + DB math.
UPDATE acc SET balance = balance - 100 WHERE id='alice';
```

A bare `UPDATE balance = balance - 100` takes an implicit row lock during execution → concurrent UPDATEs serialize → no lost update, no transaction needed.

> Always prefer "DB computes the new value" over "app reads, computes, writes." The DB takes the right lock for you automatically.

### Gotchas / intuition burned in

- **Read-only endpoints don't need explicit transactions.** Each statement is its own implicit transaction (autocommit).
- **Long-running transactions are dangerous.** They hold connections from the pool and locks for their duration.
- **Implicit locks during UPDATE/DELETE** vs **explicit locks via `SELECT FOR UPDATE`** — same mechanism, different syntax.
- **`could not serialize access`** (`40001`) is the retry signal under Repeatable Read / Serializable. App must catch and re-run.
- **`SAVEPOINT`** lets you partially roll back to a checkpoint inside a transaction (parked).

---

## Feature 7: Connection pooling

The infrastructure layer that makes transactions practical at scale.

### What a connection actually is

- A **TCP socket** between your app process and Postgres.
- An **authenticated session** (username, perms, search path).
- A **dedicated server-side process** holding session state (current transaction, prepared statements, `work_mem`).

Each connection = one OS process on the DB server. ~10 MB+ memory each.

### Why connections are expensive

**Opening cost (per-open, paid once):**
- TCP handshake + TLS (if encrypted) + Postgres auth + server process fork = **20–200 ms typical**.

**Concurrency cost (per-active-connection, paid while connected):**
- Each connection holds memory.
- `max_connections` (default ~100) is a hard cap. Hitting it = "FATAL: too many clients already."
- Many active connections fight for CPU → throughput drops.

These are *two separate cost dimensions*, not one.

### Why one-connection-per-request is catastrophic

- Every request pays 20–200 ms open cost → latency tanks.
- `max_connections` exhausted instantly under load → cascade failure.

### How a pool fixes it

A pool is N pre-opened connections, shared and recycled:
- App startup: open N connections to Postgres.
- Request arrives → **borrows** a connection → runs queries → **returns** connection to pool (still open).
- Request N+1 with all N busy → **queues** until one returns (or times out, "pool exhausted").

Opening cost paid N times at startup, never per-request.

### Connections are single-threaded

> **A Postgres connection runs at most one query at a time.** Concurrent queries within an app come from *multiple connections in the pool*, each running its own one query.

Sequential `await q1; await q2;` on the same connection runs them *one after the other*. For real parallelism, borrow two connections from the pool.

### Pool sizing — "more isn't better"

> **Throughput peaks around (DB cores × 2).** Beyond that, queries fight for CPU and each runs slower. *More connections = lower throughput.*

The classic graph:
```
throughput
   ▲      ╱ ◄ peak around cores × 2
   │    ╱   ╲   ◄ adding more connections HURTS
   │   ╱     ╲___
   │  ╱
   └──────────────► active connections
```

Two ceilings, both real:
- **Per-instance pool size** = sized to absorb that instance's *peak burst* (typically 10 for a web app).
- **Total active connections across all instances** = should average around `cores × 2`. Brief spikes above are fine because bursts don't perfectly correlate across instances.

For 3 app instances with pool=10 each: 30 ceiling, typical active ~10–15, peaks ~20. Fine on an 8-core DB.

For 10 instances with pool=10 each: 100 ceiling, hits `max_connections`. **Time for PgBouncer.**

### Transactions hold a connection for their duration

**The cardinal pool-killing bug:** slow non-DB work inside a transaction.

```ts
await db.transaction(async (tx) => {
  await tx.query('UPDATE orders SET status="shipped" WHERE id=1');
  await fetch('https://shipping-provider/notify');  // ← 2 SECONDS of network wait
  await tx.query('INSERT INTO audit_log ...');
});
```

For 2 seconds, that connection cannot be returned to the pool. Under traffic, many such transactions exhaust the pool → new requests queue → timeouts → cascade failure.

> **Never put slow non-DB work inside a transaction.** Compute, fetch, log — do it *before* `BEGIN` or *after* `COMMIT`. The transaction should hold the connection only as long as the DB itself needs to work.

### PgBouncer — the structural fix at scale

App-side pools don't scale past `max_connections ÷ per-instance pool`. **PgBouncer is an external pool layer** between your apps and Postgres.

- App instances pool to PgBouncer (cheap, in-memory).
- PgBouncer maintains a small pool to Postgres.
- 100 app-side "connections" can be served by 20 real Postgres connections.

Three pooling modes:
- **Session mode** — connection held for full session (default, safest).
- **Transaction mode** — connection held only for transaction duration. **Workhorse mode.** Some features break (`SET LOCAL`, server-side prepared statements).
- **Statement mode** — connection held for one statement only. Transactions can't span statements.

Cloud Postgres services bundle equivalents (AWS RDS Proxy, Neon's pooler, Supabase pooler).

### Failure-mode diagnostics

| Symptom | Likely cause |
|---|---|
| Pool wait time > 0 routinely | Pool too small per instance |
| Active connections always near `max_connections` | Too many instances × pool size, or no PgBouncer |
| Queries getting slower under load even with capacity | DB itself is CPU-bound; reduce concurrency |
| Random "too many clients already" errors | Total pool ceiling hit `max_connections` |
| Transaction-tied connections held for seconds | Slow non-DB work inside a transaction |

> "DB feels slow" has two opposite causes — pool too small (queueing) vs pool too large (DB overloaded). Distinguish with monitoring: active connections + pool wait time + query latency.

---

## Feature 8: Race conditions + DDL constraints

The map of bugs that emerge from concurrent execution, and the four-tool defense.

### Race conditions vs isolation problems

> **Race condition = any bug that emerges from concurrent execution.**
> **Isolation problems = subset of race conditions that the isolation knob handles.**

Isolation protects against concurrent transactions interfering with *existing* data (dirty reads, non-repeatable, phantoms, same-row lost updates). Many races live *outside* this — concurrent inserts of new rows that shouldn't both exist, multi-step app logic across separate connections, cross-system coordination.

### The "check-then-act" pattern

The signature shape of a race in app code:

```
1. Read state from DB.
2. Decide based on what you read.
3. Write back.
```

Race window is between 1 and 3. Another transaction can change state in that gap, invalidating your decision.

Example: "review once per day."
- T1 SELECT → 0 reviews today → decide "proceed" → INSERT.
- T2 SELECT → 0 reviews today → decide "proceed" → INSERT.
- Two reviews. Constraint violated.

A transaction wrapper alone *does not* fix this — both transactions read 0 from their own (consistent) snapshots and both insert. **Atomicity isn't sufficient; you need to express the constraint somewhere the DB can enforce.**

### Why isolation doesn't fix concurrent-insert races

Repeatable Read detects conflicts on *rows that exist in both snapshots*. Two concurrent inserts have **no shared row yet** — nothing to conflict on. Only Serializable's *predicate-level* detection catches it (tracking WHERE clauses), and only with retry overhead.

> The bug is about rows that don't exist yet, both transactions agree they don't exist, both insert. Standard isolation has no signal.

### The four-tool defense map

| Tool | Best for | Hierarchy |
|---|---|---|
| **Constraints** (`UNIQUE`, `CHECK`, `FOREIGN KEY`) | "This data must never look like X." | Strongest — enforced at storage layer; survives any code path. |
| **Atomic SQL** (`INSERT ... ON CONFLICT`, `UPDATE ... SET x = x+1`) | Single-statement check-and-write. | Cheap, no transaction needed. |
| **Row locks** (`SELECT ... FOR UPDATE`) | Read-then-act on *specific known rows*. | Pessimistic. Predictable. |
| **Isolation** (Serializable) | Multi-row invariants that can't be expressed otherwise. | Heaviest. Requires retry logic. |

> **Pick top-down.** Start with constraints; only descend when the higher tool can't express your rule.

### The five SQL constraint types

| Constraint | Guarantees |
|---|---|
| **NOT NULL** | Column can't be NULL. |
| **UNIQUE** | No two rows share the same value(s) in these column(s). |
| **PRIMARY KEY** | NOT NULL + UNIQUE + canonical row identifier (auto-indexed). |
| **FOREIGN KEY** (via `REFERENCES`) | Value must exist in another table's column. `ON DELETE CASCADE` etc. for cleanup behavior. |
| **CHECK** | Arbitrary boolean expression must hold for the row. |

Constraints are **enforced at the storage layer, forever**, regardless of which code writes the row. That's why they're the strongest defense.

> **PRIMARY KEY ≠ FOREIGN KEY.** PK = "this is my identity." FK = "this points at another row's identity." The word `REFERENCES` is *syntax* used to define FK, not a separate constraint type.

### `ON CONFLICT` — the upsert clause

Add to INSERT to handle constraint violations gracefully:

```sql
INSERT INTO ... VALUES (...)
ON CONFLICT (<column>) DO NOTHING;

INSERT INTO ... VALUES (...)
ON CONFLICT (<column>) DO UPDATE SET col = EXCLUDED.col;
```

- **`DO NOTHING`** — silently skip on conflict. Use for: idempotent inserts, "create if not exists," seeding, duplicate webhook processing.
- **`DO UPDATE SET ... = EXCLUDED.<col>`** — full upsert. The `EXCLUDED` row refers to the values you tried to insert. Use for: settings tables, counters, atomic merges, batch state updates.

### Same race, four fixes — the canonical example

"Review once per day":

| Fix | SQL | Trade-off |
|---|---|---|
| **A. Constraint** | `UNIQUE (response_id, DATE(reviewed_at))` | Cleanest. Enforced forever. App catches `23505`. |
| **B. Atomic SQL** | `INSERT ... ON CONFLICT (...) DO NOTHING RETURNING id` | Single statement; check + write fused. Requires the UNIQUE constraint to exist. |
| **C. Row lock** | `SELECT ... FOR UPDATE` on a parent row, then check + insert | Works but awkward — need something existing to lock. |
| **D. Serializable** | `BEGIN ISOLATION LEVEL SERIALIZABLE` + check + insert + retry on `40001` | Heaviest. Reserve for cases A/B/C can't express. |

> For "this can only exist once" races, the right answer is almost always a UNIQUE constraint (often combined with `ON CONFLICT` for clean handling).

---

## Feature 9: Threads data modeling + migration basics

Modeled the first Threads tables from the product plan and pushed them with Drizzle.

### Product model

A **thread** is a semantic topic bucket for captured responses.

Example:
- `responses` = individual captured notes.
- `threads` = topic clusters like "Postgres", "React Query", "System Design".
- `response_threads` = assignment rows saying "this response belongs to this thread with this confidence."

### Many-to-many relationship

Threads and responses are many-to-many:

- One thread has many responses.
- One response can belong to multiple threads.

Adding `thread_id` directly on `responses` would only support one thread per response. Arrays like `thread_ids` or `response_ids` would make joins, foreign keys, indexing, updates, and relationship metadata harder.

So the relationship becomes a join table:

```sql
response_threads (
  response_id,
  thread_id,
  confidence,
  created_at
)
```

### Entity fields vs relationship fields

Rule learned:

> If a field describes an entity, put it on the entity table. If it describes the relationship between two entities, put it on the join table.

Applied:

- `threads.label` belongs on `threads`.
- `threads.label_locked` belongs on `threads` because it controls whether the auto-label job may rename that thread.
- `response_threads.confidence` belongs on `response_threads` because confidence means "this response belongs to this thread with score X."

### Constraints chosen

`threads`:

```sql
id serial primary key
label text not null
label_locked boolean not null default false
created_at timestamptz not null default now()
```

`response_threads`:

```sql
response_id int not null references responses(id) on delete cascade
thread_id int not null references threads(id) on delete cascade
confidence real not null
created_at timestamptz not null default now()
primary key (response_id, thread_id)
check (confidence >= 0 and confidence <= 1)
```

Important decisions:

- `PRIMARY KEY (response_id, thread_id)` prevents duplicate assignments like response 10 belonging to thread 3 twice.
- `ON DELETE CASCADE` fits because join rows have no independent meaning after the parent response/thread is deleted.
- `confidence` uses `0..1` because the product plan uses cosine-like thresholds such as `0.78`.
- `label` is not unique. Human-facing labels are display text, not identity; `threads.id` is identity.

### Drizzle implementation notes

- Composite primary keys are table-level constraints with `primaryKey({ columns: [...] })`.
- Range constraints use `check(...)` plus `sql`.
- Schema files must be exported from `lib/db/src/schema/index.ts`.
- `pnpm run typecheck:libs` passed after adding the schema.
- `pnpm --filter @workspace/db run push` applied the new tables cleanly in local Postgres.

### Migration lesson

Adding new empty tables is a low-risk local/dev migration. Risk grows when changing existing large tables.

For a required new field on a large existing table, safe rollout shape:

```text
add nullable/default-compatible schema
deploy app code that tolerates old + new data
backfill existing rows in batches
verify data is clean
enforce NOT NULL / stronger constraint
```

Key principle:

> Schema code is only the desired model. The database changes only after migration/push, and production changes need deploy-order and backfill planning.

---

## Parked queue

1. **Race condition fixes — practical walkthrough** — work through Learn5-specific examples (review-once-per-day, settings lost updates, card-question generation, streak counter) with the four-tool map.
2. **Window functions** — `ROW_NUMBER`, `RANK`, `LAG`, `PARTITION BY`. Heavy/conceptual; save for fresh attention.
3. **Subqueries + CTEs** — lighter, mechanical. Good complexity-alternation pick.
4. **Write-ahead log (WAL) + fsync** — *why* transactions have overhead. *How* durability is implemented. Pairs with the transactions deep-dive.
5. **DDL fundamentals — full** — `CREATE TABLE`, `ALTER TABLE`, migrations, expression indexes, partial indexes. (Constraints already covered as race-fix tool.)
6. **`SAVEPOINT`** — partial rollback to checkpoints inside a transaction.
7. **MVCC internals** — row visibility rules, `VACUUM`, bloat, transaction ID wraparound.
8. **Serverless backends** — cold starts, statelessness, why connection pooling becomes essential, platform poolers (RDS Proxy, Neon, Supabase).
9. **Real health checks** — verifying dependencies vs naive "I'm alive."
10. **Wire PATCH into focus-app** — codegen + React Query mutation + edit UI.
11. **Production monitoring basics** — what to measure on the DB (active connections, query latency, lock waits, pool wait time).
12. **More SQL** — JSON/JSONB, full-text search, pgvector (Learn5 Threads work).
13. **Postgres roles + authentication** — OS user vs DB role (why bare `psql` fails with `role "root" does not exist`), `-U` / connection strings, `CREATE ROLE`, grants, least-privilege for apps vs admin.
