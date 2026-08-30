/**
 * Local reminder notifications via Notifee. Each habit with a reminder gets a
 * daily repeating trigger notification at its HH:MM time. Delivered/scheduled
 * notifications are mirrored into the in-app inbox (store), and the iOS sound
 * honors the in-app "Sounds" preference.
 */
import { useStore } from '../store/useStore';

let notifee: any = null;
let TriggerType: any = null;
let RepeatFrequency: any = null;
let AndroidImportance: any = null;
try {
  const mod = require('@notifee/react-native');
  notifee = mod.default ?? mod;
  TriggerType = mod.TriggerType;
  RepeatFrequency = mod.RepeatFrequency;
  AndroidImportance = mod.AndroidImportance;
} catch {
  notifee = null;
}

export const notificationsAvailable = (): boolean =>
  typeof notifee?.createTriggerNotification === 'function';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!notificationsAvailable()) {
    return false;
  }
  try {
    const settings = await notifee.requestPermission();
    // 1 = authorized, 2 = provisional (iOS); Android resolves granted
    return settings.authorizationStatus >= 1;
  } catch {
    return false;
  }
};

/** iOS notification options honoring the in-app "Sounds" preference. */
const iosOptions = (): { sound?: string } =>
  useStore.getState().prefs.sounds ? { sound: 'default' } : {};

const nextOccurrence = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  const next = new Date();
  next.setHours(h || 9, m || 0, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
};

/**
 * Schedule (or replace) a daily reminder for a habit. Pass `silent` when
 * called from a boot-time resync loop so the in-app inbox isn't spammed;
 * direct calls (user just set the reminder) log an inbox item.
 */
export const scheduleDailyReminder = async (
  habitId: string,
  title: string,
  time: string,
  options?: { silent?: boolean },
): Promise<boolean> => {
  if (!notificationsAvailable()) {
    return false;
  }
  const granted = await requestNotificationPermission();
  if (!granted) {
    return false;
  }
  try {
    const channelId =
      (await notifee.createChannel?.({
        id: 'reminders',
        name: 'Habit reminders',
        importance: AndroidImportance?.HIGH,
      })) ?? 'reminders';
    await notifee.createTriggerNotification(
      {
        id: `reminder-${habitId}`,
        title: 'Routiner',
        body: `⏰ ${title} — time to keep the streak alive!`,
        android: { channelId, pressAction: { id: 'default' } },
        ios: iosOptions(),
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: nextOccurrence(time),
        repeatFrequency: RepeatFrequency.DAILY,
      },
    );
    if (!options?.silent) {
      useStore.getState().addInboxItem({
        title: 'Reminder set ⏰',
        body: `${title} — every day at ${time}.`,
      });
    }
    return true;
  } catch {
    return false;
  }
};

/** Show an immediate one-off notification (e.g. a weather heads-up). */
export const displayNotification = async (
  id: string,
  title: string,
  body: string,
): Promise<boolean> => {
  if (!notificationsAvailable()) {
    return false;
  }
  const granted = await requestNotificationPermission();
  if (!granted) {
    return false;
  }
  try {
    const channelId =
      (await notifee.createChannel?.({
        id: 'weather',
        name: 'Weather alerts',
        importance: AndroidImportance?.HIGH,
      })) ?? 'weather';
    await notifee.displayNotification({
      id,
      title,
      body,
      android: { channelId, pressAction: { id: 'default' } },
      ios: iosOptions(),
    });
    useStore.getState().addInboxItem({ title, body });
    return true;
  } catch {
    return false;
  }
};

/** Schedule a one-off OS-delivered notification at an exact timestamp. */
export const scheduleOneOffNotification = async (
  id: string,
  title: string,
  body: string,
  timestamp: number,
): Promise<boolean> => {
  if (!notificationsAvailable()) {
    return false;
  }
  const granted = await requestNotificationPermission();
  if (!granted) {
    return false;
  }
  try {
    const channelId =
      (await notifee.createChannel?.({
        id: 'weather',
        name: 'Weather alerts',
        importance: AndroidImportance?.HIGH,
      })) ?? 'weather';
    await notifee.createTriggerNotification(
      {
        id,
        title,
        body,
        android: { channelId, pressAction: { id: 'default' } },
        ios: iosOptions(),
      },
      { type: TriggerType.TIMESTAMP, timestamp },
    );
    return true;
  } catch {
    return false;
  }
};

/** Cancel any notification (pending or delivered) by its id. */
export const cancelNotificationById = async (id: string): Promise<void> => {
  if (!notificationsAvailable()) {
    return;
  }
  try {
    await notifee.cancelNotification(id);
  } catch {
    // ignore
  }
};

export const cancelReminder = async (habitId: string): Promise<void> => {
  if (!notificationsAvailable()) {
    return;
  }
  try {
    await notifee.cancelNotification(`reminder-${habitId}`);
  } catch {
    // ignore
  }
};

/**
 * Notifee requires a background event handler registered at app boot
 * (before registerComponent) so background notification events don't warn.
 */
export const registerBackgroundHandler = (): void => {
  if (!notificationsAvailable()) {
    return;
  }
  notifee.onBackgroundEvent(async () => {
    // Tapping a reminder just opens the app; no background actions yet.
  });
};

/**
 * Re-create triggers for every enabled reminder (idempotent — same ids).
 * Keeps notifications alive across reinstalls while the store remembers them.
 */
export const resyncReminders = async (
  habits: {
    id: string;
    name: string;
    reminder?: { time: string; enabled: boolean };
  }[],
): Promise<void> => {
  if (!notificationsAvailable()) {
    return;
  }
  for (const habit of habits) {
    if (habit.reminder?.enabled) {
      await scheduleDailyReminder(habit.id, habit.name, habit.reminder.time, {
        silent: true,
      });
    }
  }
};
