import { PhoneFrame, Header, TabBar, Chip, tokens } from "./_shared";

type Thread = {
  id: number;
  label: string;
  locked?: boolean;
  entries: number;
  dueCards: number;
  lastActive: string;
  preview: string;
  trend?: "up" | "flat";
};

const threads: Thread[] = [
  {
    id: 1,
    label: "Postgres MVCC",
    entries: 23,
    dueCards: 12,
    lastActive: "2h ago",
    preview: "Vacuum reclaims dead tuples but doesn't return disk to OS unless FULL…",
    trend: "up",
    locked: true,
  },
  {
    id: 2,
    label: "React Native",
    entries: 18,
    dueCards: 5,
    lastActive: "Yesterday",
    preview: "Reanimated worklets run on UI thread — can't close over JS state mutably…",
    trend: "up",
  },
  {
    id: 3,
    label: "Rust ownership",
    entries: 14,
    dueCards: 0,
    lastActive: "3d ago",
    preview: "Borrow checker rejects two mutable refs in same scope, even if non-overlapping…",
  },
  {
    id: 4,
    label: "SRS scheduling",
    entries: 9,
    dueCards: 3,
    lastActive: "5d ago",
    preview: "SM-2's ease factor floors at 1.3 — beyond that, card stays in 'learning'…",
  },
  {
    id: 5,
    label: "Embeddings & search",
    entries: 7,
    dueCards: 2,
    lastActive: "1w ago",
    preview: "Cosine ~0.78 felt like the sweet spot for short-form notes…",
  },
];

export default function ThreadListPreview() {
  return (
    <div style={{ padding: 32, background: "#eef0f5", minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <PhoneFrame title="Review — Thread filter">
        <Header
          title="Review"
          subtitle="22 cards due across 5 threads"
          right={
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                background: tokens.primary,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              ▶
            </div>
          }
        />

        <div style={{ padding: "0 20px 12px", display: "flex", gap: 8, overflowX: "auto" }}>
          <Chip active>All</Chip>
          <Chip count={5}>Threads</Chip>
          <Chip>Due today</Chip>
          <Chip>Recent</Chip>
        </div>

        <div
          style={{
            padding: "6px 20px 8px",
            fontSize: 11,
            color: tokens.mutedFg,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Live threads</span>
          <span style={{ color: tokens.primary }}>Sort: Activity</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
          {threads.map((t) => (
            <div
              key={t.id}
              style={{
                background: tokens.card,
                borderRadius: tokens.radius,
                padding: 16,
                marginBottom: 10,
                border: `1px solid ${tokens.border}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background: t.dueCards > 0 ? tokens.primary : tokens.border,
                    }}
                  />
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{t.label}</div>
                  {t.locked && (
                    <span style={{ fontSize: 11, color: tokens.mutedFg }}>✎</span>
                  )}
                </div>
                {t.dueCards > 0 ? (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: tokens.accent,
                      color: tokens.accentFg,
                      padding: "3px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {t.dueCards} due
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: tokens.mutedFg }}>No cards due</span>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: tokens.mutedFg,
                  marginTop: 8,
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {t.preview}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 10,
                  fontSize: 11,
                  color: tokens.mutedFg,
                }}
              >
                <span>{t.entries} entries · {t.lastActive}</span>
                <span style={{ color: tokens.primary, fontWeight: 600 }}>Open digest ›</span>
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: 6,
              padding: 12,
              borderRadius: 12,
              border: `1px dashed ${tokens.border}`,
              fontSize: 12,
              color: tokens.mutedFg,
              textAlign: "center",
            }}
          >
            3 emerging threads hidden (under 5 entries)
          </div>
        </div>

        <TabBar active="review" />
      </PhoneFrame>
    </div>
  );
}
