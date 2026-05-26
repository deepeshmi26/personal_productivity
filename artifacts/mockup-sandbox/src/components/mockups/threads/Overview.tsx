import ThreadList from "./ThreadList";
import ThreadDigest from "./ThreadDigest";
import ThreadQuiz from "./ThreadQuiz";
import NoiseFiltering from "./NoiseFiltering";
import { tokens } from "./_shared";

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ maxWidth: 720, margin: "0 auto 18px", padding: "0 24px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: tokens.text, fontFamily: tokens.font }}>{title}</div>
        <div style={{ fontSize: 14, color: tokens.mutedFg, marginTop: 4, lineHeight: 1.5, fontFamily: tokens.font }}>
          {blurb}
        </div>
      </div>
      <div style={{ background: "transparent" }}>{children}</div>
    </div>
  );
}

export default function ThreadsOverview() {
  return (
    <div
      style={{
        background: "#eef0f5",
        minHeight: "100vh",
        paddingTop: 32,
        paddingBottom: 64,
        fontFamily: tokens.font,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto 32px", padding: "0 24px", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: tokens.primary, letterSpacing: 1, textTransform: "uppercase" }}>
          Learn5 · Threads initiative
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: tokens.text, marginTop: 6, letterSpacing: -0.4 }}>
          Mock designs for intelligent question generation
        </div>
        <div style={{ fontSize: 14, color: tokens.mutedFg, marginTop: 8, lineHeight: 1.5 }}>
          Static mocks for the four surfaces that ship across Phase 1 (noise) and Phase 2 (threads):
          thread filter on review, thread digest, thread-scoped quiz, and the noise refinement UI.
        </div>
      </div>

      <Section
        title="1. Thread list (filter on Review)"
        blurb="Per the plan, Threads surfaces as a filter on the existing review screen — not a new tab. Each row shows label, due cards, last activity, and a preview. Pencil indicates a user-renamed (locked) label. A dashed footer reveals the cold-start gate (threads under 5 entries stay hidden)."
      >
        <ThreadList />
      </Section>

      <Section
        title="2. Thread digest"
        blurb="Single thread shown as one consolidated note doc, entries grouped by day. Two tabs reachable inline: Cards (jump straight to a thread-scoped session) and Filtered (entries auto-flagged within this thread). Header offers Rename (the only management surface in V2) and a primary Quiz CTA."
      >
        <ThreadDigest />
      </Section>

      <Section
        title="3. Thread-scoped quiz"
        blurb="Quiz cards carry a thread chip so the user knows what's being drilled. Self-rated Got it / Missed it matches the plan's explicit self-grading decision. Mark as noise lives on the question itself (catches false negatives at moment of friction). Empty state routes to the digest when no cards are due — answering the plan's open question 9."
      >
        <ThreadQuiz />
      </Section>

      <Section
        title="4. Noise filtering UI"
        blurb="Two surfaces per E9: a Filtered tab on Journal (restore is the only place false-positive recovery lives) and a Mark as noise affordance on each entry. Filtered entries are visually de-emphasized but never destroyed — they retain a reason chip so the user understands why the system flagged them."
      >
        <NoiseFiltering />
      </Section>
    </div>
  );
}
