import { PhoneFrame, Header, TabBar, Chip, tokens } from "./_shared";

type Entry = { id: number; time: string; text: string; confidence?: "high" | "low" };
type Day = { label: string; entries: Entry[] };

const days: Day[] = [
  {
    label: "Today · May 25",
    entries: [
      {
        id: 1,
        time: "10:42",
        text:
          "VACUUM doesn't return space to the OS — it just marks pages reusable. VACUUM FULL rewrites the table, which needs an exclusive lock.",
      },
      {
        id: 2,
        time: "09:15",
        text: "autovacuum_vacuum_scale_factor defaults to 0.2 — so a 1M-row table won't vacuum until 200k dead tuples. That's why big tables bloat silently.",
      },
    ],
  },
  {
    label: "Yesterday",
    entries: [
      {
        id: 3,
        time: "18:03",
        text: "MVCC keeps old row versions until no transaction can see them — long-running queries can block cleanup.",
      },
      {
        id: 4,
        time: "11:20",
        text: "xmin/xmax columns are the visibility map for each tuple. Worth remembering when debugging snapshot isolation.",
        confidence: "low",
      },
    ],
  },
  {
    label: "May 21",
    entries: [
      {
        id: 5,
        time: "14:55",
        text: "Snapshot isolation in Postgres is REPEATABLE READ — different from SERIALIZABLE which adds SSI predicate locks.",
      },
    ],
  },
];

export default function ThreadDigestPreview() {
  return (
    <div style={{ padding: 32, background: "#eef0f5", minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <PhoneFrame title="Thread digest">
        <Header
          back
          title="Postgres MVCC"
          subtitle="23 entries · 12 cards due"
          right={
            <div style={{ display: "flex", gap: 6 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: tokens.secondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✎
              </div>
              <div
                style={{
                  height: 36,
                  borderRadius: 12,
                  background: tokens.primary,
                  color: "white",
                  padding: "0 14px",
                  display: "flex",
                  alignItems: "center",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Quiz ▶
              </div>
            </div>
          }
        />

        <div style={{ padding: "0 20px 12px", display: "flex", gap: 8 }}>
          <Chip active>Notes</Chip>
          <Chip>Cards</Chip>
          <Chip>Filtered (2)</Chip>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
          {days.map((d) => (
            <div key={d.label} style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: tokens.mutedFg,
                  padding: "8px 4px",
                }}
              >
                {d.label}
              </div>
              {d.entries.map((e) => (
                <div
                  key={e.id}
                  style={{
                    background: tokens.card,
                    border: `1px solid ${tokens.border}`,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: tokens.mutedFg,
                      marginBottom: 6,
                    }}
                  >
                    <span>{e.time}</span>
                    <span style={{ display: "flex", gap: 8 }}>
                      {e.confidence === "low" && (
                        <span style={{ color: tokens.noise }}>~ low confidence</span>
                      )}
                      <span>•••</span>
                    </span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, color: tokens.text }}>{e.text}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <TabBar active="review" />
      </PhoneFrame>
    </div>
  );
}
