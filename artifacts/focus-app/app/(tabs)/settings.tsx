import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/contexts/NotificationContext";

const PRESETS = [1, 3, 5, 10, 15, 30, 60];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    intervalMinutes,
    setIntervalMinutes,
    permissionGranted,
    requestPermission,
    nextReminderAt,
  } = useNotifications();
  const [saving, setSaving] = useState<number | null>(null);

  const topPad = Platform.OS === "web" ? 67 + 16 : insets.top + 8;

  const handlePick = async (minutes: number) => {
    if (minutes === intervalMinutes) return;
    setSaving(minutes);
    if (Haptics.selectionAsync) {
      Haptics.selectionAsync().catch(() => {});
    }
    try {
      await setIntervalMinutes(minutes);
    } finally {
      setSaving(null);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: Platform.OS === "web" ? 84 + 24 : insets.bottom + 110,
        paddingHorizontal: 20,
        gap: 24,
      }}
    >
      <View>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
          SETTINGS
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Tune your{"\n"}rhythm.
        </Text>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View
            style={[
              styles.sectionIcon,
              { backgroundColor: colors.accent },
            ]}
          >
            <Feather name="clock" size={16} color={colors.accentForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Reminder interval
            </Text>
            <Text
              style={[styles.sectionBody, { color: colors.mutedForeground }]}
            >
              How often we ask "what did you learn?"
            </Text>
          </View>
        </View>

        <View style={styles.presetGrid}>
          {PRESETS.map((m) => {
            const active = m === intervalMinutes;
            const isSaving = saving === m;
            return (
              <Pressable
                key={m}
                onPress={() => handlePick(m)}
                disabled={saving !== null}
                style={({ pressed }) => [
                  styles.preset,
                  {
                    backgroundColor: active
                      ? colors.primary
                      : colors.secondary,
                    borderColor: active ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator
                    color={
                      active
                        ? colors.primaryForeground
                        : colors.secondaryForeground
                    }
                    size="small"
                  />
                ) : (
                  <>
                    <Text
                      style={[
                        styles.presetValue,
                        {
                          color: active
                            ? colors.primaryForeground
                            : colors.foreground,
                        },
                      ]}
                    >
                      {m}
                    </Text>
                    <Text
                      style={[
                        styles.presetUnit,
                        {
                          color: active
                            ? colors.primaryForeground
                            : colors.mutedForeground,
                        },
                      ]}
                    >
                      {m === 1 ? "min" : "min"}
                    </Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View
            style={[
              styles.sectionIcon,
              { backgroundColor: colors.accent },
            ]}
          >
            <Feather name="bell" size={16} color={colors.accentForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Notifications
            </Text>
            <Text
              style={[styles.sectionBody, { color: colors.mutedForeground }]}
            >
              {Platform.OS === "web"
                ? "Notifications work best on mobile (iOS / Android)."
                : permissionGranted
                  ? "You'll be nudged while using your phone."
                  : "Permission required to send reminders."}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  Platform.OS === "web"
                    ? colors.muted
                    : permissionGranted
                      ? "#10b981"
                      : colors.destructive,
              },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.foreground }]}>
            {Platform.OS === "web"
              ? "Unavailable on web"
              : permissionGranted
                ? "Enabled"
                : "Disabled"}
          </Text>
          {!permissionGranted && Platform.OS !== "web" && (
            <Pressable
              onPress={requestPermission}
              style={({ pressed }) => [
                styles.enableButton,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.enableText,
                  { color: colors.primaryForeground },
                ]}
              >
                Enable
              </Text>
            </Pressable>
          )}
        </View>

        {nextReminderAt && permissionGranted && (
          <View
            style={[
              styles.nextRow,
              { borderTopColor: colors.border },
            ]}
          >
            <Feather
              name="zap"
              size={14}
              color={colors.mutedForeground}
            />
            <Text style={[styles.nextText, { color: colors.mutedForeground }]}>
              Next reminder around{" "}
              {nextReminderAt.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionHeader}>
          <View
            style={[
              styles.sectionIcon,
              { backgroundColor: colors.accent },
            ]}
          >
            <Feather name="info" size={16} color={colors.accentForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              How it works
            </Text>
          </View>
        </View>
        <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>
          Learn5 watches when you open your phone and quietly schedules a
          reminder every {intervalMinutes} minute{intervalMinutes === 1 ? "" : "s"}.
          Each time you tap "Save" or "I don't know," the timer resets so you
          aren't bombarded.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  section: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  sectionBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  preset: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 70,
    justifyContent: "center",
    minHeight: 44,
  },
  presetValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: -0.4,
  },
  presetUnit: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flex: 1,
  },
  enableButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  enableText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  nextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  nextText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  bodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
});
