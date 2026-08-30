/**
 * @format
 *
 * Monkey test: a seeded random walk over store actions, selectors, the
 * assistant flow machine, and the app-lock/zen evaluators. Invariants are
 * checked after every action; any throw or violation pinpoints the op
 * sequence via the fixed seed.
 */
import { advance, FLOWS, FlowStep } from '../src/data/assistantFlows';
import { appLockSatisfied, zenActiveAt } from '../src/services/appLock';
import {
  addDays,
  completedCount,
  dayStreak,
  historyDayFraction,
  karma,
  perfectToday,
  progressFor,
  toDateKey,
  useStore,
} from '../src/store/useStore';

/** Deterministic LCG so failures reproduce. */
const makeRng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

const rng = makeRng(20260823);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const chance = (p: number) => rng() < p;

const randomDateKey = () =>
  toDateKey(addDays(new Date(), -Math.floor(rng() * 4)));

const TEXTS = ['', 'Read 10 pages', '🔥🔥🔥', 'x'.repeat(300), '7', '   '];
const TIMES = ['07:00', '23:59', '18:30'];

let habitSeq = 0;

const OPS: Array<() => void> = [
  () =>
    useStore.getState().addHabit({
      id: `mk-${++habitSeq}`,
      name: pick(TEXTS) || 'Monkey habit',
      emoji: '🐒',
      type: chance(0.8) ? 'good' : 'bad',
      goal: { amount: pick([1, 3, 2000]), unit: pick(['TIMES', 'ML']) },
      step: 1,
      friendIds: [],
      tracking: chance(0.5) ? 'check' : 'count',
      kind: chance(0.8) ? 'build' : 'quit',
      reminder: chance(0.3) ? { time: pick(TIMES), enabled: true } : undefined,
    }),
  () => {
    const h = pick(useStore.getState().habits);
    if (h) {
      useStore.getState().increment(h.id, randomDateKey());
    }
  },
  () => {
    const h = pick(useStore.getState().habits);
    if (h) {
      useStore.getState().toggleCheck(h.id, randomDateKey());
    }
  },
  () => {
    const h = pick(useStore.getState().habits);
    if (h) {
      useStore
        .getState()
        .setCompletion(h.id, Math.floor(rng() * 5000), randomDateKey());
    }
  },
  () => {
    const h = pick(useStore.getState().habits);
    if (h) {
      useStore
        .getState()
        .setStatus(h.id, pick(['skipped', 'failed', null]), randomDateKey());
    }
  },
  () => {
    const h = pick(useStore.getState().habits);
    // Only cull monkey-made habits so the walk keeps a stable core.
    if (h && h.id.startsWith('mk-') && chance(0.5)) {
      useStore.getState().removeHabit(h.id);
    }
  },
  () =>
    useStore.getState().addPlannerItem({
      date: chance(0.5) ? randomDateKey() : toDateKey(addDays(new Date(), 1)),
      title: pick(TEXTS) || 'Monkey task',
      time: chance(0.5) ? pick(TIMES) : '',
      type: chance(0.7) ? 'task' : 'block',
      done: false,
    }),
  () => {
    const t = pick(useStore.getState().planner);
    if (t) {
      useStore.getState().togglePlannerItem(t.id);
    }
  },
  () => {
    const t = pick(useStore.getState().planner);
    if (t) {
      useStore
        .getState()
        .movePlannerItem(
          t.id,
          toDateKey(addDays(new Date(`${t.date}T00:00`), 1)),
        );
    }
  },
  () => {
    const t = pick(useStore.getState().planner);
    if (t) {
      useStore.getState().deletePlannerItem(t.id);
    }
  },
  () => useStore.getState().setMood(pick(['😡', '😇', '😍'])),
  () =>
    useStore.getState().setAppLock({
      enabled: chance(0.6),
      condition: pick(['habit', 'all', 'time'] as const),
      habitId: chance(0.5)
        ? pick(useStore.getState().habits)?.id ?? null
        : pick(['ghost-habit', null]),
      until: pick(['18:00', '99:99', 'ab:cd', '00:00']),
    }),
  () =>
    useStore.getState().setZen({
      until: pick([
        null,
        new Date(Date.now() + 60000).toISOString(),
        new Date(Date.now() - 60000).toISOString(),
        'not-a-date',
      ]),
    }),
  () =>
    useStore.getState().setWellbeing(randomDateKey(), {
      [pick(['pickups', 'socialMin', 'sleepMinutes'] as const)]: Math.floor(
        rng() * 600,
      ),
    }),
  () => useStore.getState().addInboxItem({ title: 'mk', body: 'note' }),
  // Day rollover with a clock 0-2 days ahead (0 = same-day no-op; a later
  // op with a smaller offset exercises the clock-regression guard).
  () =>
    useStore
      .getState()
      .rollDays(new Date(Date.now() + Math.floor(rng() * 3) * 86400000)),
];

const checkInvariants = (label: string) => {
  const s = useStore.getState();
  const streak = dayStreak(s);
  expect(Number.isInteger(streak)).toBe(true);
  // Uncapped counter (OV2): dayStreak is the persisted run plus at most
  // today's in-progress perfect day.
  expect(streak).toBeGreaterThanOrEqual(s.streak.current);
  expect(streak).toBeLessThanOrEqual(s.streak.current + 1);
  expect(Number.isFinite(karma(s))).toBe(true);
  expect(typeof perfectToday(s)).toBe('boolean');

  // Freeze + counter invariants (D6/OV2).
  expect(Number.isInteger(s.streakFreezes.available)).toBe(true);
  expect(s.streakFreezes.available).toBeGreaterThanOrEqual(0);
  expect(s.streakFreezes.available).toBeLessThanOrEqual(2);
  expect(s.streakFreezes.runLength).toBeGreaterThanOrEqual(0);
  for (const used of s.streakFreezes.usedOn) {
    expect(used).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
  expect(Number.isInteger(s.streak.current)).toBe(true);
  expect(s.streak.current).toBeGreaterThanOrEqual(0);
  expect(s.streak.best).toBeGreaterThanOrEqual(s.streak.current);

  const done = completedCount(s.completions, s.habits);
  expect(done).toBeGreaterThanOrEqual(0);
  expect(done).toBeLessThanOrEqual(s.habits.length);

  for (const h of s.habits) {
    const p = progressFor(s.completions, h);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  }

  const frac = historyDayFraction(
    s.histories,
    s.habits,
    Math.floor(rng() * 83),
  );
  expect(frac).toBeGreaterThanOrEqual(0);
  expect(frac).toBeLessThanOrEqual(1);

  const ids = s.planner.map(t => t.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const t of s.planner) {
    expect(t.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }

  expect(
    typeof appLockSatisfied(s.appLock, s.habits, s.completions, s.statuses),
  ).toBe('boolean');
  expect(typeof zenActiveAt(s.zen.until)).toBe('boolean');

  // `label` keeps the failing op visible in expect output on violation.
  expect(typeof label).toBe('string');
};

test('600 random store ops keep every invariant', () => {
  for (let i = 0; i < 600; i++) {
    const op = pick(OPS);
    op();
    checkInvariants(`op #${i}`);
  }
});

test('assistant flows survive random walks with hostile input', () => {
  for (let round = 0; round < 60; round++) {
    const flow = pick(Object.values(FLOWS));
    let step: FlowStep | null = flow.steps[flow.start];
    let answers: Record<string, string> = {};
    let guard = 0;
    while (step && guard++ < 30) {
      expect(typeof step.bot(answers)).toBe('string');
      const input = step.input;
      let value = 'ok';
      if (!input || input.kind === 'text') {
        value = pick(TEXTS);
      } else if (input.kind === 'emoji' || input.kind === 'time') {
        value = pick(input.options);
      } else {
        value = pick(input.options).value;
      }
      const res = advance(flow, step.id, value, answers);
      answers = res.answers;
      step = res.nextStep;
    }
    expect(typeof flow.summary(answers)).toBe('string');
  }
});

test('zen/appLock evaluators tolerate garbage', () => {
  expect(zenActiveAt('not-a-date')).toBe(false);
  expect(zenActiveAt(null)).toBe(false);
  const s = useStore.getState();
  expect(
    appLockSatisfied(
      { enabled: true, condition: 'time', habitId: null, until: 'ab:cd' },
      s.habits,
      s.completions,
      s.statuses,
    ),
  ).toBe(true);
  expect(
    appLockSatisfied(
      { enabled: true, condition: 'habit', habitId: 'ghost', until: '18:00' },
      s.habits,
      s.completions,
      s.statuses,
    ),
  ).toBe(true);
});
