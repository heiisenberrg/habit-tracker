/**
 * Remembered-date reminders. Notifee has no yearly repeat (hourly / daily /
 * weekly only), so every enabled entry gets ONE-SHOT triggers for its next
 * occurrence — `date-<id>-before` and/or `date-<id>-on` — and the set is
 * re-armed on boot, whenever the list changes, and on background-fetch
 * wake-ups. Once a trigger fires, the next resync arms the following year.
 *
 * Passive by construction: resync never prompts. The Remember dates screen
 * owns the permission ask (saving an entry with its reminder on), exactly
 * like creating a habit reminder does.
 */
import { RememberedDate } from '../data/dates';
import { selectTriggers, triggerId } from './dates';
import {
  NotificationChannel,
  cancelNotificationById,
  hasNotificationPermission,
  listTriggerNotificationIds,
  notificationsAvailable,
  scheduleOneOffNotification,
} from './notifications';
import { useStore, whenHydrated } from '../store/useStore';

export const DATES_CHANNEL: NotificationChannel = {
  id: 'dates',
  name: 'Remembered dates',
};

/** iOS keeps 64 pending notifications per app; habit reminders and the recap share them. */
export const MAX_DATE_TRIGGERS = 40;

const PREFIX = 'date-';

export const dateNotificationIds = (entryId: string): string[] => [
  triggerId(entryId, 'on'),
  triggerId(entryId, 'before'),
];

export const cancelDateReminders = async (entryId: string): Promise<void> => {
  for (const id of dateNotificationIds(entryId)) {
    await cancelNotificationById(id);
  }
};

/**
 * Bring the OS trigger set in line with the store: arm what the entries
 * want, drop every `date-*` trigger they no longer want (removed or
 * disabled entries, a reminder narrowed from "both" to one slot, an import
 * that replaced the list). Idempotent — same ids replace in place.
 */
export const resyncDateReminders = async (
  entries: RememberedDate[] = useStore.getState().dates,
  now: Date = new Date(),
): Promise<void> => {
  if (!notificationsAvailable()) {
    return;
  }
  if (!(await hasNotificationPermission())) {
    return;
  }
  const wanted = selectTriggers(entries, now, MAX_DATE_TRIGGERS);
  const wantedIds = new Set(wanted.map(t => t.id));
  for (const id of await listTriggerNotificationIds()) {
    if (id.startsWith(PREFIX) && !wantedIds.has(id)) {
      await cancelNotificationById(id);
    }
  }
  for (const t of wanted) {
    await scheduleOneOffNotification(
      t.id,
      t.title,
      t.body,
      t.timestamp,
      DATES_CHANNEL,
    );
  }
};

/** Background-fetch entry: hydration-gated, read-only on the store. */
export const runBackgroundDatesCheck = async (): Promise<void> => {
  await whenHydrated();
  await resyncDateReminders();
};
