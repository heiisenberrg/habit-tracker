/**
 * @format
 *
 * Backup round-trip (4A/8A): export → parse → apply → deep-equal on every
 * persisted DATA field; hostile inputs are rejected with named reasons.
 */
import {
  applyBackup,
  exportPayload,
  parseBackup,
} from '../src/services/backup';
import { DATA_KEYS, useStore } from '../src/store/useStore';

test('export → import round-trips every persisted field', async () => {
  useStore.getState().addHabit({
    id: 'rt',
    name: 'Round trip',
    emoji: '🔁',
    type: 'good',
    goal: { amount: 3, unit: 'TIMES' },
    step: 1,
    friendIds: [],
    tracking: 'count',
    kind: 'build',
  });
  useStore.getState().increment('rt');
  useStore.getState().setZen({ until: '2026-08-30T21:30:00.000Z' });
  const before = exportPayload();

  // wreck the live store, then restore
  useStore.getState().reset();
  const parsed = parseBackup(JSON.stringify(before));
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    await applyBackup(parsed.state);
  }

  const after = exportPayload();
  for (const k of DATA_KEYS) {
    expect(after.state[k]).toEqual(before.state[k]);
  }
});

test('old-version backups run through migrate steps', () => {
  const v2 = JSON.stringify({
    version: 2,
    exportedAt: 'x',
    state: { habits: [], completions: { a: { '2026-08-01': 1 } } },
  });
  const parsed = parseBackup(v2);
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(parsed.state.streak).toEqual({ current: 0, best: 0 });
    expect(parsed.state.completions).toEqual({ a: { '2026-08-01': 1 } });
  }
});

test('hostile inputs are rejected with named reasons', () => {
  expect(parseBackup('not json')).toEqual({
    ok: false,
    error: 'Not valid JSON.',
  });
  expect(parseBackup('{"version":3}')).toEqual({
    ok: false,
    error: 'Not a Routiner backup (missing state).',
  });
  const future = parseBackup('{"version":99,"state":{}}');
  expect(future.ok).toBe(false);
});
