import { PhoneFrame, Header, tokens } from "./_shared";

export default function ThreadQuizPreview() {
  return (
    <div style={{ padding: 32, background: "#eef0f5", minHeight: "100vh", display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
      <PhoneFrame title="Quiz · question">
        <Header
          back
          title="Postgres MVCC"
          subtitle="Card 3 of 12"
        />

        <div style={{ padding: "0 20px 8px" }}>
          <div
            style={{
              height: 6,
              background: tokens.muted,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div style={{ width: "25%", height: "100%", background: tokens.primary }} />
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px" }}>
          <div
            style={{
              flex: 1,
              background: tokens.card,
              borderRadius: 20,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              border: `1px solid ${tokens.border}`,
              boxShadow: "0 10px 24px -16px rgba(20,20,40,0.18)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: tokens.accentFg,
                background: tokens.accent,
                padding: "4px 10px",
                borderRadius: 999,
                alignSelf: "flex-start",
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              From: Postgres MVCC
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                lineHeight: 1.35,
                marginTop: 18,
                color: tokens.text,
              }}
            >
              What does VACUUM FULL do that plain VACUUM doesn't?
            </div>

            <div style={{ flex: 1 }} />

            <div
              style={{
                fontSize: 12,
                color: tokens.mutedFg,
                paddingTop: 16,
                borderTop: `1px dashed ${tokens.border}`,
              }}
            >
              Sourced from your entry on May 23 — tap to view in digest
            </div>
          </div>

          <button
            style={{
              marginTop: 14,
              background: tokens.primary,
              color: "white",
              border: "none",
              padding: "16px",
              borderRadius: 16,
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Reveal answer
          </button>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              style={{
                flex: 1,
                background: tokens.muted,
                color: tokens.mutedFg,
                border: "none",
                padding: "12px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              ⊘ Mark as noise
            </button>
            <button
              style={{
                flex: 1,
                background: tokens.muted,
                color: tokens.mutedFg,
                border: "none",
                padding: "12px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Skip
            </button>
          </div>
        </div>
      </PhoneFrame>

      <PhoneFrame title="Quiz · self-grade">
        <Header back title="Postgres MVCC" subtitle="Card 3 of 12" />
        <div style={{ padding: "0 20px 8px" }}>
          <div style={{ height: 6, background: tokens.muted, borderRadius: 999 }}>
            <div style={{ width: "25%", height: "100%", background: tokens.primary, borderRadius: 999 }} />
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20 }}>
          <div
            style={{
              background: tokens.card,
              borderRadius: 20,
              padding: 22,
              border: `1px solid ${tokens.border}`,
            }}
          >
            <div style={{ fontSize: 13, color: tokens.mutedFg, marginBottom: 6 }}>Question</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
              What does VACUUM FULL do that plain VACUUM doesn't?
            </div>
            <div style={{ fontSize: 13, color: tokens.mutedFg, marginBottom: 6 }}>Your note</div>
            <div
              style={{
                background: tokens.secondary,
                borderRadius: 12,
                padding: 14,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              VACUUM FULL rewrites the table to reclaim disk space back to the OS — needs an
              exclusive lock. Plain VACUUM only marks pages reusable in place.
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: tokens.text }}>
            How did you do?
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={{
                flex: 1,
                background: tokens.destructive,
                color: "white",
                border: "none",
                padding: "16px",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              ✕ Missed it
            </button>
            <button
              style={{
                flex: 1,
                background: "#10b981",
                color: "white",
                border: "none",
                padding: "16px",
                borderRadius: 14,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              ✓ Got it
            </button>
          </div>
        </div>
      </PhoneFrame>

      <PhoneFrame title="Quiz · empty thread">
        <Header back title="Embeddings & search" subtitle="No cards due" />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: 32,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              background: tokens.accent,
              color: tokens.accentFg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              marginBottom: 18,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>You're caught up here</div>
          <div style={{ fontSize: 14, color: tokens.mutedFg, lineHeight: 1.5, marginBottom: 24 }}>
            No questions are due in Embeddings & search. Next review window opens tomorrow.
          </div>
          <button
            style={{
              background: tokens.primary,
              color: "white",
              border: "none",
              padding: "14px 22px",
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Open digest to revise
          </button>
          <button
            style={{
              marginTop: 10,
              background: "transparent",
              color: tokens.mutedFg,
              border: "none",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Switch to mixed quiz
          </button>
        </div>
      </PhoneFrame>
    </div>
  );
}
