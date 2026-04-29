import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  useGetResponseStats,
  useListResponses,
} from "@workspace/api-client-react";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/contexts/NotificationContext";
import { CaptureCard } from "@/components/CaptureCard";

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = Math.max(0, target.getTime() - now.getTime());
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { intervalMinutes, permissionGranted, requestPermission, nextReminderAt } =
    useNotifications();
  const { data: stats } = useGetResponseStats();
  const { data: responses } = useListResponses();
  const countdown = useCountdown(nextReminderAt);

  const today = useMemo(() => {
    if (!responses) return [];
    const todayStr = new Date().toISOString().slice(0, 10);
    return responses.filter(
      (r) => new Date(r.createdAt).toISOString().slice(0, 10) === todayStr,
    );
  }, [responses]);

  const lastEntry = responses?.[0];

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 8;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: 140,
        paddingHorizontal: 20,
        gap: 20,
      }}
      bottomOffset={20}
    >
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            LEARN5
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Capture what{"\n"}you just learned.
          </Text>
        </View>
      </View>

      <CaptureCard />

      {!permissionGranted && Platform.OS !== "web" && (
        <Pressable
          onPress={requestPermission}
          style={({ pressed }) => [
            styles.banner,
            {
              backgroundColor: colors.accent,
              borderColor: colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="bell" size={18} color={colors.accentForeground} />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.bannerTitle, { color: colors.accentForeground }]}
            >
              Enable reminders
            </Text>
            <Text
              style={[styles.bannerBody, { color: colors.accentForeground }]}
            >
              Get a gentle nudge every {intervalMinutes} min while you use your
              phone.
            </Text>
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={colors.accentForeground}
          />
        </Pressable>
      )}

      <View style={styles.statsRow}>
        <StatCard
          label="Today"
          value={today.length.toString()}
          icon="calendar"
        />
        <StatCard
          label="Total"
          value={(stats?.total ?? 0).toString()}
          icon="layers"
        />
        <StatCard
          label="Next in"
          value={countdown ?? "—"}
          icon="clock"
        />
      </View>

      {lastEntry && (
        <View
          style={[
            styles.lastCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.lastHeader}>
            <Feather
              name="bookmark"
              size={14}
              color={colors.mutedForeground}
            />
            <Text
              style={[styles.lastLabel, { color: colors.mutedForeground }]}
            >
              MOST RECENT
            </Text>
          </View>
          <Text
            style={[styles.lastText, { color: colors.foreground }]}
            numberOfLines={3}
          >
            {lastEntry.skipped
              ? "Skipped — I didn't know yet."
              : lastEntry.text}
          </Text>
          <Text
            style={[styles.lastTime, { color: colors.mutedForeground }]}
          >
            {new Date(lastEntry.createdAt).toLocaleString(undefined, {
              hour: "numeric",
              minute: "2-digit",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
      )}

      <ScrollView />
    </KeyboardAwareScrollViewCompat>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.statHead}>
        <Feather name={icon} size={13} color={colors.mutedForeground} />
        <Text
          style={[styles.statLabel, { color: colors.mutedForeground }]}
        >
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  eyebrow: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  bannerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  bannerBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  statHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    letterSpacing: -0.4,
  },
  lastCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  lastHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lastLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  lastText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
  },
  lastTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});
