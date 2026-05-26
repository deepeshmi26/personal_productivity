import { PhoneFrame, Header, TabBar, Chip, tokens } from "./_shared";

export default function NoiseFilteringPreview() {
  return (
    <div style={{ padding: 32, background: "#eef0f5", minHeight: "100vh", display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
      {/* Journal with auto-filter banner + Filtered section */}
      <PhoneFrame title="Journal · filtered section">
        <Header
          title="Journal"
          subtitle="142 entries · 18 filtered"
        />
        <div style={{ padding: "0 20px 12px", display: "flex", gap: 8 }}>
          <Chip active>All</Chip>
          <Chip count={5}>Threads</Chip>
          <Chip count={18} style={{ color: tokens.noise, background: tokens.noiseBg }}>
            Filtered
          </Chip>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 16px" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: tokens.mutedFg,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              padding: "8px 4px",
            }}
          >
            Filtered · Today
          </div>

          {[
            { id: 1, text: "buy milk", reason: "todo", time: "08:12" },
            {
              id: 2,
              text: "feeling tired today, lots of meetings",
              reason: "feeling",
              time: "10:30",
            },
            {
              id: 3,
              text: "Dentist 3pm friday don't forget",
              reason: "logistics",
              time: "11:05",
            },
          ].map((e) => (
            <div
              key={e.id}
              style={{
                background: tokens.card,
                border: `1px solid ${tokens.border}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 8,
                opacity: 0.92,
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
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      background: tokens.noiseBg,
                      color: tokens.noise,
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 600,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    {e.reason}
                  </span>
                  <span>{e.time}</span>
                </span>
                <span
                  style={{
                    color: tokens.primary,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  Restore ↺
                </span>
              </div>
              <div style={{ fontSize: 14, color: tokens.text, lineHeight: 1.4 }}>{e.text}</div>
              <div style={{ fontSize: 11, color: tokens.mutedFg, marginTop: 8 }}>
                Won't generate quiz cards. Restore to add back to your threads.
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: tokens.accent,
              color: tokens.accentFg,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>How filtering works</div>
            Short, off-topic, or duplicate captures are auto-flagged so your quiz stays focused.
            Anything restored is added back to your threads.
          </div>
        </div>

        <TabBar active="journal" />
      </PhoneFrame>

      {/* Entry detail with Mark as noise */}
      <PhoneFrame title="Entry · mark as noise">
        <Header
          back
          title="Entry"
          subtitle="May 24 · 14:22"
          right={
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
              ⋯
            </div>
          }
        />

        <div style={{ padding: "0 20px", flex: 1, overflowY: "auto" }}>
          <div
            style={{
              background: tokens.card,
              border: `1px solid ${tokens.border}`,
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  background: tokens.accent,
                  color: tokens.accentFg,
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                Postgres MVCC
              </span>
              <span style={{ fontSize: 11, color: tokens.mutedFg, alignSelf: "center" }}>
                auto-assigned · 0.82
              </span>
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.55, color: tokens.text }}>
              Snapshot isolation in Postgres is REPEATABLE READ — different from SERIALIZABLE which
              adds SSI predicate locks to detect serialization anomalies at commit time.
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 14,
              border: `1px solid ${tokens.border}`,
              background: tokens.card,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: tokens.mutedFg }}>
              GENERATED QUESTION
            </div>
            <div style={{ fontSize: 14, color: tokens.text }}>
              How does SERIALIZABLE differ from REPEATABLE READ in Postgres?
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              style={{
                background: tokens.card,
                border: `1px solid ${tokens.border}`,
                color: tokens.text,
                padding: 14,
                borderRadius: 14,
                fontSize: 14,
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>✎</span>
              <div>
                <div style={{ fontWeight: 600 }}>Move to another thread</div>
                <div style={{ fontSize: 12, color: tokens.mutedFg }}>Reassign this entry</div>
              </div>
            </button>
            <button
              style={{
                background: tokens.card,
                border: `1px solid ${tokens.border}`,
                color: tokens.noise,
                padding: 14,
                borderRadius: 14,
                fontSize: 14,
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18 }}>⊘</span>
              <div>
                <div style={{ fontWeight: 600 }}>Mark as noise</div>
                <div style={{ fontSize: 12, color: tokens.mutedFg }}>
                  Stop generating quiz cards from this
                </div>
              </div>
            </button>
          </div>
        </div>

        <TabBar active="journal" />
      </PhoneFrame>
    </div>
  );
}
