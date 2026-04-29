import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";

type NotificationContextValue = {
  intervalMinutes: number;
  setIntervalMinutes: (minutes: number) => Promise<void>;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  rescheduleNow: () => Promise<void>;
  nextReminderAt: Date | null;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationProvider({
  children,
  intervalMinutes,
  onIntervalChange,
}: {
  children: React.ReactNode;
  intervalMinutes: number;
  onIntervalChange: (minutes: number) => Promise<void>;
}) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [nextReminderAt, setNextReminderAt] = useState<Date | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const scheduleNext = useCallback(
    async (minutes: number) => {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
      } catch {
        // ignore
      }
      if (minutes <= 0 || Platform.OS === "web") {
        setNextReminderAt(null);
        return;
      }
      const seconds = Math.max(60, minutes * 60);
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "What did you learn?",
            body: "Take 10 seconds to capture it.",
            sound: true,
            data: { type: "learn5_prompt" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: true,
          },
        });
        setNextReminderAt(new Date(Date.now() + seconds * 1000));
      } catch {
        setNextReminderAt(null);
      }
    },
    [],
  );

  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") {
      setPermissionGranted(false);
      return false;
    }
    try {
      const settings = await Notifications.getPermissionsAsync();
      let granted =
        settings.granted ||
        settings.ios?.status ===
          Notifications.IosAuthorizationStatus.PROVISIONAL;
      if (!granted) {
        const req = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        granted =
          req.granted ||
          req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      }
      setPermissionGranted(granted);
      if (granted) {
        await scheduleNext(intervalMinutes);
      }
      return granted;
    } catch {
      setPermissionGranted(false);
      return false;
    }
  }, [intervalMinutes, scheduleNext]);

  const setIntervalMinutes = useCallback(
    async (minutes: number) => {
      await onIntervalChange(minutes);
      if (permissionGranted) {
        await scheduleNext(minutes);
      }
    },
    [onIntervalChange, permissionGranted, scheduleNext],
  );

  const rescheduleNow = useCallback(async () => {
    if (permissionGranted) {
      await scheduleNext(intervalMinutes);
    }
  }, [permissionGranted, intervalMinutes, scheduleNext]);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Auto-detect device usage: when app comes to foreground, reset the timer.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;
      if (
        prev.match(/inactive|background/) &&
        next === "active" &&
        permissionGranted
      ) {
        scheduleNext(intervalMinutes);
      }
    });
    return () => sub.remove();
  }, [permissionGranted, intervalMinutes, scheduleNext]);

  return (
    <NotificationContext.Provider
      value={{
        intervalMinutes,
        setIntervalMinutes,
        permissionGranted,
        requestPermission,
        rescheduleNow,
        nextReminderAt,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
