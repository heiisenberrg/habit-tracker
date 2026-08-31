/**
 * @format
 */
import { challengeProgress, karma, useStore } from '../src/store/useStore';

test('challengeProgress is 0 before joining and grows daily to 1', () => {
  expect(challengeProgress(undefined, 7, '2026-08-22')).toBe(0);
  expect(challengeProgress('2026-08-22', 7, '2026-08-22')).toBeCloseTo(1 / 7);
  expect(challengeProgress('2026-08-22', 7, '2026-08-25')).toBeCloseTo(4 / 7);
  expect(challengeProgress('2026-08-01', 7, '2026-08-22')).toBe(1);
});

test('inbox items accumulate newest-first and mark read', () => {
  useStore.getState().addInboxItem({ title: 'A', body: 'first' });
  useStore.getState().addInboxItem({ title: 'B', body: 'second' });
  const inbox = useStore.getState().inbox;
  expect(inbox[0].title).toBe('B');
  expect(inbox[1].title).toBe('A');
  expect(inbox.every(i => !i.read)).toBe(true);

  useStore.getState().markInboxRead();
  expect(useStore.getState().inbox.every(i => i.read)).toBe(true);
});

test('joinChallenge records the join date and leaveChallenge clears it', () => {
  useStore.getState().joinChallenge('runners');
  expect(useStore.getState().joinedChallengeIds).toContain('runners');
  expect(useStore.getState().challengeJoinedOn.runners).toBeTruthy();

  useStore.getState().leaveChallenge('runners');
  expect(useStore.getState().joinedChallengeIds).not.toContain('runners');
  expect(useStore.getState().challengeJoinedOn.runners).toBeUndefined();
});

test('setPref persists preferences; permission-owning toggles start OFF', () => {
  expect(useStore.getState().prefs).toEqual({
    sounds: true,
    vacationMode: false,
    recap: false,
    weather: false,
  });
  useStore.getState().setPref('vacationMode', true);
  expect(useStore.getState().prefs.vacationMode).toBe(true);
  useStore.getState().setPref('vacationMode', false);
});

describe('fresh-install honesty (10A, extended 2026-08-31)', () => {
  test('a new store has no habits, no planner items, no histories, 0 points', () => {
    useStore.getState().reset();
    const s = useStore.getState();
    expect(s.habits).toEqual([]);
    expect(s.planner).toEqual([]);
    expect(s.histories).toEqual({});
    expect(s.completions).toEqual({});
    expect(karma(s)).toBe(0);
  });

  test('reset wipes user-added habits and tasks back to the honest empty state', () => {
    useStore.getState().addHabit({
      id: 'x',
      name: 'Stretch',
      emoji: '🤸',
      type: 'good',
      goal: { amount: 3, unit: 'TIMES' },
      step: 1,
      friendIds: [],
      tracking: 'count',
      kind: 'build',
    });
    useStore.getState().addPlannerItem({
      date: '2026-08-31',
      title: 'Real task',
      time: '',
      type: 'task',
      done: false,
    });
    expect(useStore.getState().habits).toHaveLength(1);
    expect(useStore.getState().planner).toHaveLength(1);
    useStore.getState().reset();
    expect(useStore.getState().habits).toEqual([]);
    expect(useStore.getState().planner).toEqual([]);
  });
});
