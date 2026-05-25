import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

type Props = {
  apiBaseUrl: string | null;
  errorMessage?: string;
};

export function NetworkUnreachableOverlay({ apiBaseUrl, errorMessage }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
      <Text style={[styles.title, { color: colors.foreground }]}>
        Network not reachable
      </Text>
      {__DEV__ ? (
        <View style={styles.details}>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>
            API: {apiBaseUrl ?? "(not set — add EXPO_PUBLIC_API_URL)"}
          </Text>
          {errorMessage ? (
            <Text style={[styles.detail, { color: colors.mutedForeground }]}>
              {errorMessage}
            </Text>
          ) : null}
          {!apiBaseUrl ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Set EXPO_PUBLIC_API_URL in artifacts/focus-app/.env, then restart
              Metro (pnpm expo start --lan).
            </Text>
          ) : (
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              HTTP to a local IP requires an Android rebuild with
              usesCleartextTraffic, or use adb reverse + localhost.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  details: {
    gap: 8,
    maxWidth: 320,
  },
  detail: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
