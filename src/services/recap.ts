/**
 * Evening recap (D9): ONE-SHOT 21:00 trigger holding a precomputed summary.
 * A repeating trigger would fire stale text on days the app never runs — a
 * missed recap is the deliberately chosen failure mode. Re-armed on every
 * mutation (afterMutation), app-open, and the background-fetch path;
 * suppression = the trigger simply isn't scheduled. Android timing may be
 * Doze-deferred — accepted (iOS is the daily driver).
 */
import { appLockSatisfied, zenActiveAt } from './appLock';
import {
  cancelNotificationById,
  scheduleOneOffNotification,
} from './notifications';
import {
  activeOn,
  dayPerfect,
  doneOn,
  todayKey,
  useStore,
  whenHydrated,
} from '../store/useStore';

export const RECAP_ID = 'evening-recap';
const RECAP_HOUR = 21;

type RecapState = ReturnType<typeof useStore.getState>;

/** The 21:00 timestamp for `now`'s day, local time. */
export const recapTimestamp = (now: Date = new Date()): number => {
  const t = new Date(now);
  t.setHours(RECAP_HOUR, 0, 0, 0);
  return t.getTime();
};

/**
 * Pure content builder (E3-tested). Returns null when the recap must be
 * suppressed: day already perfect, vacation mode, a zen session covering
 * 21:00, or nothing to report (no active habits).
 */
export const buildRecap = (
  s: Pick<
    RecapState,
    'habits' | 'completions' | 'statuses' | 'planner' | 'prefs' | 'zen' | 'appLock'
  >,
  now: Date = new Date(),
): { title: string; body: string } | null => {
  if (s.prefs.vacationMode) {
    return null;
  }
  if (
    zenActiveAt(s.zen.until, now) &&
    new Date(s.zen.until as string).getTime() >= recapTimestamp(now)
  ) {
    return null;
  }
  const dateKey = todayKey();
  if (dayPerfect(s, dateKey)) {
    return null;
  }
  const active = s.habits.filter(h => activeOn(s.statuses, h, dateKey));
  if (!active.length) {
    return null;
  }
  const left = active.filter(
    h => !doneOn(s.completions, s.statuses, h, dateKey),
  );
  const tasksLeft = s.planner.filter(
    t => t.type === 'task' && t.date === dateKey && !t.done,
  ).length;
  const parts: string[] = [];
  if (left.length) {
    parts.push(
      left.length === 1
        ? `“${left[0].name}” to go`
        : `${left.length} habits to go`,
    );
  }
  if (tasksLeft) {
    parts.push(`${tasksLeft} task${tasksLeft === 1 ? '' : 's'} open`);
  }
  const locked =
    s.appLock?.enabled &&
    !appLockSatisfied(s.appLock, s.habits, s.completions, s.statuses, now);
  return {
    title: 'Evening check-in 🌙',
    body:
      `${parts.join(' · ')} — the perfect day is still winnable` +
      (locked ? ' (apps stay locked until you finish).' : '.'),
  };
};

/**
 * Compute + (re)schedule the one-shot. Cancels when suppressed or when
 * 21:00 already passed (tomorrow's re-arm carries fresh content).
 */
export const scheduleRecap = async (now: Date = new Date()): Promise<void> => {
  const ts = recapTimestamp(now);
  if (now.getTime() >= ts) {
    await cancelNotificationById(RECAP_ID);
    return;
  }
  const content = buildRecap(useStore.getState(), now);
  if (!content) {
    await cancelNotificationById(RECAP_ID);
    return;
  }
  await scheduleOneOffNotification(RECAP_ID, content.title, content.body, ts);
};

/** Background-fetch entry: hydration-gated, single-writer compliant. */
export const runBackgroundRecapCheck = async (): Promise<void> => {
  await whenHydrated();
  useStore.getState().rollDays();
  await scheduleRecap();
};
