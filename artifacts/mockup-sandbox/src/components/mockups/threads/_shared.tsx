import type { ReactNode, CSSProperties } from "react";

export const tokens = {
  text: "#1a1a2e",
  bg: "#fafafd",
  card: "#ffffff",
  primary: "#6366f1",
  primaryFg: "#ffffff",
  secondary: "#eef0fb",
  muted: "#f1f3f9",
  mutedFg: "#6b7280",
  accent: "#ede9fe",
  accentFg: "#4c1d95",
  destructive: "#ef4444",
  border: "#e6e8f0",
  noise: "#f59e0b",
  noiseBg: "#fef3c7",
  success: "#10b981",
  successBg: "#d1fae5",
  radius: 16,
  font:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export function PhoneFrame({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      {title && (
        <div
          style={{
            fontFamily: tokens.font,
            fontSize: 13,
            fontWeight: 600,
            color: tokens.mutedFg,
            letterSpacing: 0.3,
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          width: 390,
          height: 780,
          borderRadius: 44,
          background: "#0b0b14",
          padding: 10,
          boxShadow: "0 30px 60px -20px rgba(20,20,40,0.25), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 36,
            background: tokens.bg,
            overflow: "hidden",
            position: "relative",
            fontFamily: tokens.font,
            color: tokens.text,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <StatusBar />
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div
      style={{
        height: 44,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        fontSize: 14,
        fontWeight: 600,
        color: tokens.text,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
        <span>•••</span>
        <span>100%</span>
      </span>
    </div>
  );
}

export function TabBar({ active }: { active: "capture" | "journal" | "review" | "settings" }) {
  const items: Array<{ key: typeof active; label: string; icon: string }> = [
    { key: "capture", label: "Capture", icon: "+" },
    { key: "journal", label: "Journal", icon: "≡" },
    { key: "review", label: "Review", icon: "?" },
    { key: "settings", label: "Settings", icon: "⚙" },
  ];
  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: `1px solid ${tokens.border}`,
        background: tokens.card,
        display: "flex",
        paddingBottom: 18,
        paddingTop: 8,
      }}
    >
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <div
            key={it.key}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              color: isActive ? tokens.primary : tokens.mutedFg,
              fontSize: 11,
              fontWeight: isActive ? 600 : 500,
            }}
          >
            <div style={{ fontSize: 18 }}>{it.icon}</div>
            <div>{it.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function Header({
  title,
  subtitle,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean;
}) {
  return (
    <div
      style={{
        padding: "8px 20px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {back && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: tokens.secondary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: tokens.text,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            ‹
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 13, color: tokens.mutedFg, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Chip({
  children,
  active,
  count,
  style,
}: {
  children: ReactNode;
  active?: boolean;
  count?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: active ? tokens.primary : tokens.secondary,
        color: active ? tokens.primaryFg : tokens.text,
        fontSize: 13,
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            background: active ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)",
            padding: "1px 7px",
            borderRadius: 999,
            fontWeight: 600,
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}
