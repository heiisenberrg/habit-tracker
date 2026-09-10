/**
 * Logbook metrics — pure functions, so "49 days since your last haircut,
 * about every 45 days" is a unit test rather than a memory.
 */
import { LogEntry, LogbookSlice, Tracker } from '../data/logbook';

/** Day-level difference from → to (UTC math, DST-safe on day keys). */
export const dayDiff = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000,
  );
};

/** A tracker's entries, most recent first (ties: newest logged first). */
export const entriesFor = (
  entries: LogEntry[],
  trackerId: string,
): LogEntry[] =>
  entries
    .filter(e => e.trackerId === trackerId)
    .sort(
      (a, b) =>
        (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) ||
        (a.createdAt < b.createdAt ? 1 : -1),
    );

/**
 * Mean gap in days between occurrences, on UNIQUE days (logging twice on one
 * day is one occasion, not a zero-day gap). Null until there are two days.
 */
export const averageGapDays = (
  entries: LogEntry[],
  trackerId: string,
): number | null => {
  const days = [
    ...new Set(entries.filter(e => e.trackerId === trackerId).map(e => e.date)),
  ].sort();
  if (days.length < 2) {
    return null;
  }
  const gaps = days.slice(1).map((d, i) => dayDiff(days[i], d));
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
};

export type TrackerRow = {
  tracker: Tracker;
  /** Most recent entry, or null when never logged. */
  last: LogEntry | null;
  /** Days since the last entry; null when never logged. */
  daysSince: number | null;
  avgGap: number | null;
  count: number;
};

/** One row per tracker, alphabetical — the Logbook list. */
export const trackerRows = (
  logbook: LogbookSlice,
  today: string,
): TrackerRow[] =>
  logbook.trackers
    .map(tracker => {
      const list = entriesFor(logbook.entries, tracker.id);
      const last = list[0] ?? null;
      return {
        tracker,
        last,
        daysSince: last ? dayDiff(last.date, today) : null,
        avgGap: averageGapDays(logbook.entries, tracker.id),
        count: list.length,
      };
    })
    .sort((a, b) => a.tracker.name.localeCompare(b.tracker.name));

/** "today" / "yesterday" / "49 days ago" / "never logged". */
export const sinceLabel = (daysSince: number | null): string =>
  daysSince == null
    ? 'never logged'
    : daysSince <= 0
    ? 'today'
    : daysSince === 1
    ? 'yesterday'
    : `${daysSince} days ago`;

/** "1 time" / "5 times", with the personal rhythm when it exists. */
export const rhythmLabel = (row: TrackerRow): string => {
  const times = `${row.count} time${row.count === 1 ? '' : 's'}`;
  return row.avgGap != null && row.avgGap > 0
    ? `${times} · about every ${row.avgGap} days`
    : times;
};
