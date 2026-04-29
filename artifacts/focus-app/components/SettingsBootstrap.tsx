import React from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import {
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { NotificationProvider } from "@/contexts/NotificationContext";

export function SettingsBootstrap({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { data, isLoading } = useGetSettings();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateSettings();

  if (isLoading || !data) {
    return (
      <View
        style={[styles.loading, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const onIntervalChange = async (minutes: number) => {
    await updateMutation.mutateAsync({
      data: { reminderIntervalMinutes: minutes },
    });
    await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
  };

  return (
    <NotificationProvider
      intervalMinutes={data.reminderIntervalMinutes}
      onIntervalChange={onIntervalChange}
    >
      {children}
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
