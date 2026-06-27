-- ===========================================================================
-- Seed test data for Learn5 (~100k responses + ~500k reviews)
-- For learning indexes + EXPLAIN. Skewed distribution.
-- Run inside psql: \i seed-test-data.sql
-- Or copy/paste section by section.
-- ===========================================================================

-- Step 1: Wipe existing data.
-- TRUNCATE is much faster than DELETE for clearing entire tables.
-- RESTART IDENTITY resets the auto-incrementing id sequences back to 1.
-- CASCADE also wipes tables that have foreign keys referencing responses
-- (card_reviews, card_questions, card_schedules).
TRUNCATE responses RESTART IDENTITY CASCADE;


-- Step 2: Insert 100,000 fake responses.
-- BEGIN/COMMIT wraps everything in a single transaction.
-- Why: one transaction is ~10x faster than 100k separate transactions,
-- and if anything fails midway, the whole thing rolls back atomically.
BEGIN;

INSERT INTO responses (text, skipped, created_at)
SELECT
  -- text: 'response 1', 'response 2', ..., 'response 100000'
  'response ' || i,
  -- skipped: random() returns a float in [0, 1). True ~10% of the time.
  (random() < 0.1),
  -- created_at: random timestamp in the past 365 days
  NOW() - (random() * INTERVAL '365 days')
FROM generate_series(1, 100000) AS s(i);
-- generate_series(1, N) is a Postgres function that returns N rows of integers
-- from 1 to N. Combined with INSERT...SELECT, you can produce N rows in one shot.

COMMIT;


-- Step 3: Insert 500,000 fake card_reviews with SKEWED distribution.
-- The skew comes from power(random(), 2), which biases toward 0:
--   random()           is uniform in [0, 1)
--   power(random(), 2) is squashed toward 0   (e.g., 0.5 → 0.25)
-- So multiplying by 100000 picks LOW response_ids more often than HIGH ones.
-- Result: some responses get many reviews; many get few; some get zero.
BEGIN;

INSERT INTO card_reviews (response_id, result, reviewed_at)
SELECT
  -- floor(...) + 1 ensures the value is in [1, 100000] (never 0, never 100001)
  1 + floor(100000 * power(random(), 2))::int,
  -- result: ~70% remembered, ~30% forgot
  CASE WHEN random() < 0.7 THEN 'remembered' ELSE 'forgot' END,
  -- reviewed_at: random timestamp in the past 365 days
  NOW() - (random() * INTERVAL '365 days')
FROM generate_series(1, 500000);

COMMIT;


-- Step 4: Refresh the planner's statistics.
-- Postgres tracks column distributions (how many rows, common values, etc.)
-- to plan queries. Without ANALYZE after a bulk load, the planner will keep
-- using its old assumptions ("table has 200 rows") and pick bad plans.
ANALYZE responses;
ANALYZE card_reviews;


-- Step 5: Sanity check. Should print something like:
--   responses_count | reviews_count
--   ----------------+---------------
--             100000|         500000
SELECT
  (SELECT COUNT(*) FROM responses) AS responses_count,
  (SELECT COUNT(*) FROM card_reviews) AS reviews_count;
