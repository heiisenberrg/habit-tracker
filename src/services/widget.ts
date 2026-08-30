/**
 * Pushes streak + current-week data to the iOS home-screen widget through
 * the WidgetBridge native module (App Group UserDefaults + timeline reload).
 */
import { NativeModules } from 'react-native';
import { Habit } from '../data/seed';
import {
  addDays,
  dayStreak,
  historyDayFraction,
  perfectToday,
  toDateKey,
  todayKey,
} from '../store/useStore';

type StreakSlice = Parameters<typeof dayStreak>[0] & { habits: Habit[] };

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const pushStreakToWidget = (s: StreakSlice): void => {
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
      const diff = Math.round(
        (new Date(todayKey()).getTime() - new Date(key).getTime()) / 86400000,
      );
      done =
        diff >= 1 && diff <= 83
          ? historyDayFraction(s.histories, s.habits, 83 - diff) >= 1
          : false;
    }
    return { l, d: done };
  });

  NativeModules.WidgetBridge?.setStreak?.(
    JSON.stringify({ streak: dayStreak(s), days }),
  );
};
