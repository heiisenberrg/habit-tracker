/**
 * Logbook data model.
 *
 * A TRACKER is a specific thing you do now and then — a haircut, the AC
 * filter, an oil change. Not a habit (no daily cadence, no streak): the
 * question it answers is "when did I last do this, and how often do I tend
 * to?". Each log ENTRY is one occurrence on one day.
 */

export type Tracker = {
  id: string;
  name: string;
  emoji: string;
  createdAt: string; // ISO
};

export type LogEntry = {
  id: string;
  trackerId: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
};

export type LogbookSlice = {
  trackers: Tracker[];
  entries: LogEntry[];
};

export const emptyLogbook = (): LogbookSlice => ({ trackers: [], entries: [] });

/** Suggested tracker emojis; free choice, 📌 is the default. */
export const TRACKER_EMOJIS = [
  '💇',
  '🦷',
  '🚗',
  '🧹',
  '💊',
  '🩺',
  '✂️',
  '🛠',
  '🌿',
  '📌',
];
