import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  Challenge,
  generateHistory,
  Habit,
  PlannerItem,
  seedChallenges,
  seedHabits,
  seedPlanner,
} from '../data/seed';

export const toDateKey = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
export const todayKey = () => toDateKey(new Date());
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export type CompletionMap = Record<string, Record<string, number>>; // habitId -> dateKey -> amount
export type DayStatus = 'skipped' | 'failed';
export type StatusMap = Record<string, Record<string, DayStatus>>; // habitId -> dateKey -> status

/** App Lock (Screen Time shield) preferences; tokens live natively. */
export type AppLockPrefs = {
  enabled: boolean;
  condition: 'habit' | 'all' | 'time';
  habitId: string | null;
  until: string; // 'HH:MM' daily unlock when condition === 'time'
};

/** Zen mode: a quiet session — reminders paused, locked apps shielded. */
export type ZenPrefs = {
  /** ISO end time of the running session, or null when idle */
  until: string | null;
  /** also run the user's "Routiner Zen" iOS Focus shortcut on start */
  useFocusShortcut: boolean;
};

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  /** ISO datetime the event happened */
  at: string;
  read: boolean;
};

type State = {
  onboarded: boolean;
  user: {
    name: string;
    surname: string;
    email: string;
    gender?: 'male' | 'female';
    birthdate?: string;
  };
  mood: string;
  habits: Habit[];
  challenges: Challenge[];
  joinedChallengeIds: string[];
  completions: CompletionMap;
  statuses: StatusMap;
  moods: Record<string, string>; // dateKey -> emoji
  planner: PlannerItem[];
  /** habit histories synthesized once: habitId -> 83 days (0/1), oldest first */
  histories: Record<string, number[]>;
  /** latch so the perfect-day congrats shows once per day */
  congratsShownOn: string | null;
  /** device integrations (personal app) */
  healthConnected: boolean;
  calendarConnected: boolean;
  darkMode: boolean;
  setDarkMode: (on: boolean) => void;
  /** digital wellbeing self-log: dateKey -> metrics */
  wellbeing: Record<
    string,
    { pickups?: number; socialMin?: number; sleepMinutes?: number }
  >;

  completeOnboarding: () => void;
  setUser: (user: Partial<State['user']>) => void;
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  removeHabit: (id: string) => void;
  setWellbeing: (
    dateKey: string,
    patch: { pickups?: number; socialMin?: number; sleepMinutes?: number },
  ) => void;
  increment: (habitId: string, dateKey?: string) => void;
  setCompletion: (habitId: string, amount: number, dateKey?: string) => void;
  toggleCheck: (habitId: string, dateKey?: string) => void;
  setStatus: (
    habitId: string,
    status: DayStatus | null,
    dateKey?: string,
  ) => void;
  setMood: (emoji: string, dateKey?: string) => void;
  joinChallenge: (id: string) => void;
  leaveChallenge: (id: string) => void;
  /** id -> YYYY-MM-DD the user joined; drives real challenge progress */
  challengeJoinedOn: Record<string, string>;
  /** in-app notification feed shown on the Notifications screen */
  inbox: InboxItem[];
  addInboxItem: (item: { title: string; body: string; at?: string }) => void;
  markInboxRead: () => void;
  prefs: { sounds: boolean; vacationMode: boolean };
  setPref: (key: 'sounds' | 'vacationMode', value: boolean) => void;
  appLock: AppLockPrefs;
  setAppLock: (patch: Partial<AppLockPrefs>) => void;
  zen: ZenPrefs;
  setZen: (patch: Partial<ZenPrefs>) => void;
  markCongratsShown: (dateKey: string) => void;
  setIntegration: (
    key: 'healthConnected' | 'calendarConnected',
    value: boolean,
  ) => void;
  importCalendarBlocks: (
    dateKey: string,
    blocks: { externalId: string; title: string; time: string }[],
  ) => void;
  addPlannerItem: (item: Omit<PlannerItem, 'id'>) => void;
  togglePlannerItem: (id: string) => void;
  movePlannerItem: (id: string, dateKey: string) => void;
  deletePlannerItem: (id: string) => void;
  reset: () => void;
};

const buildHistories = (habits: Habit[]): Record<string, number[]> =>
  Object.fromEntries(
    habits.map(h => [
      h.id,
      generateHistory(h.historySeed ?? 1, h.historyRate ?? 0),
    ]),
  );

const initial = () => ({
  onboarded: false,
  user: { name: '', surname: '', email: '' },
  mood: '😇',
  inbox: [] as InboxItem[],
  challengeJoinedOn: {} as Record<string, string>,
  prefs: { sounds: true, vacationMode: false },
  appLock: {
    enabled: false,
    condition: 'habit',
    habitId: null,
    until: '18:00',
  } as AppLockPrefs,
  zen: { until: null, useFocusShortcut: false } as ZenPrefs,
  habits: seedHabits,
  challenges: seedChallenges,
  joinedChallengeIds: [] as string[],
  completions: {
    water: { [todayKey()]: 500 },
    meditate: { [todayKey()]: 30 },
  } as CompletionMap,
  statuses: {} as StatusMap,
  moods: {} as Record<string, string>,
  planner: seedPlanner(todayKey(), toDateKey(addDays(new Date(), 1))),
  histories: buildHistories(seedHabits),
  congratsShownOn: null,
  healthConnected: false,
  calendarConnected: false,
  darkMode: false,
  wellbeing: {} as Record<
    string,
    { pickups?: number; socialMin?: number; sleepMinutes?: number }
  >,
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),

      completeOnboarding: () => set({ onboarded: true }),
      setUser: user => set({ user: { ...get().user, ...user } }),
      addHabit: habit =>
        set({
          habits: [...get().habits, habit],
          histories: { ...get().histories, [habit.id]: Array(83).fill(0) },
        }),
      removeHabit: id => set({ habits: get().habits.filter(h => h.id !== id) }),

      updateHabit: (id, patch) =>
        set({
          habits: get().habits.map(h => (h.id === id ? { ...h, ...patch } : h)),
        }),

      setWellbeing: (dateKey, patch) =>
        set({
          wellbeing: {
            ...get().wellbeing,
            [dateKey]: { ...get().wellbeing[dateKey], ...patch },
          },
        }),

      increment: (habitId, dateKey = todayKey()) => {
        const habit = get().habits.find(h => h.id === habitId);
        if (!habit) {
          return;
        }
        const current = get().completions[habitId]?.[dateKey] ?? 0;
        const next = Math.min(habit.goal.amount, current + habit.step);
        get().setCompletion(habitId, next, dateKey);
        get().setStatus(habitId, null, dateKey);
      },

      setCompletion: (habitId, amount, dateKey = todayKey()) =>
        set({
          completions: {
            ...get().completions,
            [habitId]: { ...get().completions[habitId], [dateKey]: amount },
          },
        }),

      toggleCheck: (habitId, dateKey = todayKey()) => {
        const habit = get().habits.find(h => h.id === habitId);
        if (!habit) {
          return;
        }
        const done =
          (get().completions[habitId]?.[dateKey] ?? 0) >= habit.goal.amount;
        get().setCompletion(habitId, done ? 0 : habit.goal.amount, dateKey);
        get().setStatus(habitId, null, dateKey);
      },

      setStatus: (habitId, status, dateKey = todayKey()) => {
        const forHabit = { ...get().statuses[habitId] };
        if (status) {
          forHabit[dateKey] = status;
        } else {
          delete forHabit[dateKey];
        }
        set({ statuses: { ...get().statuses, [habitId]: forHabit } });
      },

      setMood: (emoji, dateKey = todayKey()) =>
        set({ mood: emoji, moods: { ...get().moods, [dateKey]: emoji } }),

      joinChallenge: id =>
        set({
          joinedChallengeIds: [...new Set([...get().joinedChallengeIds, id])],
          challengeJoinedOn: {
            ...get().challengeJoinedOn,
            [id]: get().challengeJoinedOn[id] ?? todayKey(),
          },
        }),

      leaveChallenge: id => {
        const joinedOn = { ...get().challengeJoinedOn };
        delete joinedOn[id];
        set({
          joinedChallengeIds: get().joinedChallengeIds.filter(j => j !== id),
          challengeJoinedOn: joinedOn,
        });
      },

      addInboxItem: item =>
        set({
          inbox: [
            {
              id: `n${Date.now()}-${get().inbox.length}`,
              title: item.title,
              body: item.body,
              at: item.at ?? new Date().toISOString(),
              read: false,
            },
            ...get().inbox,
          ].slice(0, 50),
        }),

      markInboxRead: () =>
        set({ inbox: get().inbox.map(i => ({ ...i, read: true })) }),

      setPref: (key, value) => set({ prefs: { ...get().prefs, [key]: value } }),
      setAppLock: patch => set({ appLock: { ...get().appLock, ...patch } }),
      setZen: patch => set({ zen: { ...get().zen, ...patch } }),

      markCongratsShown: dateKey => set({ congratsShownOn: dateKey }),

      setIntegration: (key, value) => set({ [key]: value } as Partial<State>),

      setDarkMode: on => set({ darkMode: on }),

      importCalendarBlocks: (dateKey, blocks) => {
        const existing = new Set(get().planner.map(t => t.id));
        const fresh = blocks
          .filter(b => !existing.has(`cal-${b.externalId}`))
          .map(b => ({
            id: `cal-${b.externalId}`,
            date: dateKey,
            title: b.title,
            time: b.time,
            type: 'block' as const,
            done: false,
          }));
        if (fresh.length) {
          set({ planner: [...get().planner, ...fresh] });
        }
      },

      addPlannerItem: item =>
        set({ planner: [...get().planner, { ...item, id: `t${Date.now()}` }] }),
      togglePlannerItem: id =>
        set({
          planner: get().planner.map(t =>
            t.id === id ? { ...t, done: !t.done } : t,
          ),
        }),
      movePlannerItem: (id, dateKey) =>
        set({
          planner: get().planner.map(t =>
            t.id === id ? { ...t, date: dateKey } : t,
          ),
        }),
      deletePlannerItem: id =>
        set({ planner: get().planner.filter(t => t.id !== id) }),

      reset: () => set(initial()),
    }),
    {
      name: 'routiner-store',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: () => initial() as unknown as State,
    },
  ),
);

/* ------------------------------ selectors ------------------------------ */

/**
 * Real challenge progress: day of joining counts as day 1, reaching 1
 * after durationDays. 0 when not joined.
 */
export const challengeProgress = (
  joinedOn: string | undefined,
  durationDays: number,
  today = todayKey(),
): number => {
  if (!joinedOn || durationDays <= 0) {
    return 0;
  }
  const days =
    Math.round(
      (new Date(today).getTime() - new Date(joinedOn).getTime()) / 86400000,
    ) + 1;
  return Math.min(1, Math.max(0, days / durationDays));
};

export const trackingOf = (h: Habit) => h.tracking ?? 'count';

export const statusOn = (
  statuses: StatusMap,
  habitId: string,
  dateKey = todayKey(),
) => statuses[habitId]?.[dateKey] ?? null;

/** Progress 0..1 for a habit on a date. */
export const progressFor = (
  completions: CompletionMap,
  habit: Habit,
  dateKey = todayKey(),
): number =>
  Math.min(1, (completions[habit.id]?.[dateKey] ?? 0) / habit.goal.amount);

export const doneOn = (
  completions: CompletionMap,
  statuses: StatusMap,
  habit: Habit,
  dateKey = todayKey(),
) =>
  statusOn(statuses, habit.id, dateKey) === null &&
  progressFor(completions, habit, dateKey) >= 1;

/** Habits counting toward the day (not skipped). */
export const activeOn = (
  statuses: StatusMap,
  habit: Habit,
  dateKey = todayKey(),
) => statusOn(statuses, habit.id, dateKey) !== 'skipped';

/** Count of habits fully completed on a date. */
export const completedCount = (
  completions: CompletionMap,
  habits: Habit[],
  dateKey = todayKey(),
): number =>
  habits.filter(h => progressFor(completions, h, dateKey) >= 1).length;

/** Fraction of habits done on history day i (0 = 83 days ago .. 82 = yesterday). */
export const historyDayFraction = (
  histories: Record<string, number[]>,
  habits: Habit[],
  i: number,
) =>
  habits.length
    ? habits.reduce((a, h) => a + (histories[h.id]?.[i] ?? 0), 0) /
      habits.length
    : 0;

type StreakSlice = {
  histories: Record<string, number[]>;
  habits: Habit[];
  completions: CompletionMap;
  statuses: StatusMap;
  planner: PlannerItem[];
};

/**
 * A perfect day (Duolingo-style streak rules): every active habit done AND
 * every one of today's tasks checked off. Time blocks don't gate the streak.
 */
export const perfectToday = (s: StreakSlice) => {
  const active = s.habits.filter(h => activeOn(s.statuses, h));
  const habitsDone =
    active.length > 0 &&
    active.every(h => doneOn(s.completions, s.statuses, h));
  const tKey = todayKey();
  const tasksDone = s.planner
    .filter(t => t.type === 'task' && t.date === tKey)
    .every(t => t.done);
  return habitsDone && tasksDone;
};

/** Perfect-day streak ending today (today counts once habits + tasks are done). */
export const dayStreak = (s: StreakSlice) => {
  let streak = 0;
  for (let i = 82; i >= 0; i--) {
    if (historyDayFraction(s.histories, s.habits, i) >= 1) {
      streak++;
    } else {
      break;
    }
  }
  return perfectToday(s) ? streak + 1 : streak;
};

export const perfectDayCount = (s: StreakSlice) => {
  let n = 0;
  for (let i = 0; i < 83; i++) {
    if (historyDayFraction(s.histories, s.habits, i) >= 1) {
      n++;
    }
  }
  return perfectToday(s) ? n + 1 : n;
};

/** All-time completions for a habit (history + today). */
export const totalOf = (
  s: {
    histories: Record<string, number[]>;
    completions: CompletionMap;
    statuses: StatusMap;
  },
  habit: Habit,
) =>
  (s.histories[habit.id] ?? []).reduce((a, b) => a + b, 0) +
  (doneOn(s.completions, s.statuses, habit) ? 1 : 0);

/** Per-habit streak (consecutive history days + today). */
export const habitStreak = (
  s: {
    histories: Record<string, number[]>;
    completions: CompletionMap;
    statuses: StatusMap;
  },
  habit: Habit,
) => {
  const h = s.histories[habit.id] ?? [];
  let streak = 0;
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i]) {
      streak++;
    } else {
      break;
    }
  }
  return doneOn(s.completions, s.statuses, habit) ? streak + 1 : streak;
};

/** 30-day completion rate percentage for a habit. */
export const rate30 = (histories: Record<string, number[]>, habit: Habit) => {
  const h = histories[habit.id] ?? [];
  return Math.round((h.slice(-30).reduce((a, b) => a + b, 0) / 30) * 100);
};

/** Points: 1000 + streak*40 + perfectDays*25 + total completions (Ember formula). */
export const karma = (s: StreakSlice) =>
  1000 +
  dayStreak(s) * 40 +
  perfectDayCount(s) * 25 +
  s.habits.reduce((a, h) => a + totalOf(s, h), 0);

/** Natural-language quick-add parser: "Meditate every morning x2". */
export const parseQuickAdd = (text: string) => {
  const out: { name: string; goal: number | null; section: string | null } = {
    name: text,
    goal: null,
    section: null,
  };
  let t = text;
  const xm = t.match(/\bx(\d+)\b/i);
  if (xm) {
    out.goal = +xm[1];
    t = t.replace(xm[0], '');
  }
  const sm = t.match(
    /\b(?:every\s+)?(morning|afternoon|evening|night|anytime)\b/i,
  );
  if (sm) {
    out.section = sm[1][0].toUpperCase() + sm[1].slice(1).toLowerCase();
    t = t.replace(sm[0], '');
  }
  out.name = t.replace(/\s+/g, ' ').trim();
  return out;
};
