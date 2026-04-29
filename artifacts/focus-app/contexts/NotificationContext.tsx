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

import {
  buildReminderTimes,
  type QuietHoursConfig,
} from "@/lib/scheduling";

type NotificationContextValue = {
  intervalMinutes: number;
  quietHours: QuietHoursConfig;
  setIntervalMinutes: (minutes: number) => Promise<void>;
  setQuietHours: (q: QuietHoursConfig) => Promise<void>;
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

// ---------------------------------------------------------------------------
// Lazy, crash-safe wrappers around expo-notifications and the background-fetch
// task manager. Touching these on Expo Go (SDK 53+) throws, so we guard every
// access.
// ---------------------------------------------------------------------------

type NotificationsModule = typeof import("expo-notifications");
type TaskManagerModule = typeof import("expo-task-manager");
type BackgroundFetchModule = typeof import("expo-background-fetch");

let _notifications: NotificationsModule | null | undefined;
let _taskManager: TaskManagerModule | null | undefined;
let _backgroundFetch: BackgroundFetchModule | null | undefined;
let _handlerRegistered = false;
let _backgroundTaskRegistered = false;

const BACKGROUND_TASK = "learn5-reschedule";

function getNotifications(): NotificationsModule | null {
  if (_notifications !== undefined) return _notifications;
  if (Platform.OS === "web" || isExpoGo) {
    _notifications = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _notifications = require("expo-notifications") as NotificationsModule;
  } catch {
    _notifications = null;
  }
  return _notifications;
}

function getTaskManager(): TaskManagerModule | null {
  if (_taskManager !== undefined) return _taskManager;
  if (Platform.OS === "web" || isExpoGo) {
    _taskManager = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _taskManager = require("expo-task-manager") as TaskManagerModule;
  } catch {
    _taskManager = null;
  }
  return _taskManager;
}

function getBackgroundFetch(): BackgroundFetchModule | null {
  if (_backgroundFetch !== undefined) return _backgroundFetch;
  if (Platform.OS === "web" || isExpoGo) {
    _backgroundFetch = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _backgroundFetch =
      require("expo-background-fetch") as BackgroundFetchModule;
  } catch {
    _backgroundFetch = null;
  }
  return _backgroundFetch;
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
    // noop
  }
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

const BATCH_COUNT = 24; // schedule the next 24 reminders ahead

async function scheduleBatch(
  intervalMinutes: number,
  quiet: QuietHoursConfig,
): Promise<Date | null> {
  const N = getNotifications();
  const times = buildReminderTimes({
    from: new Date(),
    intervalMinutes,
    quiet,
    count: BATCH_COUNT,
  });
  const firstTime = times[0] ?? null;

  if (!N) return firstTime;

  try {
    await N.cancelAllScheduledNotificationsAsync();
    for (const t of times) {
      await N.scheduleNotificationAsync({
        content: {
          title: "What did you learn?",
          body: "Take 10 seconds to capture it.",
          sound: true,
          data: { type: "learn5_prompt" },
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: t,
        },
      });
    }
  } catch {
    // schedule failed — UI countdown still updates
  }
  return firstTime;
}

// ---------------------------------------------------------------------------
// Background fetch
//
// On a dev/production build, iOS and Android will periodically wake this task
// (iOS uses on-device ML to predict when the user is likely active). When it
// fires, we top up the schedule from "now" so reminders stay aligned with the
// user's real rhythm.
// ---------------------------------------------------------------------------

let _bgScheduleFn:
  | ((interval: number, quiet: QuietHoursConfig) => Promise<void>)
  | null = null;
let _bgConfig: { interval: number; quiet: QuietHoursConfig } | null = null;

function ensureBackgroundTask() {
  if (_backgroundTaskRegistered) return;
  const TM = getTaskManager();
  const BF = getBackgroundFetch();
  if (!TM || !BF) return;
  try {
    TM.defineTask(BACKGROUND_TASK, async () => {
      try {
        if (_bgConfig) {
          await scheduleBatch(_bgConfig.interval, _bgConfig.quiet);
        }
        return BF.BackgroundFetchResult.NewData;
      } catch {
        return BF.BackgroundFetchResult.Failed;
      }
    });
    _backgroundTaskRegistered = true;
  } catch {
    // noop
  }
}

async function registerBackgroundFetch() {
  const TM = getTaskManager();
  const BF = getBackgroundFetch();
  if (!TM || !BF) return;
  try {
    ensureBackgroundTask();
    const status = await BF.getStatusAsync();
    if (status === BF.BackgroundFetchStatus.Restricted || status === BF.BackgroundFetchStatus.Denied) {
      return;
    }
    const isRegistered = await TM.isTaskRegisteredAsync(BACKGROUND_TASK);
    if (!isRegistered) {
      await BF.registerTaskAsync(BACKGROUND_TASK, {
        minimumInterval: 15 * 60, // 15 minutes (iOS minimum)
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {
    // noop
  }
}

// ---------------------------------------------------------------------------
// React provider
// ---------------------------------------------------------------------------

export function NotificationProvider({
  children,
  intervalMinutes,
  quietHours,
  onIntervalChange,
  onQuietHoursChange,
}: {
  children: React.ReactNode;
  intervalMinutes: number;
  quietHours: QuietHoursConfig;
  onIntervalChange: (minutes: number) => Promise<void>;
  onQuietHoursChange: (q: QuietHoursConfig) => Promise<void>;
}) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [nextReminderAt, setNextReminderAt] = useState<Date | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const notificationsLimited = isExpoGo || Platform.OS === "web";
  // Always-fresh refs so listeners outside the React lifecycle see latest values
  const intervalRef = useRef(intervalMinutes);
  const quietRef = useRef(quietHours);
  intervalRef.current = intervalMinutes;
  quietRef.current = quietHours;

  const reschedule = useCallback(
    async (interval: number, quiet: QuietHoursConfig) => {
      _bgConfig = { interval, quiet };
      const first = await scheduleBatch(interval, quiet);
      setNextReminderAt(first);
    },
    [],
  );

  _bgScheduleFn = reschedule;

  const requestPermission = useCallback(async () => {
    const N = getNotifications();
    if (!N) {
      setPermissionGranted(false);
      await reschedule(intervalRef.current, quietRef.current);
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
        await reschedule(intervalRef.current, quietRef.current);
        await registerBackgroundFetch();
      }
      return granted;
    } catch {
      setPermissionGranted(false);
      return false;
    }
  }, [reschedule]);

  const setIntervalMinutes = useCallback(
    async (minutes: number) => {
      await onIntervalChange(minutes);
      await reschedule(minutes, quietRef.current);
    },
    [onIntervalChange, reschedule],
  );

  const setQuietHours = useCallback(
    async (q: QuietHoursConfig) => {
      await onQuietHoursChange(q);
      await reschedule(intervalRef.current, q);
    },
    [onQuietHoursChange, reschedule],
  );

  const rescheduleNow = useCallback(async () => {
    await reschedule(intervalRef.current, quietRef.current);
  }, [reschedule]);

  // On mount: ask for permission and start the in-app countdown immediately.
  useEffect(() => {
    requestPermission();
    if (!nextReminderAt) {
      reschedule(intervalRef.current, quietRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When app foregrounds → reschedule (foregrounding is a strong "I'm here" signal).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev.match(/inactive|background/) && next === "active") {
        reschedule(intervalRef.current, quietRef.current);
      }
    });
    return () => sub.remove();
  }, [reschedule]);

  // Listen to incoming notifications and tap interactions — both are evidence
  // the user just looked at their phone, so reset the timer so we don't
  // immediately fire another reminder a few seconds later.
  useEffect(() => {
    const N = getNotifications();
    if (!N) return;
    let receivedSub: { remove: () => void } | null = null;
    let responseSub: { remove: () => void } | null = null;
    try {
      receivedSub = N.addNotificationReceivedListener(() => {
        reschedule(intervalRef.current, quietRef.current);
      });
      responseSub = N.addNotificationResponseReceivedListener(() => {
        reschedule(intervalRef.current, quietRef.current);
      });
    } catch {
      // noop
    }
    return () => {
      try {
        receivedSub?.remove();
        responseSub?.remove();
      } catch {
        // noop
      }
    };
  }, [reschedule]);

  return (
    <NotificationContext.Provider
      value={{
        intervalMinutes,
        quietHours,
        setIntervalMinutes,
        setQuietHours,
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
