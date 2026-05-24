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
import { NetworkUnreachableOverlay } from "@/components/NetworkUnreachableOverlay";
import { isSettingsResponse } from "@/lib/api-health";
import type { QuietHoursConfig } from "@/lib/scheduling";

const DEFAULT_SETTINGS = {
  reminderIntervalMinutes: 5,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

export function SettingsBootstrap({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { data, isLoading, isError, isFetched } = useGetSettings();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateSettings();

  const hasValidSettings = isSettingsResponse(data);
  const apiUnreachable =
    isError || (isFetched && !isLoading && !hasValidSettings);

  if (isLoading && !isFetched) {
    return (
      <View
        style={[styles.loading, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const settings = hasValidSettings ? data : DEFAULT_SETTINGS;

  const onIntervalChange = async (minutes: number) => {
    await updateMutation.mutateAsync({
      data: { reminderIntervalMinutes: minutes },
    });
    await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
  };

  const onQuietHoursChange = async (q: QuietHoursConfig) => {
    await updateMutation.mutateAsync({
      data: {
        quietHoursEnabled: q.enabled,
        quietHoursStart: q.start,
        quietHoursEnd: q.end,
      },
    });
    await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
  };

  const quietHours: QuietHoursConfig = {
    enabled: settings.quietHoursEnabled,
    start: settings.quietHoursStart,
    end: settings.quietHoursEnd,
  };

  return (
    <NotificationProvider
      intervalMinutes={settings.reminderIntervalMinutes}
      quietHours={quietHours}
      onIntervalChange={onIntervalChange}
      onQuietHoursChange={onQuietHoursChange}
    >
      <View style={styles.shell}>
        {apiUnreachable ? <NetworkUnreachableOverlay /> : children}
      </View>
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shell: {
    flex: 1,
  },
});
