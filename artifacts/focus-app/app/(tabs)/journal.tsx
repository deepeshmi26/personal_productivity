import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListResponses,
  getListResponsesQueryKey,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";

type DaySection = {
  date: string;
  label: string;
  entries: Array<{
    id: number;
    text: string;
    skipped: boolean;
    createdAt: string;
  }>;
};

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useListResponses();
  const queryClient = useQueryClient();

  const sections = useMemo<DaySection[]>(() => {
    if (!data) return [];
    const groups = new Map<string, DaySection>();
    for (const r of data) {
      const key = new Date(r.createdAt).toISOString().slice(0, 10);
      const existing = groups.get(key);
      if (existing) {
        existing.entries.push(r);
      } else {
        groups.set(key, {
          date: key,
          label: formatDayLabel(key),
          entries: [r],
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
  }, [data]);

  const flat: Array<
    | { type: "header"; key: string; label: string; count: number }
    | {
        type: "entry";
        key: string;
        entry: DaySection["entries"][number];
        isLast: boolean;
      }
  > = useMemo(() => {
    const out: typeof flat = [];
    for (const s of sections) {
      out.push({
        type: "header",
        key: `h-${s.date}`,
        label: s.label,
        count: s.entries.length,
      });
      s.entries.forEach((e, i) => {
        out.push({
          type: "entry",
          key: `e-${e.id}`,
          entry: e,
          isLast: i === s.entries.length - 1,
        });
      });
    }
    return out;
  }, [sections]);

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 8;

  const onRefresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: getListResponsesQueryKey(),
    });
    await refetch();
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: Platform.OS === "web" ? 84 + 24 : insets.bottom + 110,
        paddingHorizontal: 20,
      }}
      data={flat}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
            JOURNAL
          </Text>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Everything you{"\n"}captured.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: colors.accent },
            ]}
          >
            <Feather
              name="book-open"
              size={28}
              color={colors.accentForeground}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            No entries yet
          </Text>
          <Text
            style={[styles.emptyBody, { color: colors.mutedForeground }]}
          >
            Your first reminder will arrive soon. Capture a quick thought and
            it'll show up here.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      renderItem={({ item }) => {
        if (item.type === "header") {
          return (
            <View style={styles.dayHeader}>
              <Text
                style={[styles.dayLabel, { color: colors.foreground }]}
              >
                {item.label}
              </Text>
              <View
                style={[
                  styles.countPill,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    { color: colors.secondaryForeground },
                  ]}
                >
                  {item.count}
                </Text>
              </View>
            </View>
          );
        }
        const e = item.entry;
        const time = new Date(e.createdAt).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        return (
          <Pressable
            style={({ pressed }) => [
              styles.entryRow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
                marginBottom: item.isLast ? 24 : 8,
              },
            ]}
          >
            <View style={styles.entryRail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: e.skipped
                      ? colors.muted
                      : colors.primary,
                  },
                ]}
              />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={[
                  styles.entryTime,
                  { color: colors.mutedForeground },
                ]}
              >
                {time}
              </Text>
              {e.skipped ? (
                <Text
                  style={[
                    styles.entrySkipped,
                    { color: colors.mutedForeground },
                  ]}
                >
                  I didn't know yet
                </Text>
              ) : (
                <Text
                  style={[styles.entryText, { color: colors.foreground }]}
                >
                  {e.text}
                </Text>
              )}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    marginBottom: 18,
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
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  dayLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  entryRow: {
    flexDirection: "row",
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
    gap: 12,
  },
  entryRail: {
    width: 12,
    alignItems: "center",
    paddingTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  entryTime: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.4,
  },
  entryText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
  },
  entrySkipped: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    fontStyle: "italic",
  },
  empty: {
    alignItems: "center",
    paddingTop: 64,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
