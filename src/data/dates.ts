/**
 * Remember dates data model.
 *
 * A REMEMBERED DATE is "Ajay's birthday, 25 June" — a day of the year, with
 * an optional year so the reminder can say "turns 30", that either comes
 * round every year or happens once (an FD closing, a passport renewal). The
 * reminder preference is per entry: on the day, the day before, or both.
 */

export type DateKind =
  | 'birthday'
  | 'anniversary'
  | 'remembrance'
  | 'deadline'
  | 'other';

export type DateRepeat = 'yearly' | 'once';

/** When the reminder lands relative to the date. */
export type RemindWhen = 'on' | 'dayBefore' | 'both';

export type RememberedDate = {
  id: string;
  title: string;
  kind: DateKind;
  day: number; // 1..31
  month: number; // 1..12
  /** Optional for yearly dates (enables "turns 30"); required for one-offs. */
  year?: number;
  repeat: DateRepeat;
  remind: RemindWhen;
  /** Local wall-clock time the reminder fires, 'HH:MM'. */
  time: string;
  enabled: boolean;
  createdAt: string; // ISO
};

export type KindMeta = {
  kind: DateKind;
  emoji: string;
  label: string;
  /** Placeholder for the title field. */
  hint: string;
  defaultRepeat: DateRepeat;
};

export const KINDS: KindMeta[] = [
  {
    kind: 'birthday',
    emoji: '🎂',
    label: 'Birthday',
    hint: 'e.g. Ajay’s birthday',
    defaultRepeat: 'yearly',
  },
  {
    kind: 'anniversary',
    emoji: '💍',
    label: 'Anniversary',
    hint: 'e.g. Wedding anniversary',
    defaultRepeat: 'yearly',
  },
  {
    kind: 'remembrance',
    emoji: '🕯',
    label: 'Remembrance',
    hint: 'e.g. Grandpa',
    defaultRepeat: 'yearly',
  },
  {
    kind: 'deadline',
    emoji: '🏦',
    label: 'Deadline',
    hint: 'e.g. FD closes',
    defaultRepeat: 'once',
  },
  {
    kind: 'other',
    emoji: '📌',
    label: 'Other',
    hint: 'e.g. Passport renewal',
    defaultRepeat: 'yearly',
  },
];

export const kindMeta = (kind: DateKind): KindMeta =>
  KINDS.find(k => k.kind === kind) ?? KINDS[KINDS.length - 1];

export const REMIND_TIMES = ['08:00', '09:00', '12:00', '18:00'];
export const DEFAULT_REMIND_TIME = '09:00';

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));
