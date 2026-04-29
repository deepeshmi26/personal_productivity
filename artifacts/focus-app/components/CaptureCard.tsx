import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateResponse,
  getListResponsesQueryKey,
  getGetResponseStatsQueryKey,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useNotifications } from "@/contexts/NotificationContext";

export function CaptureCard({ onSubmitted }: { onSubmitted?: () => void }) {
  const colors = useColors();
  const [text, setText] = useState("");
  const [justSaved, setJustSaved] = useState<null | "answered" | "skipped">(
    null,
  );
  const queryClient = useQueryClient();
  const { rescheduleNow } = useNotifications();
  const createMutation = useCreateResponse();

  const submit = async (skipped: boolean) => {
    const trimmed = text.trim();
    if (!skipped && trimmed.length === 0) return;
    if (Haptics.impactAsync) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await createMutation.mutateAsync({
      data: { text: skipped ? "" : trimmed, skipped },
    });
    await queryClient.invalidateQueries({
      queryKey: getListResponsesQueryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: getGetResponseStatsQueryKey(),
    });
    setText("");
    setJustSaved(skipped ? "skipped" : "answered");
    setTimeout(() => setJustSaved(null), 1800);
    rescheduleNow();
    onSubmitted?.();
  };

  const isPending = createMutation.isPending;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconChip,
            { backgroundColor: colors.accent },
          ]}
        >
          <Feather name="zap" size={16} color={colors.accentForeground} />
        </View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          PROMPT
        </Text>
      </View>
      <Text style={[styles.question, { color: colors.foreground }]}>
        What did you learn{"\n"}in the last few minutes?
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="A quick thought, fact, idea, observation…"
        placeholderTextColor={colors.mutedForeground}
        multiline
        editable={!isPending}
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.foreground,
          },
        ]}
      />

      <View style={styles.row}>
        <Pressable
          onPress={() => submit(true)}
          disabled={isPending}
          style={({ pressed }) => [
            styles.skipButton,
            {
              backgroundColor: colors.secondary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather
            name="x-circle"
            size={16}
            color={colors.secondaryForeground}
          />
          <Text
            style={[
              styles.skipText,
              { color: colors.secondaryForeground },
            ]}
          >
            I don't know
          </Text>
        </Pressable>

        <Pressable
          onPress={() => submit(false)}
          disabled={isPending || text.trim().length === 0}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor:
                text.trim().length === 0
                  ? colors.muted
                  : colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <>
              <Text
                style={[
                  styles.submitText,
                  {
                    color:
                      text.trim().length === 0
                        ? colors.mutedForeground
                        : colors.primaryForeground,
                  },
                ]}
              >
                Save
              </Text>
              <Feather
                name="arrow-right"
                size={16}
                color={
                  text.trim().length === 0
                    ? colors.mutedForeground
                    : colors.primaryForeground
                }
              />
            </>
          )}
        </Pressable>
      </View>

      {justSaved && (
        <View
          style={[
            styles.toast,
            { backgroundColor: colors.accent },
          ]}
        >
          <Feather
            name="check"
            size={14}
            color={colors.accentForeground}
          />
          <Text
            style={[styles.toastText, { color: colors.accentForeground }]}
          >
            {justSaved === "answered" ? "Saved" : "Logged as skipped"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    gap: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.4,
  },
  question: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  skipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  submitButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  submitText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  toastText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
