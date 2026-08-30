/**
 * Pure helpers deriving the Profile screen's Activity feed and Achievements
 * from real store data. No hooks and no store imports — every input is passed
 * in as an argument so these stay trivially testable.
 */
import type { Challenge, Habit } from './seed';
import type { InboxItem } from '../store/useStore';

const DAY_MS = 86400000;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Parse "YYYY-MM-DD" as local noon so timezone shifts can't move the day. */
const dateKeyToDate = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
};

/** Whole calendar days from `a` to `b` (positive when `a` is earlier). */
const daysBetween = (a: Date, b: Date): number => {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / DAY_MS);
};

/** Compact relative timestamp: "just now", "5m ago", "2h ago", "3d ago". */
export const timeAgo = (iso: string, now = new Date()): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const minutes = Math.floor((now.getTime() - then) / 60000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return `${Math.floor(days / 7)}w ago`;
};

/** "Today", "Yesterday" or "Aug 12" — with ", 2:34 PM" when a time is known. */
const formatWhen = (date: Date, hasTime: boolean, now: Date): string => {
  const ago = daysBetween(date, now);
  const day =
    ago <= 0
      ? 'Today'
      : ago === 1
      ? 'Yesterday'
      : `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  if (!hasTime) {
    return day;
  }
  const h24 = date.getHours();
  const h = h24 % 12 || 12;
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${day}, ${h}:${min} ${h24 >= 12 ? 'PM' : 'AM'}`;
};

const GREEN = { tint: '#E3F3E2', color: '#3BA935' };
const GOLD = { tint: '#FFF3D6', color: '#F5A623' };
const BLUE = { tint: '#EBECFF', color: '#3843FF' };
const PINK = { tint: '#FCDDEC', color: '#D6246E' };

export type FeedEvent = {
  id: string;
  title: string;
  /** Human display date, e.g. "Today", "Yesterday", "Aug 12, 9:05 AM". */
  when: string;
  /** Epoch ms of the event, for sorting. */
  at: number;
  icon: string;
  tint: string;
  color: string;
};

export type FeedSource = {
  habits: Habit[];
  completions: Record<string, Record<string, number>>;
  histories: Record<string, number[]>;
  moods: Record<string, string>;
  challenges: Challenge[];
  challengeJoinedOn: Record<string, string>;
  inbox: InboxItem[];
};

/**
 * Recent real activity (last 30 days), newest first: habit completions that
 * were actually logged, perfect days from history, moods, challenge joins and
 * in-app notifications. Every date is computed from stored data.
 */
export const deriveFeed = (s: FeedSource, now = new Date()): FeedEvent[] => {
  const events: FeedEvent[] = [];
  const inWindow = (date: Date) => {
    const ago = daysBetween(date, now);
    return ago >= 0 && ago <= 30;
  };
  const push = (
    id: string,
    title: string,
    date: Date,
    hasTime: boolean,
    look: { tint: string; color: string },
    icon: string,
  ) =>
    events.push({
      id,
      title,
      when: formatWhen(date, hasTime, now),
      at: date.getTime(),
      icon,
      ...look,
    });

  // Habit completions actually logged (goal reached on that day).
  for (const habit of s.habits) {
    const byDay = s.completions[habit.id];
    if (!byDay) {
      continue;
    }
    for (const [key, amount] of Object.entries(byDay)) {
      if (amount >= habit.goal.amount) {
        const date = dateKeyToDate(key);
        if (inWindow(date)) {
          push(
            `done-${habit.id}-${key}`,
            `${habit.name} completed ${habit.emoji}`,
            date,
            false,
            GREEN,
            '↑',
          );
        }
      }
    }
  }

  // Perfect days from the synthesized history (index 82 = yesterday).
  if (s.habits.length) {
    for (let i = 53; i < 83; i++) {
      const fraction =
        s.habits.reduce((a, h) => a + (s.histories[h.id]?.[i] ?? 0), 0) /
        s.habits.length;
      if (fraction >= 1) {
        const date = new Date(now);
        date.setDate(date.getDate() - (83 - i));
        date.setHours(12, 0, 0, 0);
        push(
          `perfect-${i}`,
          'Perfect day — every habit done!',
          date,
          false,
          GOLD,
          '🏅',
        );
      }
    }
  }

  // Moods logged.
  for (const [key, emoji] of Object.entries(s.moods)) {
    const date = dateKeyToDate(key);
    if (inWindow(date)) {
      push(`mood-${key}`, `Mood logged ${emoji}`, date, false, BLUE, emoji);
    }
  }

  // Challenges joined.
  for (const [id, key] of Object.entries(s.challengeJoinedOn)) {
    const challenge = s.challenges.find(c => c.id === id);
    const date = dateKeyToDate(key);
    if (inWindow(date)) {
      push(
        `join-${id}`,
        `Joined ${challenge ? challenge.title : 'a challenge'}`,
        date,
        false,
        PINK,
        '🤝',
      );
    }
  }

  // In-app notifications (reminders, milestones, weather heads-ups).
  for (const item of s.inbox) {
    const date = new Date(item.at);
    if (!Number.isNaN(date.getTime()) && inWindow(date)) {
      push(`inbox-${item.id}`, item.title, date, true, BLUE, '🔔');
    }
  }

  return events.sort((a, b) => b.at - a.at).slice(0, 100);
};

export type Achievement = {
  id: string;
  title: string;
  detail: string;
  icon: string;
  tint: string;
  unlocked: boolean;
};

/**
 * Honest milestones computed from real data. We don't store when a milestone
 * was reached, so there are no unlock timestamps — only Unlocked/Locked.
 */
export const deriveAchievements = (
  s: {
    habits: Habit[];
    moods: Record<string, string>;
    challengeJoinedOn: Record<string, string>;
  },
  streak: number,
  perfectDays: number,
): Achievement[] => [
  {
    id: 'first-habit',
    title: 'Getting started',
    detail: 'First habit created',
    icon: '🌱',
    tint: GREEN.tint,
    unlocked: s.habits.length > 0,
  },
  {
    id: 'perfect-day',
    title: 'Perfect day',
    detail: 'Every habit done in a single day',
    icon: '🏅',
    tint: GOLD.tint,
    unlocked: perfectDays >= 1,
  },
  {
    id: 'streak-3',
    title: 'On a roll',
    detail: '3-day perfect streak',
    icon: '🔥',
    tint: GOLD.tint,
    unlocked: streak >= 3,
  },
  {
    id: 'streak-7',
    title: 'Unstoppable',
    detail: '7-day perfect streak',
    icon: '⚡',
    tint: '#FCE6E5',
    unlocked: streak >= 7,
  },
  {
    id: 'challenge',
    title: 'Challenger',
    detail: 'Joined a challenge',
    icon: '🤝',
    tint: PINK.tint,
    unlocked: Object.keys(s.challengeJoinedOn).length > 0,
  },
  {
    id: 'early-bird',
    title: 'Early bird',
    detail: 'Reminder set before 9 AM',
    icon: '🌅',
    tint: '#DDF2FC',
    unlocked: s.habits.some(
      h => h.reminder?.enabled === true && h.reminder.time < '09:00',
    ),
  },
  {
    id: 'mood',
    title: 'In touch',
    detail: 'Logged a mood',
    icon: '😊',
    tint: BLUE.tint,
    unlocked: Object.keys(s.moods).length > 0,
  },
];
