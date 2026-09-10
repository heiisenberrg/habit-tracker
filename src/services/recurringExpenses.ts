/**
 * Recurring expenses — "rent, €650, the 1st of every month". Notifee has no
 * monthly repeat (hourly/daily/weekly only), so each enabled rule gets a
 * ONE-SHOT trigger for its next due day (`recur-<id>`, 09:00), re-armed on
 * boot, rule changes and background wake-ups — the Remember-dates pattern.
 *
 * The ledger entry MATERIALIZES separately: `pendingMaterializations` lists
 * every month a rule is due but not yet added (per-rule `lastAddedMonth`
 * bookmark, so a hand-deleted entry stays deleted), and the store's
 * `rollRecurring` applies it in one set(). Passive by construction — resync
 * never prompts; the Expenses form owns the permission ask.
 */
import { RecurringExpense, categoryMeta } from '../data/expenses';
import { daysInMonth } from './dates';
import {
  formatEur,
  monthKeyOf,
  monthKeyOfDate,
  shiftMonthKey,
} from './grocery';
import {
  NotificationChannel,
  cancelNotificationById,
  hasNotificationPermission,
  listTriggerNotificationIds,
  notificationsAvailable,
  scheduleOneOffNotification,
} from './notifications';
import { toDateKey, useStore, whenHydrated } from '../store/useStore';

export const RECURRING_CHANNEL: NotificationChannel = {
  id: 'recurring',
  name: 'Recurring bills',
};

/** Few rules, one trigger each — well inside the iOS 64-pending budget. */
export const MAX_RECURRING_TRIGGERS = 20;

const PREFIX = 'recur-';
const REMIND_HOUR = 9;

const pad = (n: number) => String(n).padStart(2, '0');

/** The rule's due day in `monthKey`, clamped: day 31 in April is the 30th. */
export const dueDayKey = (
  rule: Pick<RecurringExpense, 'day'>,
  monthKey: string,
): string => {
  const [y, m] = monthKey.split('-').map(Number);
  return `${monthKey}-${pad(Math.min(rule.day, daysInMonth(m, y)))}`;
};

/** The next 09:00 due moment strictly after `now`. */
export const nextDueDate = (
  rule: Pick<RecurringExpense, 'day'>,
  now: Date = new Date(),
): Date => {
  const at = (monthKey: string): Date => {
    const [y, m, d] = dueDayKey(rule, monthKey).split('-').map(Number);
    return new Date(y, m - 1, d, REMIND_HOUR, 0, 0, 0);
  };
  const thisMonth = at(monthKeyOfDate(now));
  return thisMonth.getTime() > now.getTime()
    ? thisMonth
    : at(shiftMonthKey(monthKeyOfDate(now), 1));
};

export type Materialization = {
  recurringId: string;
  monthKey: string;
  category: RecurringExpense['category'];
  amount: number;
  note?: string;
};

/**
 * Every month a rule is due but not yet in the ledger, oldest first: from
 * the month after `lastAddedMonth` (or the rule's creation month) up to
 * today, wherever the due day has arrived. Capped at 12 months of catch-up.
 */
export const pendingMaterializations = (
  rules: RecurringExpense[],
  today: Date = new Date(),
): { additions: Materialization[]; lastAdded: Record<string, string> } => {
  const todayDayKey = toDateKey(today);
  const nowMonth = monthKeyOfDate(today);
  const additions: Materialization[] = [];
  const lastAdded: Record<string, string> = {};
  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }
    let m = rule.lastAddedMonth
      ? shiftMonthKey(rule.lastAddedMonth, 1)
      : monthKeyOf(rule.createdAt.slice(0, 10));
    let guard = 0;
    while (m <= nowMonth && guard++ < 12) {
      if (dueDayKey(rule, m) > todayDayKey) {
        break; // not due yet this month — later months can't be either
      }
      additions.push({
        recurringId: rule.id,
        monthKey: m,
        category: rule.category,
        amount: rule.amount,
        note: rule.note,
      });
      lastAdded[rule.id] = m;
      m = shiftMonthKey(m, 1);
    }
  }
  return { additions, lastAdded };
};

export type RecurringTrigger = {
  id: string;
  timestamp: number;
  title: string;
  body: string;
};

/** One trigger per enabled rule, soonest first, capped. */
export const triggersForRules = (
  rules: RecurringExpense[],
  now: Date = new Date(),
  cap = MAX_RECURRING_TRIGGERS,
): RecurringTrigger[] =>
  rules
    .filter(r => r.enabled)
    .map(r => {
      const meta = categoryMeta(r.category);
      return {
        id: `${PREFIX}${r.id}`,
        timestamp: nextDueDate(r, now).getTime(),
        title: `${meta.emoji} ${meta.label}${r.note ? ` · ${r.note}` : ''}`,
        body: `${formatEur(r.amount)} due today — added to your expenses`,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, cap);

export const cancelRecurringReminder = async (
  ruleId: string,
): Promise<void> => cancelNotificationById(`${PREFIX}${ruleId}`);

/** Silent resync — same contract as the date-reminders one. */
export const resyncRecurringReminders = async (
  rules: RecurringExpense[] = useStore.getState().recurring,
  now: Date = new Date(),
): Promise<void> => {
  if (!notificationsAvailable()) {
    return;
  }
  if (!(await hasNotificationPermission())) {
    return;
  }
  const wanted = triggersForRules(rules, now);
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
      RECURRING_CHANNEL,
    );
  }
};

/** Background-fetch entry: hydration-gated, materialize then re-arm. */
export const runBackgroundRecurringCheck = async (): Promise<void> => {
  await whenHydrated();
  useStore.getState().rollRecurring();
  await resyncRecurringReminders();
};
