import { db, pool, responsesTable } from "@workspace/db";

const ENTRIES: string[] = [
  // Programming & software
  "Learned that React's useEffect cleanup runs before the next effect, not just on unmount — caught a subtle subscription leak because of this.",
  "Discovered that CSS `gap` works in both flexbox and grid, so I can stop using margins on children entirely.",
  "TypeScript's `satisfies` operator checks a value against a type without widening it — way more precise than a plain type annotation.",
  "PostgreSQL's `EXPLAIN ANALYZE` shows actual vs estimated row counts — when they diverge wildly, it means the planner needs updated stats.",
  "Git's `--fixup` flag creates a commit that's automatically squashed into a target commit during interactive rebase.",
  "Learned about the Actor model for concurrency — instead of shared memory, actors communicate only via messages, which eliminates most race conditions.",
  "HTTP/2 multiplexes requests over a single TCP connection, so the old 'bundle everything' advice is less important now.",
  "Zod's `.transform()` runs after validation, so you can safely reshape data knowing the shape is correct.",
  "The `?? =` nullish assignment operator only assigns if the left side is null or undefined, not just falsy.",
  "Drizzle ORM generates SQL at build time, not runtime, which makes query shapes predictable and type-safe.",
  "WebSockets keep a persistent connection open, while Server-Sent Events are one-way and work over regular HTTP — SSE is often simpler for push notifications.",
  "Content-Security-Policy headers can prevent XSS by whitelisting script origins — should be on every production app.",
  "Learned that `structuredClone` is now built into modern JS and does a true deep clone, no library needed.",
  "Debounce delays execution until activity stops; throttle ensures it runs at most once per interval. They solve different problems.",
  "Expo's `expo-notifications` requires a native build for push — Expo Go only supports local notifications.",
  "React Query's `staleTime` controls how long cached data is considered fresh before a background refetch is triggered.",
  "esbuild compiles TypeScript by stripping types without checking them — run `tsc --noEmit` separately for safety.",
  "An index on a foreign key column avoids full table scans on JOIN — easy win for large tables.",
  "Learned the difference between `position: fixed` (relative to viewport) and `position: sticky` (relative to scroll container).",
  "The `Intl.RelativeTimeFormat` API formats relative dates ('3 days ago') with locale support, no library needed.",
  "CSS custom properties (variables) can be changed by JS at runtime, enabling theme switching without a class toggle on body.",
  "Learned that `Promise.allSettled` waits for all promises regardless of failures — useful when you want partial results.",
  "React's `key` prop doesn't just help diffing — it completely resets a component's state when changed.",
  "Pino logger is significantly faster than Winston because it defers JSON serialization to a worker thread.",
  "SQL window functions like `ROW_NUMBER() OVER (PARTITION BY ...)` let you rank within groups without a subquery.",
  "gzip and brotli compress text assets — brotli gets 15-20% better ratios but needs HTTPS, which is standard now.",
  "Learned that `navigator.onLine` only checks if there's a network interface, not real connectivity — fetch is the only reliable check.",
  "The `Intersection Observer` API replaces scroll listeners for visibility detection and is much more performant.",
  "Module federation in webpack lets multiple apps share code at runtime — complex but powerful for micro-frontends.",
  "Learned how `requestAnimationFrame` batches DOM reads and writes to prevent layout thrashing.",

  // Science & math
  "The central limit theorem says that averages of large samples are normally distributed regardless of the underlying distribution.",
  "Entropy isn't just disorder — it's the number of microstates that produce the same macrostate. Higher entropy = more ways to be.",
  "Neurons don't actually 'fire faster' when you're smarter — it's the efficiency of pruning unused connections that matters.",
  "The Monty Hall problem works because switching gives you a 2/3 chance. Conditioning on new information updates probabilities.",
  "Bayes' theorem: posterior = likelihood × prior / evidence. Start with a belief, update it with data.",
  "Light slows down when it enters a denser medium, but its frequency stays the same — only the wavelength shortens.",
  "DNA polymerase can only add nucleotides in the 5' to 3' direction, which is why the lagging strand needs Okazaki fragments.",
  "P vs NP asks whether problems easy to verify are also easy to solve. Most cryptography assumes the answer is no.",
  "The Dunning-Kruger effect is often misunderstood — it's not that idiots think they're smart, it's that everyone overestimates themselves in new domains.",
  "Statistical significance doesn't mean practical significance. A p-value tells you noise level, not effect size.",
  "Learned that osmosis is specifically water moving across a semipermeable membrane — other solvents doing similar things are called 'solvent flux'.",
  "The immune system's memory B cells are why vaccines work — they remember pathogen signatures and produce antibodies faster on re-exposure.",
  "Quantum superposition collapses upon measurement, but 'measurement' just means interaction with the environment (decoherence).",
  "The Fibonacci sequence appears in nature because it's the most efficient packing — sunflower seeds, pinecone spirals.",
  "Plate tectonics is driven by convection in the mantle — hotter material rises, cools, sinks, creating circulation cells.",

  // Mental models & thinking
  "First-principles thinking means breaking a problem down to its fundamental truths and rebuilding from there, not from analogy.",
  "Inversion: instead of asking how to succeed, ask how to avoid failure. Often clearer.",
  "Availability heuristic: we overestimate the probability of things we can easily recall, like plane crashes vs car crashes.",
  "Second-order thinking: consider the consequences of consequences, not just the immediate effect.",
  "Survivorship bias: we see successful startups, not the 95% that failed quietly. Be careful generalizing from visible examples.",
  "Opportunity cost is real even when you're not paying money — choosing to do X means not doing Y.",
  "Learned the concept of 'activation energy' for habits — reducing friction for good habits is as important as motivation.",
  "Occam's Razor isn't just 'simpler is better' — it's that you shouldn't multiply entities beyond necessity.",
  "The map is not the territory. Mental models are approximations, and treating them as reality causes errors.",
  "Hanlon's Razor: don't attribute to malice what can be adequately explained by negligence.",
  "Regression to the mean explains why 'sophomore slumps' happen — extreme performances tend to be followed by average ones.",
  "Chesterton's Fence: before removing something that seems useless, understand why it was put there.",

  // Productivity & learning
  "The Feynman technique: explain a concept simply enough for a beginner. Where you get stuck reveals what you don't actually understand.",
  "Spaced repetition works because forgetting and recalling strengthens memory more than repeated reading.",
  "Interleaving different topics during study is harder but leads to better long-term retention than blocking.",
  "Context switching has a real cost — it takes ~23 minutes to fully refocus after an interruption.",
  "Writing forces you to find the gaps in your thinking. Vague ideas become precise or fall apart.",
  "The Pomodoro technique isn't just about focus — it's about making progress visible and building momentum.",
  "Learned that 'inbox zero' isn't really about email volume — it's about a system you trust so nothing lingers in your head.",
  "Deliberate practice means working at the edge of your ability with immediate feedback, not just doing the activity.",
  "Retrieval practice (testing yourself) is more effective than re-reading for long-term retention.",
  "Flow states require a challenge-skill balance: too easy = boredom, too hard = anxiety.",

  // Business & economics
  "Price elasticity measures how sensitive demand is to price changes. Inelastic goods (insulin) see little change; elastic goods (luxury cars) see a lot.",
  "Network effects mean a product becomes more valuable as more people use it — this is the moat behind most tech monopolies.",
  "The innovator's dilemma: established companies fail not because they're bad at their jobs but because they're too good at serving existing customers.",
  "Learned the difference between revenue and profit. Revenue is the top line; profit is what's left after costs.",
  "Compounding works on bad habits and debts too. The math runs both directions.",
  "A moat is a sustainable competitive advantage — brand, switching costs, network effects, cost advantages, or efficient scale.",
  "The principal-agent problem: when someone acts on behalf of another, their incentives may not be aligned.",
  "Vilfredo Pareto noticed 80% of Italy's land was owned by 20% of people. The 80/20 pattern shows up everywhere.",
  "Learned the concept of 'dead-weight loss' — inefficiency created when the equilibrium is not achieved in a market.",
  "Loss aversion: people feel losses about twice as intensely as equivalent gains. Affects product design as much as finance.",

  // History & culture
  "The printing press didn't just spread information — it standardized language and created national identities.",
  "The Byzantine Empire lasted over 1000 years after the fall of Rome and preserved much of Greek and Roman knowledge.",
  "The industrial revolution was as much about organizational change (factories, clocks, wages) as about machines.",
  "Learned that the word 'salary' comes from Latin 'salarium' — possibly related to salt as payment for Roman soldiers.",
  "The Great Fire of London in 1666 led directly to the first fire insurance industry and modern urban planning.",
  "Learned that serfdom in Russia wasn't abolished until 1861, the same year as the US Civil War.",

  // Health & psychology
  "Sleep consolidates memories — the hippocampus replays experiences during slow-wave sleep to transfer them to long-term storage.",
  "Cortisol isn't just a 'stress hormone' — it also regulates blood sugar, metabolism, and immune response.",
  "The gut-brain axis is a real bidirectional communication system. Gut bacteria produce ~90% of the body's serotonin.",
  "Learned about proprioception — the sense of where your body is in space. It's why you can touch your nose with eyes closed.",
  "Cardiovascular exercise increases BDNF (brain-derived neurotrophic factor), which promotes neuron growth and learning.",
  "The placebo effect is strongest for pain and depression — and knowing it's a placebo doesn't always eliminate the effect.",
  "Cold exposure activates brown adipose tissue, which burns energy to generate heat rather than storing it.",
  "Intermittent fasting works partly by extending the overnight insulin-low period, allowing fat oxidation to continue.",
  "Learned that muscle soreness (DOMS) peaks 24-72 hours after exercise, not immediately — it's inflammation, not lactic acid.",
  "Chronic stress literally shrinks the prefrontal cortex and grows the amygdala — the opposite of what you want.",

  // Design & creativity
  "Gestalt principles (proximity, similarity, continuity) describe how the brain groups visual elements automatically.",
  "White space isn't empty — it creates breathing room and directs attention. Lack of it is why crowded UIs feel overwhelming.",
  "Fitts's Law: the time to hit a target depends on the distance and the size of the target. Big, close buttons are easier.",
  "Miller's Law: working memory holds about 7 ± 2 items. This is why phone numbers are chunked.",
  "Dark patterns are UI designs that trick users into doing things they didn't intend — cookie banners and pre-checked boxes.",
  "Hick's Law: more choices = longer decision time. Reducing options speeds up decision-making.",
  "The squint test: squint at a design until it blurs. What stands out is what has visual weight — check it matches priority.",
  "Learned about the principle of progressive disclosure — reveal complexity gradually as users need it.",
  "Typography hierarchy communicates importance before anyone reads a word. Size, weight, and color all carry meaning.",

  // Communication
  "Learned the 'BLUF' principle from military writing: Bottom Line Up Front. State the conclusion before the supporting details.",
  "Active listening means listening to understand, not to respond. Most people are already composing their reply.",
  "Nonviolent communication: observations (facts) vs evaluations (judgments). 'You're always late' vs 'The meeting started at 3 and you arrived at 3:20'.",
  "The curse of knowledge: once you know something, it's hard to remember what it was like not to know it.",
  "Learned that hedging language ('I think', 'maybe', 'sort of') reduces perceived competence even when it's accurate.",
  "Amazon's 'working backwards' process: write the press release for the finished product before building it.",
  "Learned about the 'mum effect' — people are reluctant to share bad news upward, which distorts organizational information flow.",

  // Finance & investing
  "Dollar-cost averaging reduces the emotional weight of timing the market — you buy at all prices, which averages out.",
  "The equity risk premium is the extra return investors demand for holding stocks over risk-free bonds.",
  "Learned the difference between systematic risk (market-wide) and idiosyncratic risk (company-specific). Diversification eliminates the latter.",
  "Options give the right but not the obligation to buy or sell — the optionality itself has value even without exercising.",
  "Learned what EBITDA means: Earnings Before Interest, Taxes, Depreciation, and Amortization — a rough proxy for operating cash flow.",
  "Rebalancing a portfolio forces you to buy low and sell high systematically — the opposite of what emotion drives.",

  // Nature & environment
  "Mycorrhizal networks connect tree roots underground and allow nutrient sharing between trees — the 'wood wide web'.",
  "Coral bleaching happens when water is too warm and the coral expels its algae (zooxanthellae), losing its color and food source.",
  "Wolves reintroduced to Yellowstone changed the behavior of elk, which allowed rivers to reshape — a trophic cascade.",
  "The Great Pacific Garbage Patch is mostly microplastics, not a floating island of visible trash.",
  "Permafrost stores more carbon than all the world's forests combined — its melting is a critical feedback loop.",
  "Learned about biomimicry — bullet trains were redesigned based on the kingfisher's beak to reduce the sonic boom at tunnel exits.",

  // More programming
  "React Server Components run on the server and send HTML — no JS bundle for those components, and they can query the DB directly.",
  "Learned about CRDT (Conflict-free Replicated Data Types) — data structures that auto-merge without conflicts, used in collaborative editors.",
  "The CAP theorem: a distributed system can guarantee only two of three: Consistency, Availability, Partition tolerance.",
  "Memory-mapped files let you treat a file like an array in memory — the OS handles buffering. Useful for large files.",
  "WebAssembly runs at near-native speed and can be compiled from C, Rust, Go — opens native-performance code in the browser.",
  "Learned about tail-call optimization — when a function's last operation is a recursive call, it can reuse the current stack frame.",
  "The event loop in Node.js: sync code runs first, then microtasks (Promise callbacks), then macrotasks (setTimeout, I/O).",
  "Service workers intercept network requests and can serve cached responses — the foundation for PWA offline support.",
  "Learned that `structuredClone` handles circular references, while JSON.parse(JSON.stringify()) does not.",
  "Regex lookaheads (`(?=...)`) match a position, not characters — so you can use them without consuming input.",
  "Database transactions have ACID properties: Atomicity, Consistency, Isolation, Durability.",
  "The repository pattern separates data access logic from business logic, making both easier to test independently.",
  "OAuth 2.0 separates authentication (who you are) from authorization (what you can do) — OIDC adds identity on top.",
  "Learned that CSS `contain: layout` prevents a subtree from affecting the rest of the page's layout — good for perf.",
  "BigInt in JavaScript handles integers larger than 2^53 safely — regular numbers lose precision beyond that.",
  "ESM (ES Modules) are statically analyzed at parse time; CommonJS (require) runs at runtime. That's why tree-shaking works with ESM.",
  "Learned what a memory leak looks like in the Node.js event loop: a timer, interval, or listener that's never cleaned up.",
  "CORS preflight requests happen when you use a non-simple HTTP method or header — the browser sends OPTIONS first.",
  "Learned about JIT compilation: code is interpreted initially, then hot paths are compiled to machine code at runtime.",
  "The `finally` block in a try-catch runs even if there's an early return — good for cleanup, easy to forget.",
];

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number, hourOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hourOffset, randomBetween(0, 59), randomBetween(0, 59), 0);
  return d;
}

async function seed() {
  console.log("Seeding 200 dummy journal entries…");

  // Shuffle the entry texts so they aren't in topic blocks
  const shuffled = [...ENTRIES].sort(() => Math.random() - 0.5);

  // Build 200 rows spread over the last 30 days
  // Vary entries-per-day to feel natural: some days 3-4, some days 10-12
  const rows: { text: string; skipped: boolean; createdAt: Date }[] = [];

  let entryIdx = 0;
  const totalDays = 30;

  for (let day = 0; day < totalDays && rows.length < 200; day++) {
    const daysBack = totalDays - day; // oldest first
    // More entries on recent days to feel realistic
    const count = Math.min(
      randomBetween(4, 10),
      200 - rows.length,
    );

    // Spread throughout waking hours (7am – 10pm)
    const hours = Array.from({ length: count }, () =>
      randomBetween(7, 22),
    ).sort((a, b) => a - b);

    for (let i = 0; i < count; i++) {
      const text = shuffled[entryIdx % shuffled.length]!;
      entryIdx++;

      // ~8% of entries are skips (no text)
      const skipped = Math.random() < 0.08;

      rows.push({
        text: skipped ? "" : text,
        skipped,
        createdAt: daysAgo(daysBack, hours[i]),
      });
    }
  }

  // Insert in batches of 50
  const BATCH = 50;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await db.insert(responsesTable).values(batch);
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${rows.length}`);
  }

  console.log(`Done — ${rows.length} entries seeded.`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
