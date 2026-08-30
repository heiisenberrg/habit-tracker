import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  Challenge,
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

/** Duolingo-style streak insurance. Earned 1 per 7 consecutive perfect
 *  days (cap 2); a missed day consumes one at rollover before the streak
 *  resets. `runLength` is the live consecutive-perfect counter. */
export type StreakFreezes = {
  available: number;
  usedOn: string[];
  runLength: number;
};

/** Persisted perfect-day streak, maintained ONLY by rollDays (no 84-day
 *  cap — histories are chart data, this is the source of truth). */
export type StreakCounter = { current: number; best: number };

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
  /** per-habit day fractions 0..1, oldest first, 83 slots; written ONLY by
   *  rollDays (index 82 = yesterday). Chart data — never the streak source. */
  histories: Record<string, number[]>;
  streakFreezes: StreakFreezes;
  streak: StreakCounter;
  /** dateKey of the last fully-rolled day; rollDays iterates every elapsed
   *  day after it (calendar dateKeys, never ms math — DST-safe). */
  lastRolledDay: string;
  /** one-time upgrade reconciliation latch (10A: synthetic days zeroed) */
  historyReconciled: boolean;
  /** roll every ended day into histories/counter/freezes in ONE set(). */
  rollDays: (now?: Date) => void;
  /** backup import: replaces persisted DATA fields explicitly — never
   *  setState(x, true), which would strip every action (eng OV #2). */
  importState: (data: Record<string, unknown>) => void;
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

/** 10A seed honesty: fresh installs start with EMPTY history — no
 *  synthetic data props up the streak and Reset can never satisfy App Lock. */
const zeroHistories = (habits: Habit[]): Record<string, number[]> =>
  Object.fromEntries(habits.map(h => [h.id, Array(83).fill(0)]));

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
  completions: {} as CompletionMap,
  statuses: {} as StatusMap,
  moods: {} as Record<string, string>,
  planner: seedPlanner(todayKey(), toDateKey(addDays(new Date(), 1))),
  histories: zeroHistories(seedHabits),
  streakFreezes: { available: 0, usedOn: [], runLength: 0 } as StreakFreezes,
  streak: { current: 0, best: 0 } as StreakCounter,
  lastRolledDay: toDateKey(addDays(new Date(), -1)),
  historyReconciled: true,
  congratsShownOn: null,
  healthConnected: false,
  calendarConnected: false,
  darkMode: false,
  wellbeing: {} as Record<
    string,
    { pickups?: number; socialMin?: number; sleepMinutes?: number }
  >,
});

/** Single-slot corrupt-snapshot dump (E4: overwrite in place, never grow). */
export const CORRUPT_DUMP_KEY = 'routiner-corrupt-dump';

/** Disambiguates planner ids minted within the same millisecond. */
let plannerSeq = 0;

/** The persisted DATA fields (no actions) — the export/import contract. */
export const DATA_KEYS = [
  'onboarded',
  'user',
  'mood',
  'habits',
  'challenges',
  'joinedChallengeIds',
  'completions',
  'statuses',
  'moods',
  'planner',
  'histories',
  'congratsShownOn',
  'healthConnected',
  'calendarConnected',
  'darkMode',
  'wellbeing',
  'challengeJoinedOn',
  'inbox',
  'prefs',
  'appLock',
  'zen',
  'streakFreezes',
  'streak',
  'lastRolledDay',
  'historyReconciled',
] as const;

/**
 * Storage wrapper (eng outside-voice corrections 1-3):
 * - getItem parse-checks the raw snapshot itself; a corrupt payload is
 *   captured to CORRUPT_DUMP_KEY and null is returned, so zustand hydrates
 *   defaults and hydration SUCCEEDS — onFinishHydration always fires.
 * - setItem catches write failures loudly (persist discards rejections).
 */
export const storageBackend = {
  getItem: async (name: string): Promise<string | null> => {
    const raw = await AsyncStorage.getItem(name);
    if (raw == null) {
      return null;
    }
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      try {
        await AsyncStorage.setItem(CORRUPT_DUMP_KEY, raw);
      } catch {
        // dump write failed too — nothing more we can do silently-safely
      }
      console.error(
        `[store] corrupt snapshot captured to ${CORRUPT_DUMP_KEY}; hydrating defaults`,
      );
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch (e) {
      console.error('[store] persist write FAILED (quota?):', e);
    }
  },
  removeItem: (name: string) => AsyncStorage.removeItem(name),
};

const routinerStorage = createJSONStorage(() => storageBackend);

/**
 * Versioned migrations — NEVER returns initial(); a version bump must never
 * wipe data. v3 adds the rollover/freeze/counter bookkeeping with frozen
 * defaults; missing older fields fall back via zustand's shallow merge.
 */
export const migrateStore = (persisted: unknown, version: number) => {
  const s = (persisted ?? {}) as Record<string, unknown>;
  if (version < 3) {
    return {
      ...s,
      streakFreezes: { available: 0, usedOn: [], runLength: 0 },
      streak: { current: 0, best: 0 },
      lastRolledDay: todayKey(),
      historyReconciled: false,
    };
  }
  return s;
};

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
        set({
          planner: [
            ...get().planner,
            // Date.now() alone collides when two adds land in the same
            // millisecond (monkey-test finding); the sequence disambiguates.
            { ...item, id: `t${Date.now()}-${plannerSeq++}` },
          ],
        }),
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

      /*
       * Day rollover — the ONLY writer of histories/streak/freezes.
       *
       *   lastRolledDay ──▶ day+1 ──▶ ... ──▶ yesterday     (today never rolls)
       *        │  per day: fraction → histories (shift left, append)
       *        │           perfect(habits+tasks) → counter/freezes:
       *        │             vacation? no-op
       *        │             perfect? current++, runLength++ (7 ⇒ +1 freeze, cap 2)
       *        │             missed?  freeze available? consume : current = 0
       *        └─ ONE set() commits everything (batched — no per-day writes)
       */
      rollDays: (now = new Date()) => {
        const s = get();
        const today = toDateKey(now);
        const yesterday = toDateKey(addDays(now, -1));
        // Clock regression (westward travel / manual change): never roll
        // backwards, never double-roll.
        if (s.lastRolledDay >= yesterday && s.historyReconciled) {
          return;
        }

        let histories = s.histories;
        let freezes = { ...s.streakFreezes, usedOn: [...s.streakFreezes.usedOn] };
        let counter = { ...s.streak };
        let reconciled = s.historyReconciled;

        const daySlice = {
          completions: s.completions,
          statuses: s.statuses,
          habits: s.habits,
          planner: s.planner,
        };

        if (!reconciled) {
          // One-time upgrade honesty pass (10A): rebuild all 83 slots from
          // real data; days without data become zero (synthetic days die).
          const rebuilt: Record<string, number[]> = {};
          for (const h of s.habits) {
            rebuilt[h.id] = Array.from({ length: 83 }, (_, i) =>
              progressFor(s.completions, h, toDateKey(addDays(now, i - 83))),
            );
          }
          histories = rebuilt;
          // Seed the counter from the real consecutive perfect run ending
          // yesterday; runLength starts 0 (no retroactive freeze accrual).
          let run = 0;
          for (let back = 1; back <= 83; back++) {
            if (dayPerfect(daySlice, toDateKey(addDays(now, -back)))) {
              run++;
            } else {
              break;
            }
          }
          counter = { current: run, best: Math.max(s.streak.best, run) };
          freezes = { ...freezes, runLength: 0 };
          reconciled = true;
        } else {
          // Roll every fully-ended day after lastRolledDay (capped at 83,
          // the histories window size) — calendar dateKeys, no ms math.
          let cursor = new Date(`${s.lastRolledDay}T00:00`);
          let guard = 0;
          while (guard++ < 83) {
            cursor = addDays(cursor, 1);
            const key = toDateKey(cursor);
            if (key >= today) {
              break;
            }
            const next: Record<string, number[]> = {};
            for (const h of s.habits) {
              next[h.id] = [
                ...(histories[h.id] ?? Array(83).fill(0)).slice(1),
                progressFor(s.completions, h, key),
              ];
            }
            histories = next;
            if (s.prefs.vacationMode) {
              continue; // vacation: no break, no consume, no accrual
            }
            if (dayPerfect(daySlice, key)) {
              counter.current += 1;
              counter.best = Math.max(counter.best, counter.current);
              freezes.runLength += 1;
              if (freezes.runLength >= 7 && freezes.available < 2) {
                freezes.available += 1;
                freezes.runLength = 0;
              }
            } else if (freezes.available > 0) {
              freezes.available -= 1;
              freezes.usedOn.push(key);
              freezes.runLength = 0;
            } else {
              counter.current = 0;
              freezes.runLength = 0;
            }
          }
        }

        set({
          histories,
          streakFreezes: freezes,
          streak: counter,
          lastRolledDay: yesterday,
          historyReconciled: reconciled,
        });
      },

      importState: data => {
        const patch: Record<string, unknown> = {};
        for (const k of DATA_KEYS) {
          if (k in data) {
            patch[k] = data[k];
          }
        }
        set(patch as Partial<State>);
      },

      reset: () => set(initial()),
    }),
    {
      name: 'routiner-store',
      version: 3,
      storage: routinerStorage,
      migrate: migrateStore as (p: unknown, v: number) => State,
    },
  ),
);

/**
 * Hydration gate (eng OV #1): hasHydrated() FIRST — onFinishHydration only
 * fires for future hydrations, and with the getItem wrapper hydration always
 * succeeds (corrupt stores hydrate defaults), so this can never deadlock.
 */
export const whenHydrated = async (): Promise<void> => {
  const p = useStore.persist;
  if (p.hasHydrated()) {
    return;
  }
  await new Promise<void>(resolve => {
    const unsub = p.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
};

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

type DaySlice = {
  completions: CompletionMap;
  statuses: StatusMap;
  habits: Habit[];
  planner: PlannerItem[];
};

type StreakSlice = DaySlice & {
  histories: Record<string, number[]>;
  streak: StreakCounter;
};

/**
 * CANONICAL day completeness (E2): average habit fraction 0..1 for a date.
 * The one definition charts, banners, and rollover all share.
 */
export const dayCompletion = (s: DaySlice, dateKey = todayKey()): number => {
  const active = s.habits.filter(h => activeOn(s.statuses, h, dateKey));
  if (!active.length) {
    return 0;
  }
  return (
    active.reduce((a, h) => a + progressFor(s.completions, h, dateKey), 0) /
    active.length
  );
};

/**
 * CANONICAL day perfection (E2): every active habit done AND every task of
 * that date checked off — the original "streaks count habits AND tasks"
 * rule. Time blocks don't gate. Rollover feeds the counter from THIS.
 */
export const dayPerfect = (s: DaySlice, dateKey = todayKey()): boolean => {
  const active = s.habits.filter(h => activeOn(s.statuses, h, dateKey));
  const habitsDone =
    active.length > 0 &&
    active.every(h => doneOn(s.completions, s.statuses, h, dateKey));
  const tasksDone = s.planner
    .filter(t => t.type === 'task' && t.date === dateKey)
    .every(t => t.done);
  return habitsDone && tasksDone;
};

/** A perfect day today — delegates to the canonical selector. */
export const perfectToday = (s: DaySlice) => dayPerfect(s, todayKey());

/**
 * Perfect-day streak ending today: the persisted counter (rollDays-owned,
 * uncapped) plus today once it turns perfect.
 */
export const dayStreak = (s: StreakSlice) =>
  s.streak.current + (perfectToday(s) ? 1 : 0);

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
  // histories hold 0..1 fractions — a day counts only when fully done (≥1)
  (s.histories[habit.id] ?? []).reduce((a, b) => a + (b >= 1 ? 1 : 0), 0) +
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
    if (h[i] >= 1) {
      // fractions: 0.5 must NOT extend a streak
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
  return Math.round(
    (h.slice(-30).reduce((a, b) => a + (b >= 1 ? 1 : 0), 0) / 30) * 100,
  );
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
