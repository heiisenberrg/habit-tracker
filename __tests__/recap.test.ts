/**
 * @format
 *
 * E3 suites: the evening-recap content builder (all suppression/content
 * variants) and notification action semantics (check vs count × actions).
 */
import {
  actionsForHabit,
  applyReminderAction,
} from '../src/services/notifications';
import { buildRecap } from '../src/services/recap';
import { Habit } from '../src/data/seed';
import { todayKey, useStore } from '../src/store/useStore';

const check: Habit = {
  id: 'c1',
  name: 'Stretch',
  emoji: '🤸',
  type: 'good',
  goal: { amount: 1, unit: 'TIMES' },
  step: 1,
  friendIds: [],
  tracking: 'check',
  kind: 'build',
};
const water: Habit = {
  id: 'w1',
  name: 'Water',
  emoji: '💧',
  type: 'good',
  goal: { amount: 2000, unit: 'ML' },
  step: 500,
  friendIds: [],
  tracking: 'count',
  kind: 'build',
};

const NOON = new Date('2026-08-30T12:00:00');

const base = (over: Record<string, unknown> = {}) =>
  ({
    habits: [check, water],
    completions: {},
    statuses: {},
    planner: [],
    prefs: { sounds: true, vacationMode: false },
    zen: { until: null, useFocusShortcut: false },
    appLock: {
      enabled: false,
      condition: 'habit',
      habitId: null,
      until: '18:00',
    },
    ...over,
  } as never);

describe('buildRecap (D9 content builder)', () => {
  test('names the single remaining habit', () => {
    const s = base({ completions: { w1: { [todayKey()]: 2000 } } });
    const recap = buildRecap(s, NOON);
    expect(recap?.body).toContain('“Stretch” to go');
  });

  test('counts habits + open tasks', () => {
    const s = base({
      planner: [
        {
          id: 't',
          date: todayKey(),
          title: 'x',
          time: '',
          type: 'task',
          done: false,
        },
      ],
    });
    const recap = buildRecap(s, NOON);
    expect(recap?.body).toContain('2 habits to go');
    expect(recap?.body).toContain('1 task open');
  });

  test('mentions the lock when App Lock holds apps hostage', () => {
    const s = base({
      appLock: {
        enabled: true,
        condition: 'habit',
        habitId: 'c1',
        until: '18:00',
      },
    });
    expect(buildRecap(s, NOON)?.body).toContain('apps stay locked');
  });

  test('suppressed on perfect day / vacation / covering zen / no habits', () => {
    const done = {
      c1: { [todayKey()]: 1 },
      w1: { [todayKey()]: 2000 },
    };
    expect(buildRecap(base({ completions: done }), NOON)).toBeNull();
    expect(
      buildRecap(base({ prefs: { sounds: true, vacationMode: true } }), NOON),
    ).toBeNull();
    const zenPast21 = new Date('2026-08-30T21:30:00').toISOString();
    expect(
      buildRecap(
        base({ zen: { until: zenPast21, useFocusShortcut: false } }),
        NOON,
      ),
    ).toBeNull();
    expect(buildRecap(base({ habits: [] }), NOON)).toBeNull();
  });
});

describe('notification action semantics (C4 + eng OV)', () => {
  beforeEach(() =>
    useStore.setState({
      habits: [check, water],
      completions: {},
      statuses: {},
    } as never),
  );

  test('action sets differ by tracking kind', () => {
    expect(
      actionsForHabit({ tracking: 'check', step: 1, unit: 'TIMES' }),
    ).toEqual([{ id: 'done', title: '✅ Mark done' }]);
    const countActions = actionsForHabit({
      tracking: 'count',
      step: 500,
      unit: 'ML',
    });
    expect(countActions.map(a => a.id)).toEqual(['step', 'complete']);
    expect(countActions[0].title).toContain('500 ML');
  });

  test('"done" completes a check habit', () => {
    const r = applyReminderAction('c1', 'done');
    expect(r).toEqual({ applied: true, rePost: false });
    expect(useStore.getState().completions.c1[todayKey()]).toBe(1);
  });

  test('"+step" increments and asks for a re-post until goal', () => {
    expect(applyReminderAction('w1', 'step')).toEqual({
      applied: true,
      rePost: true,
    });
    expect(useStore.getState().completions.w1[todayKey()]).toBe(500);
    applyReminderAction('w1', 'step');
    applyReminderAction('w1', 'step');
    // 4th step reaches 2000 — no more re-posts
    expect(applyReminderAction('w1', 'step')).toEqual({
      applied: true,
      rePost: false,
    });
    expect(useStore.getState().completions.w1[todayKey()]).toBe(2000);
  });

  test('"complete" jumps a count habit to goal; ghosts no-op', () => {
    expect(applyReminderAction('w1', 'complete')).toEqual({
      applied: true,
      rePost: false,
    });
    expect(useStore.getState().completions.w1[todayKey()]).toBe(2000);
    expect(applyReminderAction('ghost', 'done')).toEqual({
      applied: false,
      rePost: false,
    });
  });
});
