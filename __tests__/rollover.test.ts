/**
 * @format
 *
 * Lane-A store hardening: v3 migration, corrupt-snapshot capture, day
 * rollover with the persisted streak counter and freeze rules (D6), and
 * the E2 canonical-selector parity guarantee.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '../src/data/seed';
import {
  addDays,
  CORRUPT_DUMP_KEY,
  dayPerfect,
  dayStreak,
  migrateStore,
  perfectToday,
  storageBackend,
  toDateKey,
  useStore,
} from '../src/store/useStore';

const check: Habit = {
  id: 'a',
  name: 'Check habit',
  emoji: '✅',
  type: 'good',
  goal: { amount: 1, unit: 'TIMES' },
  step: 1,
  friendIds: [],
  tracking: 'check',
  kind: 'build',
};
const count: Habit = {
  id: 'b',
  name: 'Count habit',
  emoji: '💧',
  type: 'good',
  goal: { amount: 1000, unit: 'ML' },
  step: 500,
  friendIds: [],
  tracking: 'count',
  kind: 'build',
};

const NOW = new Date('2026-08-30T10:00:00');

const key = (daysAgo: number, from: Date = NOW) =>
  toDateKey(addDays(from, -daysAgo));

/** Deterministic base state; every test overrides what it cares about. */
const seedState = (over: Record<string, unknown> = {}) =>
  useStore.setState({
    habits: [check, count],
    completions: {},
    statuses: {},
    planner: [],
    histories: { a: Array(83).fill(0), b: Array(83).fill(0) },
    streakFreezes: { available: 0, usedOn: [], runLength: 0 },
    streak: { current: 0, best: 0 },
    lastRolledDay: key(1),
    historyReconciled: true,
    prefs: { sounds: true, vacationMode: false },
    ...over,
  } as never);

/** Completions marking both habits complete for the given past days. */
const perfectOn = (daysAgo: number[]) => {
  const completions: Record<string, Record<string, number>> = { a: {}, b: {} };
  for (const d of daysAgo) {
    completions.a[key(d)] = 1;
    completions.b[key(d)] = 1000;
  }
  return completions;
};

describe('migrateStore', () => {
  test('v2 snapshot gains v3 fields and loses nothing', () => {
    const v2 = {
      habits: [check],
      completions: { a: { '2026-08-20': 1 } },
      darkMode: true,
      prefs: { sounds: false, vacationMode: true },
    };
    const out = migrateStore(v2, 2) as Record<string, unknown>;
    expect(out.completions).toEqual(v2.completions);
    expect(out.darkMode).toBe(true);
    // v4 adds the permission-owning prefs, ON for existing installs.
    expect(out.prefs).toEqual({
      ...v2.prefs,
      recap: true,
      weather: true,
      locationDenied: false,
      recapNudgeDismissed: false,
      weatherNudgeDismissed: false,
    });
    expect(out.planner).toEqual([]);
    expect(out.streakFreezes).toEqual({
      available: 0,
      usedOn: [],
      runLength: 0,
    });
    expect(out.streak).toEqual({ current: 0, best: 0 });
    expect(out.historyReconciled).toBe(false);
    expect(typeof out.lastRolledDay).toBe('string');
  });

  test('v3 → v4 drops only the seeded demo planner items (id-only)', () => {
    const v3 = {
      streak: { current: 9, best: 12 },
      historyReconciled: true,
      prefs: { sounds: true, vacationMode: false },
      planner: [
        { id: 't1', date: '2026-08-20', title: 'Team standup', type: 'block' },
        {
          id: 't2',
          date: '2026-08-20',
          title: 'Review PR feedback',
          type: 'task',
        },
        {
          id: 't1756600000000-3',
          date: '2026-08-30',
          title: 'Real task',
          type: 'task',
        },
        { id: 'cal-abc', date: '2026-08-30', title: 'Standup', type: 'block' },
        { id: 't4', date: '2026-08-21', title: 'Update resume', type: 'task' },
      ],
    };
    const out = migrateStore(v3, 3) as Record<string, unknown>;
    expect((out.planner as { id: string }[]).map(t => t.id)).toEqual([
      't1756600000000-3',
      'cal-abc',
    ]);
    expect(out.prefs).toEqual({
      sounds: true,
      vacationMode: false,
      recap: true,
      weather: true,
      locationDenied: false,
      recapNudgeDismissed: false,
      weatherNudgeDismissed: false,
    });
    expect(out.streak).toEqual({ current: 9, best: 12 });
  });

  test('v4 passthrough is untouched', () => {
    const v4 = {
      streak: { current: 9, best: 12 },
      historyReconciled: true,
      prefs: { sounds: true, vacationMode: false, recap: false, weather: true },
      planner: [{ id: 't1', title: 'user item that happens to be t1' }],
    };
    expect(migrateStore(v4, 4)).toEqual(v4);
  });

  test('never returns initial() — user fields survive any version', () => {
    const out = migrateStore({ user: { name: 'Aj' } }, 0) as never as {
      user: { name: string };
    };
    expect(out.user.name).toBe('Aj');
  });
});

describe('storageBackend (corrupt capture + loud writes)', () => {
  beforeEach(() => AsyncStorage.clear());

  test('valid JSON passes through', async () => {
    await AsyncStorage.setItem('k', '{"ok":1}');
    expect(await storageBackend.getItem('k')).toBe('{"ok":1}');
  });

  test('corrupt payload dumped to single slot, null returned', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await AsyncStorage.setItem('k', '{broken');
    expect(await storageBackend.getItem('k')).toBeNull();
    expect(await AsyncStorage.getItem(CORRUPT_DUMP_KEY)).toBe('{broken');
    // single-slot: a second corruption overwrites, never grows (E4)
    await AsyncStorage.setItem('k', '{worse');
    await storageBackend.getItem('k');
    expect(await AsyncStorage.getItem(CORRUPT_DUMP_KEY)).toBe('{worse');
    spy.mockRestore();
  });

  test('setItem failure is caught and logged, not thrown', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('quota'),
    );
    await expect(storageBackend.setItem('k', 'v')).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('rollDays', () => {
  test('no elapsed days → no-op; clock regression → no-op', () => {
    seedState({ streak: { current: 5, best: 5 } });
    useStore.getState().rollDays(NOW);
    expect(useStore.getState().streak.current).toBe(5);
    // simulated clock set BACK: lastRolledDay is "today"
    seedState({ streak: { current: 5, best: 5 }, lastRolledDay: key(0) });
    useStore.getState().rollDays(NOW);
    expect(useStore.getState().streak.current).toBe(5);
    expect(useStore.getState().lastRolledDay).toBe(key(0));
  });

  test('a perfect yesterday increments the counter and histories', () => {
    seedState({ completions: perfectOn([1]), lastRolledDay: key(2) });
    useStore.getState().rollDays(NOW);
    const s = useStore.getState();
    expect(s.streak).toEqual({ current: 1, best: 1 });
    expect(s.streakFreezes.runLength).toBe(1);
    expect(s.histories.a[82]).toBe(1);
    expect(s.histories.b[82]).toBe(1);
    expect(s.lastRolledDay).toBe(key(1));
  });

  test('missed day without a freeze resets the counter', () => {
    seedState({ streak: { current: 40, best: 40 }, lastRolledDay: key(2) });
    useStore.getState().rollDays(NOW);
    expect(useStore.getState().streak).toEqual({ current: 0, best: 40 });
  });

  test('missed day consumes a freeze before resetting (D6)', () => {
    seedState({
      streak: { current: 40, best: 40 },
      streakFreezes: { available: 1, usedOn: [], runLength: 3 },
      lastRolledDay: key(2),
    });
    useStore.getState().rollDays(NOW);
    const s = useStore.getState();
    expect(s.streak.current).toBe(40);
    expect(s.streakFreezes.available).toBe(0);
    expect(s.streakFreezes.usedOn).toEqual([key(1)]);
    expect(s.streakFreezes.runLength).toBe(0);
  });

  test('two missed days with one freeze = reset (D6)', () => {
    seedState({
      streak: { current: 40, best: 40 },
      streakFreezes: { available: 1, usedOn: [], runLength: 0 },
      lastRolledDay: key(3),
    });
    useStore.getState().rollDays(NOW);
    const s = useStore.getState();
    expect(s.streak.current).toBe(0);
    expect(s.streakFreezes.available).toBe(0);
  });

  test('7 consecutive perfect days earn a freeze, capped at 2', () => {
    seedState({
      completions: perfectOn([1, 2, 3, 4, 5, 6, 7]),
      lastRolledDay: key(8),
    });
    useStore.getState().rollDays(NOW);
    const s = useStore.getState();
    expect(s.streak.current).toBe(7);
    expect(s.streakFreezes.available).toBe(1);
    expect(s.streakFreezes.runLength).toBe(0); // spent on the earn

    // 21 perfect days from a fresh seed would earn 3 → capped at 2
    seedState({
      completions: perfectOn(Array.from({ length: 21 }, (_, i) => i + 1)),
      lastRolledDay: key(22),
    });
    useStore.getState().rollDays(NOW);
    expect(useStore.getState().streakFreezes.available).toBe(2);
  });

  test('vacation days neither break, consume, nor accrue', () => {
    seedState({
      streak: { current: 10, best: 10 },
      streakFreezes: { available: 1, usedOn: [], runLength: 6 },
      prefs: { sounds: true, vacationMode: true },
      lastRolledDay: key(4),
    });
    useStore.getState().rollDays(NOW);
    const s = useStore.getState();
    expect(s.streak.current).toBe(10);
    expect(s.streakFreezes).toEqual({ available: 1, usedOn: [], runLength: 6 });
    expect(s.lastRolledDay).toBe(key(1));
  });

  test('multi-day offline gap rolls each day, one batched set', () => {
    // 5 elapsed days: 5,4 perfect; 3 missed (freeze); 2 missed (reset); 1 perfect
    seedState({
      completions: perfectOn([5, 4, 1]),
      streakFreezes: { available: 1, usedOn: [], runLength: 0 },
      lastRolledDay: key(6),
    });
    useStore.getState().rollDays(NOW);
    const s = useStore.getState();
    expect(s.streak.current).toBe(1);
    expect(s.streak.best).toBe(2);
    expect(s.streakFreezes.available).toBe(0);
    expect(s.streakFreezes.usedOn).toEqual([key(3)]);
    expect(s.histories.a[82]).toBe(1); // yesterday, perfect
    expect(s.histories.a[81]).toBe(0); // 2 days ago, missed
  });

  test('upgrade reconciliation zeroes synthetic days, seeds real run', () => {
    seedState({
      completions: perfectOn([1, 2]),
      histories: { a: Array(83).fill(1), b: Array(83).fill(1) }, // synthetic
      streak: { current: 0, best: 0 },
      historyReconciled: false,
      lastRolledDay: key(1),
    });
    useStore.getState().rollDays(NOW);
    const s = useStore.getState();
    expect(s.historyReconciled).toBe(true);
    expect(s.streak.current).toBe(2); // real run only
    expect(s.histories.a[82]).toBe(1); // yesterday real
    expect(s.histories.a[70]).toBe(0); // synthetic day zeroed
    expect(s.streakFreezes.runLength).toBe(0); // no retroactive accrual
  });
});

describe('E2 canonical selectors', () => {
  test('perfectToday === dayPerfect(today), tasks included', () => {
    const today = toDateKey(new Date());
    seedState({
      completions: { a: { [today]: 1 }, b: { [today]: 1000 } },
      planner: [
        {
          id: 't1',
          date: today,
          title: 'Task',
          time: '',
          type: 'task',
          done: false,
        },
      ],
    });
    const s = useStore.getState();
    expect(perfectToday(s)).toBe(false); // habits done, task not
    expect(dayPerfect(s, today)).toBe(false);
    useStore.getState().togglePlannerItem('t1');
    const s2 = useStore.getState();
    expect(perfectToday(s2)).toBe(true);
    expect(dayPerfect(s2, today)).toBe(perfectToday(s2));
  });

  test('dayStreak = persisted counter + today-once-perfect (uncapped)', () => {
    seedState({ streak: { current: 200, best: 200 } });
    expect(dayStreak(useStore.getState())).toBe(200);
    const today = toDateKey(new Date());
    useStore.setState({
      completions: { a: { [today]: 1 }, b: { [today]: 1000 } },
    } as never);
    expect(dayStreak(useStore.getState())).toBe(201);
  });
});
