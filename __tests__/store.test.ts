/**
 * @format
 */
import { challengeProgress, useStore } from '../src/store/useStore';

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

test('setPref persists sound and vacation preferences', () => {
  expect(useStore.getState().prefs).toEqual({
    sounds: true,
    vacationMode: false,
  });
  useStore.getState().setPref('vacationMode', true);
  expect(useStore.getState().prefs.vacationMode).toBe(true);
  useStore.getState().setPref('vacationMode', false);
});
