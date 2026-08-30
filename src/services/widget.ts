/**
 * Pushes the consolidated App Group `sharedState` payload (1A) to iOS through
 * the WidgetBridge native module. One writer, one key: the streak widget and
 * the Screen Time shield extension both read this JSON. The bridge always
 * writes the defaults; `reloadAllTimelines()` is debounced natively (≥60s)
 * unless the lock state flipped, to respect WidgetKit's reload budget.
 */
import { NativeModules } from 'react-native';
import { Habit } from '../data/seed';
import { appLockConditionLabel, appLockSatisfied } from './appLock';
import {
  addDays,
  AppLockPrefs,
  dayStreak,
  historyDayFraction,
  perfectToday,
  progressFor,
  toDateKey,
  todayKey,
} from '../store/useStore';

type WidgetSlice = Parameters<typeof dayStreak>[0] & {
  habits: Habit[];
  appLock: AppLockPrefs;
};

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Last pushed lock verdict; a change forces an immediate widget reload. */
let lastLockState: boolean | null = null;

export const pushStreakToWidget = (s: WidgetSlice): void => {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = addDays(today, -mondayOffset);

  const days = LABELS.map((l, i) => {
    const d = addDays(monday, i);
    const key = toDateKey(d);
    let done = false;
    if (key === todayKey()) {
      done = perfectToday(s);
    } else if (d.getTime() < today.getTime()) {
      // Local-midnight parses — bare `new Date('YYYY-MM-DD')` is UTC and
      // shifts a day in negative-offset timezones (eng OV correction #4).
      const diff = Math.round(
        (new Date(`${todayKey()}T00:00`).getTime() -
          new Date(`${key}T00:00`).getTime()) /
          86400000,
      );
      done =
        diff >= 1 && diff <= 83
          ? historyDayFraction(s.histories, s.habits, 83 - diff) >= 1
          : false;
    }
    return { l, d: done };
  });

  const satisfied = appLockSatisfied(
    s.appLock,
    s.habits,
    s.completions,
    s.statuses,
  );
  const locked = s.appLock.enabled && !satisfied;

  // The shield copy names the unlock habit when the condition is a single
  // habit; 'all'/'time' conditions fall back to the label.
  const unlockHabit =
    s.appLock.condition === 'habit'
      ? (() => {
          const habit = s.habits.find(h => h.id === s.appLock.habitId);
          return habit
            ? {
                name: habit.name,
                emoji: habit.emoji,
                progress: progressFor(s.completions, habit, todayKey()),
              }
            : null;
        })()
      : null;

  const payload = {
    v: 1,
    streak: dayStreak(s),
    days,
    lock: {
      enabled: s.appLock.enabled,
      satisfied,
      label: appLockConditionLabel(s.appLock, s.habits),
    },
    unlockHabit,
    updatedAt: new Date().toISOString(),
  };

  const flipped = lastLockState !== null && lastLockState !== locked;
  lastLockState = locked;

  NativeModules.WidgetBridge?.setSharedState?.(
    JSON.stringify(payload),
    flipped,
  );
};
