/**
 * @format
 *
 * The Logbook sentence is the spec: "haircut on 15 July, again on 12
 * September — 59 days apart, so about every 59 days, and it's been N days
 * since." Not a habit: no streaks, nothing here touches the perfect day.
 */
import { emptyLogbook } from '../src/data/logbook';
import {
  averageGapDays,
  dayDiff,
  entriesFor,
  rhythmLabel,
  sinceLabel,
  trackerRows,
} from '../src/services/logbook';
import { DATA_KEYS, migrateStore, useStore } from '../src/store/useStore';

const entry = (id: string, trackerId: string, date: string) => ({
  id,
  trackerId,
  date,
  createdAt: `${date}T10:00:00.000Z`,
});

const HAIRCUT = { id: 't1', name: 'Haircut', emoji: '💇', createdAt: 'x' };
const FILTER = { id: 't2', name: 'AC filter', emoji: '🧹', createdAt: 'x' };

describe('logbook metrics', () => {
  test('the haircut sentence: 15 Jul → 12 Sep is 59 days', () => {
    expect(dayDiff('2026-07-15', '2026-09-12')).toBe(59);
    const entries = [
      entry('e1', 't1', '2026-07-15'),
      entry('e2', 't1', '2026-09-12'),
    ];
    expect(averageGapDays(entries, 't1')).toBe(59);
    const rows = trackerRows(
      { trackers: [HAIRCUT], entries },
      '2026-09-20',
    );
    expect(rows[0].last?.date).toBe('2026-09-12');
    expect(rows[0].daysSince).toBe(8);
    expect(rhythmLabel(rows[0])).toBe('2 times · about every 59 days');
  });

  test('entries sort newest first; same-day double log is one occasion', () => {
    const entries = [
      entry('e1', 't1', '2026-07-15'),
      entry('e2', 't1', '2026-09-12'),
      entry('e3', 't1', '2026-09-12'),
    ];
    expect(entriesFor(entries, 't1').map(e => e.date)).toEqual([
      '2026-09-12',
      '2026-09-12',
      '2026-07-15',
    ]);
    // Unique days only — a duplicate day must not drag the average to 30.
    expect(averageGapDays(entries, 't1')).toBe(59);
  });

  test('labels: today, yesterday, N days ago, never', () => {
    expect(sinceLabel(0)).toBe('today');
    expect(sinceLabel(1)).toBe('yesterday');
    expect(sinceLabel(49)).toBe('49 days ago');
    expect(sinceLabel(null)).toBe('never logged');
  });

  test('rows are alphabetical and a fresh tracker reads honestly', () => {
    const rows = trackerRows(
      { trackers: [FILTER, HAIRCUT], entries: [] },
      '2026-09-20',
    );
    expect(rows.map(r => r.tracker.name)).toEqual(['AC filter', 'Haircut']);
    expect(rows[0].daysSince).toBeNull();
    expect(rhythmLabel(rows[0])).toBe('0 times');
    expect(averageGapDays([entry('e1', 't1', '2026-07-15')], 't1')).toBeNull();
  });
});

describe('store slice', () => {
  beforeEach(() => useStore.getState().reset());

  test('add, log, backdate, and cascade-delete', () => {
    const s = useStore.getState();
    expect(s.addTracker('   ', '💇')).toBe('');
    const id = s.addTracker(' Haircut ', '💇');
    expect(id).toMatch(/^trk-/);
    expect(useStore.getState().logbook.trackers[0].name).toBe('Haircut');

    expect(useStore.getState().logTrackerEntry(id, 'nonsense')).toBe('');
    const e1 = useStore.getState().logTrackerEntry(id, '2026-07-15');
    const e2 = useStore.getState().logTrackerEntry(id, '2026-09-12');
    expect(e1).toMatch(/^log-/);
    expect(useStore.getState().logbook.entries).toHaveLength(2);

    useStore.getState().removeTrackerEntry(e2);
    expect(useStore.getState().logbook.entries).toHaveLength(1);

    useStore.getState().removeTracker(id);
    expect(useStore.getState().logbook).toEqual(emptyLogbook());
  });

  test('v10 migration gives older installs an empty logbook; it is backed up', () => {
    expect(migrateStore({}, 9)).toMatchObject({
      logbook: { trackers: [], entries: [] },
    });
    expect(DATA_KEYS).toContain('logbook');
  });
});
