/**
 * Pure scheduling helpers: figure out the next reminder times respecting
 * a "quiet hours" window. No React, no Notifications imports — easy to test
 * and works on any platform.
 */

export type QuietHoursConfig = {
  enabled: boolean;
  /** "HH:mm" 24h */
  start: string;
  /** "HH:mm" 24h */
  end: string;
};

function parseHM(value: string): { h: number; m: number } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return { h: Number(match[1]), m: Number(match[2]) };
}

/** Returns a Date today at the given HH:mm relative to `base`. */
function atTimeToday(base: Date, hm: { h: number; m: number }): Date {
  const d = new Date(base);
  d.setHours(hm.h, hm.m, 0, 0);
  return d;
}

/**
 * Returns true if `when` falls inside the quiet window.
 * Handles overnight windows (e.g. 22:00 -> 07:00).
 */
export function isInQuietHours(when: Date, q: QuietHoursConfig): boolean {
  if (!q.enabled) return false;
  const start = parseHM(q.start);
  const end = parseHM(q.end);
  if (!start || !end) return false;
  const minutes = when.getHours() * 60 + when.getMinutes();
  const startM = start.h * 60 + start.m;
  const endM = end.h * 60 + end.m;
  if (startM === endM) return false;
  if (startM < endM) {
    return minutes >= startM && minutes < endM;
  }
  // overnight window
  return minutes >= startM || minutes < endM;
}

/**
 * Given a candidate time and quiet-hours config, push the time forward to
 * the next moment outside the quiet window.
 */
export function avoidQuietHours(when: Date, q: QuietHoursConfig): Date {
  if (!q.enabled) return when;
  const end = parseHM(q.end);
  if (!end) return when;
  if (!isInQuietHours(when, q)) return when;
  // Snap to the end-time today; if that's still in the past relative to `when`
  // (overnight case), move to the next day.
  let snap = atTimeToday(when, end);
  if (snap.getTime() <= when.getTime()) {
    snap = new Date(snap.getTime() + 24 * 60 * 60 * 1000);
  }
  return snap;
}

/**
 * Build the next N reminder Date triggers, starting `intervalMinutes` from
 * `from`, skipping past any quiet-hours windows.
 */
export function buildReminderTimes(opts: {
  from: Date;
  intervalMinutes: number;
  quiet: QuietHoursConfig;
  count: number;
}): Date[] {
  const { from, intervalMinutes, quiet, count } = opts;
  if (intervalMinutes <= 0 || count <= 0) return [];
  const times: Date[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    let next = new Date(cursor.getTime() + intervalMinutes * 60 * 1000);
    next = avoidQuietHours(next, quiet);
    times.push(next);
    cursor = next;
  }
  return times;
}
