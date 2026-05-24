import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

export function NetworkUnreachableOverlay() {
  const colors = useColors();

  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
      <Text style={[styles.title, { color: colors.foreground }]}>
        Network not reachable
      </Text>
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
});
