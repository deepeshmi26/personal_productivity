import type { Settings } from "@workspace/api-client-react";

/** True when the value looks like a /api/settings JSON body (not HTML, etc.). */
export function isSettingsResponse(value: unknown): value is Settings {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.reminderIntervalMinutes === "number" &&
    typeof s.quietHoursEnabled === "boolean" &&
    typeof s.quietHoursStart === "string" &&
    typeof s.quietHoursEnd === "string"
  );
}
