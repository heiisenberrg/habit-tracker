/**
 * Local reminder notifications via Notifee. Each habit with a reminder gets a
 * daily repeating trigger notification at its HH:MM time. Delivered/scheduled
 * notifications are mirrored into the in-app inbox (store), and the iOS sound
 * honors the in-app "Sounds" preference.
 */
import { todayKey, useStore, whenHydrated } from '../store/useStore';

let notifee: any = null;
let TriggerType: any = null;
let RepeatFrequency: any = null;
let AndroidImportance: any = null;
let EventType: any = null;
try {
  const mod = require('@notifee/react-native');
  notifee = mod.default ?? mod;
  TriggerType = mod.TriggerType;
  RepeatFrequency = mod.RepeatFrequency;
  AndroidImportance = mod.AndroidImportance;
  EventType = mod.EventType;
} catch {
  notifee = null;
}

/** What the action buttons need to know about a habit (C4 + eng OV #5). */
export type HabitActionInfo = {
  tracking: 'check' | 'count';
  step: number;
  unit: string;
};

/** Check habits: one "Mark done". Count habits: "+step" AND "Complete". */
export const actionsForHabit = (
  info: HabitActionInfo,
): { id: string; title: string }[] =>
  info.tracking === 'check'
    ? [{ id: 'done', title: '✅ Mark done' }]
    : [
        { id: 'step', title: `＋${info.step} ${info.unit}` },
        { id: 'complete', title: '✅ Complete' },
      ];

/**
 * iOS: actions live on per-habit categories, re-registered whenever habits
 * change. Android embeds actions per-notification (see scheduleDailyReminder)
 * — this is a no-op there.
 */
export const syncActionCategories = async (
  habits: ({ id: string } & HabitActionInfo)[],
): Promise<void> => {
  if (!notifee?.setNotificationCategories) {
    return;
  }
  try {
    await notifee.setNotificationCategories(
      habits.map(h => ({
        id: `habit-${h.id}`,
        actions: actionsForHabit(h).map(a => ({ id: a.id, title: a.title })),
      })),
    );
  } catch {
    // categories are additive sugar — never block scheduling on them
  }
};

/**
 * Apply a pressed reminder action through the store API (single-writer
 * rule). Pure store semantics — exported for the E3 test suite.
 * Returns whether a progress re-post is needed (+step short of goal).
 */
export const applyReminderAction = (
  habitId: string,
  actionId: string,
): { applied: boolean; rePost: boolean } => {
  const s = useStore.getState();
  const habit = s.habits.find(h => h.id === habitId);
  if (!habit) {
    return { applied: false, rePost: false };
  }
  if (actionId === 'done' || actionId === 'complete') {
    s.setCompletion(habitId, habit.goal.amount);
    s.setStatus(habitId, null);
    return { applied: true, rePost: false };
  }
  if (actionId === 'step') {
    s.increment(habitId);
    const after = useStore.getState().completions[habitId]?.[todayKey()] ?? 0;
    return { applied: true, rePost: after < habit.goal.amount };
  }
  return { applied: false, rePost: false };
};

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

/**
 * Permission check that NEVER prompts. Passive schedulers (evening recap,
 * rain heads-ups) run at boot and on Home mount; a brand-new user must not
 * get the OS permission dialog over the splash screen. Only user-initiated
 * paths (setting a reminder) may call requestNotificationPermission.
 */
export const hasNotificationPermission = async (): Promise<boolean> => {
  if (!notificationsAvailable()) {
    return false;
  }
  try {
    const settings = await notifee.getNotificationSettings();
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
  options?: { silent?: boolean; habitInfo?: HabitActionInfo },
): Promise<boolean> => {
  if (!notificationsAvailable()) {
    return false;
  }
  // Boot-time resync (silent) never prompts: a reminder restored from a
  // backup onto a device that never granted permission stays quiet until
  // the user touches a reminder or the recap toggle.
  const granted = options?.silent
    ? await hasNotificationPermission()
    : await requestNotificationPermission();
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
    // Resolve action info: explicit param wins (habit may not be in the
    // store yet at create-time), else look the habit up.
    const habit = useStore.getState().habits.find(h => h.id === habitId);
    const info: HabitActionInfo | null =
      options?.habitInfo ??
      (habit
        ? {
            tracking: habit.tracking ?? 'count',
            step: habit.step,
            unit: habit.goal.unit,
          }
        : null);
    await notifee.createTriggerNotification(
      {
        id: `reminder-${habitId}`,
        title: 'Routiner',
        body: `⏰ ${title} — time to keep the streak alive!`,
        android: {
          channelId,
          pressAction: { id: 'default' },
          // Android: actions are embedded per-notification (eng OV #5)
          actions: info
            ? actionsForHabit(info).map(a => ({
                title: a.title,
                pressAction: { id: a.id },
              }))
            : undefined,
        },
        ios: {
          ...iosOptions(),
          categoryId: info ? `habit-${habitId}` : undefined,
        },
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

/** Android channel descriptors for the passive (never-prompting) paths. */
export type NotificationChannel = { id: string; name: string };
export const WEATHER_CHANNEL: NotificationChannel = {
  id: 'weather',
  name: 'Weather alerts',
};
export const RECAP_CHANNEL: NotificationChannel = {
  id: 'recap',
  name: 'Evening recap',
};

/**
 * Shared gate for every passive path: notifee present, permission ALREADY
 * granted (never prompts — only scheduleDailyReminder and the Settings
 * "Evening recap" toggle may raise the OS dialog), channel ensured.
 * Resolves the channel id, or null when the notification must be skipped.
 */
const passiveChannelReady = async (
  channel: NotificationChannel,
): Promise<string | null> => {
  if (!notificationsAvailable()) {
    return null;
  }
  if (!(await hasNotificationPermission())) {
    return null;
  }
  try {
    return (
      (await notifee.createChannel?.({
        id: channel.id,
        name: channel.name,
        importance: AndroidImportance?.HIGH,
      })) ?? channel.id
    );
  } catch {
    return channel.id;
  }
};

/** Show an immediate one-off notification (e.g. a weather heads-up). Passive. */
export const displayNotification = async (
  id: string,
  title: string,
  body: string,
  channel: NotificationChannel = WEATHER_CHANNEL,
): Promise<boolean> => {
  const channelId = await passiveChannelReady(channel);
  if (!channelId) {
    return false;
  }
  try {
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

/** Schedule a one-off OS-delivered notification at an exact timestamp. Passive. */
export const scheduleOneOffNotification = async (
  id: string,
  title: string,
  body: string,
  timestamp: number,
  channel: NotificationChannel = WEATHER_CHANNEL,
): Promise<boolean> => {
  const channelId = await passiveChannelReady(channel);
  if (!channelId) {
    return false;
  }
  try {
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
 * Shared event router for BOTH background and foreground deliveries (the
 * foreground handler was previously missing — action taps dropped, OV #10).
 * Action presses mutate through the store after the hydration gate, then
 * run the afterMutation seam; "+step" short of goal re-posts progress.
 */
const handleNotificationEvent = async (event: {
  type: number;
  detail: { notification?: { id?: string }; pressAction?: { id?: string } };
}): Promise<void> => {
  const { type, detail } = event;
  if (EventType == null || type !== EventType.ACTION_PRESS) {
    return;
  }
  const notifId = detail.notification?.id ?? '';
  const actionId = detail.pressAction?.id ?? '';
  if (!notifId.startsWith('reminder-') || !actionId) {
    return;
  }
  const habitId = notifId.slice('reminder-'.length);
  await whenHydrated();
  const { applied, rePost } = applyReminderAction(habitId, actionId);
  if (!applied) {
    return;
  }
  // lazy require keeps the notifications↔recap import cycle init-safe
  const { afterMutation } = require('./afterMutation');
  await afterMutation();
  if (rePost) {
    const s = useStore.getState();
    const habit = s.habits.find(h => h.id === habitId);
    if (habit) {
      const current = s.completions[habitId]?.[todayKey()] ?? 0;
      const remaining = habit.goal.amount - current;
      await notifee.displayNotification({
        id: `reminder-${habitId}`,
        title: 'Routiner',
        body: `💪 ${habit.name}: ${remaining} ${habit.goal.unit} to go`,
        android: {
          channelId: 'reminders',
          pressAction: { id: 'default' },
          actions: actionsForHabit({
            tracking: habit.tracking ?? 'count',
            step: habit.step,
            unit: habit.goal.unit,
          }).map(a => ({ title: a.title, pressAction: { id: a.id } })),
        },
        ios: { ...iosOptions(), categoryId: `habit-${habitId}` },
      });
    }
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
  notifee.onBackgroundEvent(handleNotificationEvent);
};

/** Foreground deliveries need their own subscription; returns unsubscribe. */
export const registerForegroundHandler = (): (() => void) => {
  if (!notificationsAvailable()) {
    return () => {};
  }
  return notifee.onForegroundEvent(handleNotificationEvent);
};

/**
 * Re-create triggers for every enabled reminder (idempotent — same ids).
 * Keeps notifications alive across reinstalls while the store remembers them.
 */
export const resyncReminders = async (
  habits: {
    id: string;
    name: string;
    step?: number;
    tracking?: 'check' | 'count';
    goal?: { unit: string };
    reminder?: { time: string; enabled: boolean };
  }[],
): Promise<void> => {
  if (!notificationsAvailable()) {
    return;
  }
  // Keep iOS action categories in lockstep with the habit set (OV #5).
  await syncActionCategories(
    habits.map(h => ({
      id: h.id,
      tracking: h.tracking ?? 'count',
      step: h.step ?? 1,
      unit: h.goal?.unit ?? 'TIMES',
    })),
  );
  for (const habit of habits) {
    if (habit.reminder?.enabled) {
      await scheduleDailyReminder(habit.id, habit.name, habit.reminder.time, {
        silent: true,
      });
    }
  }
};
