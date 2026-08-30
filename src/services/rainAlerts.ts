/**
 * Rain-aware schedule alerts: matches today's upcoming planner tasks and
 * habit reminders against the hourly precipitation forecast, and shows a
 * heads-up notification when an item's hour looks rainy. Runs when the
 * Home screen loads and on Background App Refresh wake-ups; each run also
 * pre-schedules an OS-delivered "starts soon" warning an hour before any
 * flagged item. A per-day AsyncStorage record keeps each item's immediate
 * warning to one notification.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannerItem } from '../data/seed';
import {
  cancelNotificationById,
  displayNotification,
  scheduleOneOffNotification,
} from './notifications';
import { describeWeatherCode, getHourlyForecast, HourlyEntry } from './weather';

export type ScheduleItem = {
  id: string;
  title: string;
  /** Local hour 0-23 the item starts */
  hour: number;
  /** YYYY-MM-DD of the item */
  dateKey: string;
};

export type RainWarning = {
  id: string;
  title: string;
  hour: number;
  /** Precipitation probability 0..100 for that hour */
  prob: number;
  emoji: string;
  label: string;
};

type ReminderHabit = {
  id: string;
  name: string;
  reminder?: { time: string; enabled: boolean };
};

export const RAIN_PROB_THRESHOLD = 40;
export const RAIN_NOTIFIED_KEY = 'rainAlerts:notified';
/** zustand persist key (useStore) — read directly on background wake-ups. */
export const STORE_PERSIST_KEY = 'routiner-store';
export const PRE_WARN_LEAD_MS = 60 * 60 * 1000;
export const PRE_WARN_MIN_FUTURE_MS = 10 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Leading HH:MM of "19:00" or "09:30–10:30"; null when unparseable. */
const startHour = (time: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  return m ? Number(m[1]) : null;
};

/** Drizzle/rain/showers, snow, thunder — anything falling from the sky. */
const isPrecipCode = (code: number): boolean =>
  (code >= 51 && code <= 67) ||
  (code >= 71 && code <= 86) ||
  (code >= 95 && code <= 99);

/** Today's not-done timed tasks and enabled habit reminders still ahead. */
export const upcomingItems = (
  planner: PlannerItem[],
  habits: ReminderHabit[],
  now: Date,
): ScheduleItem[] => {
  const dateKey = localDateKey(now);
  const items: ScheduleItem[] = [];
  for (const task of planner) {
    if (task.date !== dateKey || task.done) {
      continue;
    }
    const hour = startHour(task.time);
    if (hour == null || hour < now.getHours()) {
      continue;
    }
    items.push({ id: task.id, title: task.title, hour, dateKey });
  }
  for (const habit of habits) {
    if (!habit.reminder?.enabled) {
      continue;
    }
    const hour = startHour(habit.reminder.time);
    if (hour == null || hour < now.getHours()) {
      continue;
    }
    items.push({ id: habit.id, title: habit.name, hour, dateKey });
  }
  return items;
};

export const findRainWarnings = (
  items: ScheduleItem[],
  entries: HourlyEntry[],
  threshold = RAIN_PROB_THRESHOLD,
): RainWarning[] => {
  const warnings: RainWarning[] = [];
  for (const item of items) {
    const entry = entries.find(
      e => e.time === `${item.dateKey}T${pad(item.hour)}:00`,
    );
    if (!entry) {
      continue;
    }
    if (entry.prob >= threshold || isPrecipCode(entry.code)) {
      const { emoji, label } = isPrecipCode(entry.code)
        ? describeWeatherCode(entry.code)
        : { emoji: '🌧️', label: 'Rain' };
      warnings.push({
        id: item.id,
        title: item.title,
        hour: item.hour,
        prob: entry.prob,
        emoji,
        label,
      });
    }
  }
  return warnings;
};

export const formatHour = (hour: number): string => {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
};

export const filterNotNotified = (
  warnings: RainWarning[],
  record: Record<string, string>,
  dateKey: string,
): RainWarning[] => warnings.filter(w => record[w.id] !== dateKey);

/**
 * OS-delivery moment for the "starts soon" pre-warning: an hour before
 * the item, but only when that moment is still comfortably ahead —
 * otherwise the immediate detection notification just covered it.
 */
export const preWarnTimestamp = (
  dateKey: string,
  hour: number,
  now: Date,
): number | null => {
  const ts =
    new Date(`${dateKey}T${pad(hour)}:00:00`).getTime() - PRE_WARN_LEAD_MS;
  return ts > now.getTime() + PRE_WARN_MIN_FUTURE_MS ? ts : null;
};

/** Planner + habits out of the raw persisted store JSON (background path). */
export const scheduleFromPersisted = (
  raw: string | null,
): {
  planner: PlannerItem[];
  habits: {
    id: string;
    name: string;
    reminder?: { time: string; enabled: boolean };
  }[];
} => {
  try {
    const state = raw ? JSON.parse(raw)?.state : null;
    return {
      planner: Array.isArray(state?.planner) ? state.planner : [],
      habits: Array.isArray(state?.habits) ? state.habits : [],
    };
  } catch {
    return { planner: [], habits: [] };
  }
};

/**
 * Check today's schedule against the forecast and notify once per item
 * per day. Returns the warnings that were newly notified.
 */
export const checkRainForSchedule = async (
  planner: PlannerItem[],
  habits: ReminderHabit[],
  now = new Date(),
): Promise<RainWarning[]> => {
  const items = upcomingItems(planner, habits, now);
  if (!items.length) {
    return [];
  }
  const entries = await getHourlyForecast(now.getTime());
  if (!entries.length) {
    return [];
  }

  let record: Record<string, string> = {};
  try {
    const raw = await AsyncStorage.getItem(RAIN_NOTIFIED_KEY);
    record = raw ? JSON.parse(raw) : {};
  } catch {
    record = {};
  }
  const dateKey = localDateKey(now);
  const warnings = findRainWarnings(items, entries);
  const fresh = filterNotNotified(warnings, record, dateKey);

  for (const warning of fresh) {
    const shown = await displayNotification(
      `rain-${warning.id}`,
      'Weather heads-up',
      `${warning.emoji} Possibility of ${warning.label.toLowerCase()} around ` +
        `${formatHour(warning.hour)} (${warning.prob}%) — “${warning.title}” ` +
        'is on your plan.',
    );
    if (shown) {
      record[warning.id] = dateKey;
    }
  }
  // Persist only today's entries so the record never grows unbounded.
  try {
    await AsyncStorage.setItem(
      RAIN_NOTIFIED_KEY,
      JSON.stringify(
        Object.fromEntries(
          Object.entries(record).filter(([, day]) => day === dateKey),
        ),
      ),
    );
  } catch {
    // best effort — worst case the same warning shows again next open
  }

  // Keep the OS-scheduled "starts soon" pre-warnings in sync with the
  // latest forecast: (re)schedule flagged items, clear cleared-up ones.
  const flagged = new Map(warnings.map(w => [w.id, w]));
  for (const item of items) {
    const preId = `rain-pre-${item.id}`;
    const warning = flagged.get(item.id);
    const ts = warning ? preWarnTimestamp(item.dateKey, item.hour, now) : null;
    if (warning && ts != null) {
      await scheduleOneOffNotification(
        preId,
        'Weather heads-up',
        `${warning.emoji} ${warning.label} expected around ` +
          `${formatHour(item.hour)} (${warning.prob}%) — “${item.title}” ` +
          'starts soon.',
        ts,
      );
    } else {
      await cancelNotificationById(preId);
    }
  }
  return fresh;
};

/**
 * Background-fetch entry point: no UI is mounted, so the schedule comes
 * straight from the persisted store snapshot.
 */
export const runBackgroundRainCheck = async (): Promise<RainWarning[]> => {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORE_PERSIST_KEY);
  } catch {
    raw = null;
  }
  const { planner, habits } = scheduleFromPersisted(raw);
  return checkRainForSchedule(planner, habits);
};
