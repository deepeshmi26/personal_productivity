import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

type NotificationContextValue = {
  intervalMinutes: number;
  setIntervalMinutes: (minutes: number) => Promise<void>;
  permissionGranted: boolean;
  requestPermission: () => Promise<boolean>;
  rescheduleNow: () => Promise<void>;
  nextReminderAt: Date | null;
  /** True when full push notifications aren't available (e.g. Expo Go on SDK 53+). */
  notificationsLimited: boolean;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Safe lazy loader for expo-notifications. In Expo Go on SDK 53+, parts of the
// module throw when touched, so we guard every interaction.
type NotificationsModule = typeof import("expo-notifications");
let _notificationsModule: NotificationsModule | null | undefined;
let _handlerRegistered = false;

function getNotifications(): NotificationsModule | null {
  if (_notificationsModule !== undefined) return _notificationsModule;
  if (Platform.OS === "web" || isExpoGo) {
    _notificationsModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _notificationsModule = require("expo-notifications") as NotificationsModule;
  } catch {
    _notificationsModule = null;
  }
  return _notificationsModule;
}

function ensureHandler() {
  if (_handlerRegistered) return;
  const N = getNotifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    _handlerRegistered = true;
  } catch {
    // Silently ignore — fallback in-app timer still works.
  }
}

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
  const notificationsLimited = isExpoGo || Platform.OS === "web";

  const scheduleNext = useCallback(
    async (minutes: number) => {
      if (minutes <= 0) {
        setNextReminderAt(null);
        return;
      }
      const seconds = Math.max(60, minutes * 60);
      // Always update the in-app countdown for UI feedback.
      setNextReminderAt(new Date(Date.now() + seconds * 1000));

      const N = getNotifications();
      if (!N) return;

      try {
        await N.cancelAllScheduledNotificationsAsync();
        await N.scheduleNotificationAsync({
          content: {
            title: "What did you learn?",
            body: "Take 10 seconds to capture it.",
            sound: true,
            data: { type: "learn5_prompt" },
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
            repeats: true,
          },
        });
      } catch {
        // Schedule failed — UI countdown still updates.
      }
    },
    [],
  );

  const requestPermission = useCallback(async () => {
    const N = getNotifications();
    if (!N) {
      setPermissionGranted(false);
      // Still drive the in-app countdown so the UI feels alive.
      await scheduleNext(intervalMinutes);
      return false;
    }
    try {
      ensureHandler();
      const settings = await N.getPermissionsAsync();
      let granted =
        settings.granted ||
        settings.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
      if (!granted) {
        const req = await N.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        granted =
          req.granted ||
          req.ios?.status === N.IosAuthorizationStatus.PROVISIONAL;
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
      await scheduleNext(minutes);
    },
    [onIntervalChange, scheduleNext],
  );

  const rescheduleNow = useCallback(async () => {
    await scheduleNext(intervalMinutes);
  }, [intervalMinutes, scheduleNext]);

  useEffect(() => {
    requestPermission();
    // Make sure the countdown starts immediately even if permission is denied
    // or notifications are unavailable.
    if (!nextReminderAt) {
      scheduleNext(intervalMinutes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-detect device usage: when app comes to foreground, reset the timer.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev.match(/inactive|background/) && next === "active") {
        scheduleNext(intervalMinutes);
      }
    });
    return () => sub.remove();
  }, [intervalMinutes, scheduleNext]);

  return (
    <NotificationContext.Provider
      value={{
        intervalMinutes,
        setIntervalMinutes,
        permissionGranted,
        requestPermission,
        rescheduleNow,
        nextReminderAt,
        notificationsLimited,
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
