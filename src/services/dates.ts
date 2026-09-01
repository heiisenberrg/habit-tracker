/**
 * Remember dates — pure calendar logic, so "when is the next one", "which
 * triggers to arm" and "what the notification says" are unit tests rather
 * than a wait until 25 June.
 *
 * Every Date here is LOCAL time built from parts (never ISO strings): a
 * birthday is a wall-clock day, and the reminder time is a wall-clock time.
 */
import { DateRepeat, MONTHS, RememberedDate, kindMeta } from '../data/dates';

export const isLeapYear = (y: number): boolean =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Days in a month; with no year, February keeps its 29th (a yearly date). */
export const daysInMonth = (month: number, year?: number): number => {
  if (month === 2) {
    return year == null || isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

/**
 * Accept only a real calendar day. Free-text fields otherwise let 31 April
 * into the store, where every occurrence downstream becomes 1 May.
 */
export const validateDateParts = (p: {
  day: number;
  month: number;
  year?: number;
  repeat: DateRepeat;
}): string | null => {
  if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) {
    return 'Pick a month.';
  }
  if (
    p.year != null &&
    (!Number.isInteger(p.year) || p.year < 1 || p.year > 9999)
  ) {
    return 'That year doesn’t look right.';
  }
  if (p.repeat === 'once' && p.year == null) {
    return 'A one-off date needs a year.';
  }
  if (
    !Number.isInteger(p.day) ||
    p.day < 1 ||
    p.day > daysInMonth(p.month, p.year)
  ) {
    const when =
      p.year != null ? `${MONTHS[p.month - 1]} ${p.year}` : MONTHS[p.month - 1];
    return `${when} doesn’t have a day ${p.day}.`;
  }
  return null;
};

const parseTime = (time: string): [number, number] => {
  const [h, m] = time.split(':').map(Number);
  return [Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0];
};

const startOfDay = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** The entry's day in `year` at midnight; 29 February clamps to the 28th. */
const occurrenceDay = (
  entry: Pick<RememberedDate, 'day' | 'month'>,
  year: number,
): Date =>
  new Date(year, entry.month - 1, Math.min(entry.day, daysInMonth(entry.month, year)));

/** The entry's day in `year` at its reminder time. */
export const occurrenceOn = (
  entry: Pick<RememberedDate, 'day' | 'month' | 'time'>,
  year: number,
): Date => {
  const [h, m] = parseTime(entry.time);
  const d = occurrenceDay(entry, year);
  d.setHours(h, m, 0, 0);
  return d;
};

/**
 * The next reminder-time occurrence strictly after `now` — this year's if
 * the reminder hasn't fired yet, else next year's. One-offs are themselves
 * while ahead and null once they have passed.
 */
export const nextOccurrence = (
  entry: RememberedDate,
  now: Date = new Date(),
): Date | null => {
  if (entry.repeat === 'once') {
    if (entry.year == null) {
      return null;
    }
    const d = occurrenceOn(entry, entry.year);
    return d.getTime() > now.getTime() ? d : null;
  }
  const thisYear = occurrenceOn(entry, now.getFullYear());
  return thisYear.getTime() > now.getTime()
    ? thisYear
    : occurrenceOn(entry, now.getFullYear() + 1);
};

/**
 * Day-level next occurrence (midnight) for countdowns: the date stays
 * "today" all day, even after the reminder has fired.
 */
export const nextOccurrenceDay = (
  entry: RememberedDate,
  today: Date = new Date(),
): Date | null => {
  const t0 = startOfDay(today).getTime();
  if (entry.repeat === 'once') {
    if (entry.year == null) {
      return null;
    }
    const d = occurrenceDay(entry, entry.year);
    return d.getTime() >= t0 ? d : null;
  }
  const d = occurrenceDay(entry, today.getFullYear());
  return d.getTime() >= t0 ? d : occurrenceDay(entry, today.getFullYear() + 1);
};

/** Calendar days until the next occurrence: 0 today, 1 tomorrow; null when past. */
export const daysUntil = (
  entry: RememberedDate,
  today: Date = new Date(),
): number | null => {
  const d = nextOccurrenceDay(entry, today);
  if (!d) {
    return null;
  }
  // Rounding absorbs the DST hour.
  return Math.round((d.getTime() - startOfDay(today).getTime()) / 86400000);
};

export const countdownLabel = (days: number | null): string =>
  days == null
    ? 'Past'
    : days === 0
    ? 'Today'
    : days === 1
    ? 'Tomorrow'
    : `In ${days} days`;

/** Years since the entry's year on a given occurrence; null when unknowable. */
export const yearsOn = (
  entry: RememberedDate,
  occurrenceYear: number,
): number | null => {
  if (entry.repeat !== 'yearly' || entry.year == null) {
    return null;
  }
  const n = occurrenceYear - entry.year;
  return n > 0 ? n : null;
};

/** "turns 30" / "10 years" — or '' when the kind or the data can't say. */
export const yearsLabel = (
  entry: RememberedDate,
  occurrenceYear: number,
): string => {
  const n = yearsOn(entry, occurrenceYear);
  if (n == null) {
    return '';
  }
  if (entry.kind === 'birthday') {
    return `turns ${n}`;
  }
  if (entry.kind === 'anniversary' || entry.kind === 'remembrance') {
    return `${n} year${n === 1 ? '' : 's'}`;
  }
  return '';
};

export type TriggerSlot = 'on' | 'before';

export const triggerId = (entryId: string, slot: TriggerSlot): string =>
  `date-${entryId}-${slot}`;

/** "🎂 Ajay's birthday" / "Tomorrow · turns 30". */
export const notificationCopy = (
  entry: RememberedDate,
  slot: TriggerSlot,
  occurrenceYear: number,
): { title: string; body: string } => {
  const label = yearsLabel(entry, occurrenceYear);
  return {
    title: `${kindMeta(entry.kind).emoji} ${entry.title}`,
    body: (slot === 'on' ? 'Today' : 'Tomorrow') + (label ? ` · ${label}` : ''),
  };
};

export type DateTrigger = {
  id: string;
  slot: TriggerSlot;
  timestamp: number;
  title: string;
  body: string;
};

/**
 * The one-shot triggers to arm for an entry's NEXT occurrence, soonest
 * first. A day-before slot already behind us is skipped rather than fired
 * late — the day itself still lands.
 */
export const triggersFor = (
  entry: RememberedDate,
  now: Date = new Date(),
): DateTrigger[] => {
  if (!entry.enabled) {
    return [];
  }
  const next = nextOccurrence(entry, now);
  if (!next) {
    return [];
  }
  const year = next.getFullYear();
  const out: DateTrigger[] = [];
  if (entry.remind !== 'on') {
    const before = new Date(next);
    before.setDate(before.getDate() - 1); // wall-clock, DST-safe
    if (before.getTime() > now.getTime()) {
      out.push({
        id: triggerId(entry.id, 'before'),
        slot: 'before',
        timestamp: before.getTime(),
        ...notificationCopy(entry, 'before', year),
      });
    }
  }
  if (entry.remind !== 'dayBefore') {
    out.push({
      id: triggerId(entry.id, 'on'),
      slot: 'on',
      timestamp: next.getTime(),
      ...notificationCopy(entry, 'on', year),
    });
  }
  return out;
};

/** Every entry's triggers, soonest first, capped — the OS pending-list is finite. */
export const selectTriggers = (
  entries: RememberedDate[],
  now: Date = new Date(),
  cap = 40,
): DateTrigger[] =>
  entries
    .flatMap(e => triggersFor(e, now))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(0, cap);

/** "25 June" / "25 June 1996". */
export const formatDateLabel = (
  entry: Pick<RememberedDate, 'day' | 'month' | 'year'>,
): string =>
  `${entry.day} ${MONTHS[entry.month - 1]}${
    entry.year != null ? ` ${entry.year}` : ''
  }`;

/** "1 day before · 09:00". */
export const remindLabel = (
  entry: Pick<RememberedDate, 'remind' | 'time'>,
): string => {
  const when =
    entry.remind === 'on'
      ? 'On the day'
      : entry.remind === 'dayBefore'
      ? '1 day before'
      : 'Day before & on the day';
  return `${when} · ${entry.time}`;
};

export type UpcomingRow = {
  entry: RememberedDate;
  /** Calendar days to go; null for a one-off that already happened. */
  days: number | null;
  /** "turns 30" for the coming occurrence, or ''. */
  years: string;
};

/** The list order: soonest first, past one-offs parked at the end. */
export const upcoming = (
  entries: RememberedDate[],
  today: Date = new Date(),
): UpcomingRow[] =>
  entries
    .map(entry => {
      const next = nextOccurrenceDay(entry, today);
      return {
        entry,
        days: daysUntil(entry, today),
        years: next ? yearsLabel(entry, next.getFullYear()) : '',
      };
    })
    .sort((a, b) => {
      if (a.days == null || b.days == null) {
        if (a.days == null && b.days == null) {
          return a.entry.title.localeCompare(b.entry.title);
        }
        return a.days == null ? 1 : -1;
      }
      return a.days - b.days || a.entry.title.localeCompare(b.entry.title);
    });
