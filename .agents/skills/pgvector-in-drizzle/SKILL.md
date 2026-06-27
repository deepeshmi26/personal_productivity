---
name: pgvector-in-drizzle
description: Use when adding pgvector support to Learn5's Postgres + Drizzle backend — extension setup, choosing index types (HNSW vs IVFFlat), cosine distance query patterns, dimensionality trade-offs, and Drizzle ORM integration. Trigger on any task involving `vector(...)` columns, embeddings storage, similarity search, nearest-neighbour queries, or pgvector migrations.
---

# pgvector in Drizzle (Learn5)

> Source of truth for vector storage in this codebase. The Threads initiative ([docs/product/threads-intelligent-question-generation.md](../../../docs/product/threads-intelligent-question-generation.md)) introduces embedding storage and nearest-thread lookups; this skill is how we do it.

## When to load this skill

- Designing or migrating a `vector(N)` column
- Choosing or tuning an ANN index
- Writing similarity-search queries (cosine / L2 / inner product)
- Debugging slow vector queries (`EXPLAIN ANALYZE`)
- Drizzle schema work for embedding tables

## 1. Setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Put this in the **first migration** for any package that uses vectors. Drizzle's `pnpm --filter @workspace/db run push` will execute it if it's in a migration file; for ad-hoc dev, run via `psql`.

`docker-compose.yml` already uses `postgres:16` — pgvector is **not bundled**. Either:
- Switch the image to `pgvector/pgvector:pg16` (recommended for parity with prod), OR
- Install the extension manually inside the container

Prefer the image swap. It's a one-line change and avoids drift between dev and prod.

## 2. Drizzle schema

Drizzle ORM has first-party pgvector support via `drizzle-orm/pg-core`'s `vector()` column type. Use it directly — don't roll a custom type.

```ts
// lib/db/src/schema/response_embeddings.ts
import { pgTable, integer, text, timestamp, vector, index } from "drizzle-orm/pg-core";
import { responsesTable } from "./responses";

export const responseEmbeddingsTable = pgTable(
  "response_embeddings",
  {
    responseId: integer("response_id")
      .primaryKey()
      .references(() => responsesTable.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    model: text("model").notNull(), // e.g. "text-embedding-3-small"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // See §4 below before deciding HNSW vs IVFFlat.
    index("response_embeddings_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);
```

**Why PK = responseId (not a serial id):** one embedding per response, FK to responses already gives us identity. Skips an extra index and keeps joins cheap.

## 3. Model & dimensionality

| Model | Dims | $/M tokens | When |
|---|---|---|---|
| `text-embedding-3-small` | 1536 | $0.02 | **Default for Learn5.** Plenty for short journal entries; cheap. |
| `text-embedding-3-small` | 512 | $0.02 | Use `dimensions: 512` param if you want a smaller index and 90%+ recall — half the index size. Consider for V2+. |
| `text-embedding-3-large` | 3072 | $0.13 | Only if recall is provably bad at small/1536. ~6× cost. |

Document the model in the row (`model` column above) so you can re-embed without ambiguity when you upgrade.

## 4. Index choice: HNSW vs IVFFlat

**Default: HNSW.** Better recall/speed at Learn5's scale (single user → <100k vectors for years).

| | HNSW | IVFFlat |
|---|---|---|
| Build time | Slow | Fast |
| Build memory | High | Low |
| Query speed | Faster | Slower |
| Recall at default settings | Higher | Tunable but lower |
| Needs training data? | No | **Yes** — must build *after* loading representative rows |
| Good for | Small-to-medium corpora, mostly-static or append-only | Very large corpora (10M+), batch-loaded |

For Threads at solo-user scale: HNSW, default params, done. Revisit only if build time becomes painful or memory pressure shows up — neither is plausible until >>100k vectors.

```sql
-- Cosine similarity (matches OpenAI embeddings convention)
CREATE INDEX response_embeddings_hnsw
  ON response_embeddings
  USING hnsw (embedding vector_cosine_ops);
```

**Operator class must match query operator.** `vector_cosine_ops` → use `<=>`. Other options: `vector_l2_ops` (`<->`), `vector_ip_ops` (`<#>`). Pick once, stick with it. OpenAI embeddings are normalized → cosine and inner-product give identical rankings, but cosine reads more clearly.

## 5. Query patterns

### Nearest neighbour
```ts
import { sql } from "drizzle-orm";

const nearest = await db
  .select({
    responseId: responseEmbeddingsTable.responseId,
    distance: sql<number>`${responseEmbeddingsTable.embedding} <=> ${queryEmbedding}`.as("distance"),
  })
  .from(responseEmbeddingsTable)
  .orderBy(sql`${responseEmbeddingsTable.embedding} <=> ${queryEmbedding}`)
  .limit(10);
```

**Always `ORDER BY` the same expression you `SELECT`** — the planner only uses the index when the `ORDER BY` matches. Aliasing the SELECT does not help the planner; the raw expression in `ORDER BY` is what matters.

### Filtered nearest neighbour (the gotcha)
HNSW + a `WHERE` clause can degrade to a sequential scan if the filter is too selective. For Threads, our common query is "nearest centroid among threads with `>=5 entries`" — but centroids live on the `threads` table, not on `response_embeddings`. Keep filterable columns on the same table as the vector OR pre-filter into a small candidate set first.

Rule of thumb:
- Filter selects >5% of rows → index helps.
- Filter selects <1% → index might be skipped; consider a partial index or pre-filter.

### Distance vs similarity
Cosine **distance** is `1 - cosine_similarity`. So `WHERE embedding <=> $1 < 0.22` ≈ `similarity > 0.78` (the threshold from the PRD).

## 6. Performance & verification

Always `EXPLAIN ANALYZE` a new vector query:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT response_id, embedding <=> '[...]'::vector AS d
FROM response_embeddings
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;
```

Look for:
- `Index Scan using response_embeddings_hnsw` → good.
- `Seq Scan` → index not used. Check operator class match, ORDER BY shape, planner cost estimates.
- Buffers `read` >> `hit` → cold cache; warm-up matters on first query after restart.

## 7. Things not to do

- **Don't store raw vectors as `jsonb` or `float[]`.** Loses the index, loses the operators.
- **Don't pick HNSW + IVFFlat both** "to be safe." Two indexes double write cost; the planner picks one anyway.
- **Don't normalize manually before insert.** OpenAI embeddings are already L2-normalized.
- **Don't change dimensions or model without re-embedding.** Mixed-dimension rows in one column won't even insert; mixed-model rows will silently produce garbage similarities.
- **Don't `SELECT embedding` over the wire when you don't need to.** 1536 floats × 4 bytes = ~6KB per row.

## 8. Backfill / migration pattern

For Learn5: PRD says **no backfill required** (DB will be wiped pre-launch). When backfill *is* needed later:

1. Add the column nullable, deploy.
2. Background job batch-embeds in chunks of 100 with retries.
3. Add the index **after** backfill (`CREATE INDEX CONCURRENTLY` for live tables; HNSW build is slow on large tables — budget for it).
4. Set `NOT NULL` once backfill is verified.

## 9. References in this repo

- DB package: `lib/db`
- Existing schema files: `lib/db/src/schema/*.ts` (mirror their style — table per file, exported `*Table`, plus `$inferSelect` type alias)
- Threads PRD §4 "Tech reconciliation" — the canonical decisions this skill encodes
