/**
 * Grocery metrics — pure functions over trips, so every number on the
 * Insights screen is a unit test rather than a screenshot.
 *
 * Money is kept in euros and rounded to cents at every aggregation: summing
 * 1.15 + 0.99 + 2.30 in binary floats otherwise drifts into 4.44000000000001.
 */
import { GrocerySlice, Store, Trip, TripItem } from '../data/grocery';

/** Round to cents — call at every boundary a total is produced. */
export const cents = (n: number): number => Math.round(n * 100) / 100;

export const formatEur = (n: number): string => `€${cents(n).toFixed(2)}`;

/** A trip's total: the lump sum when one was entered, else its items. */
export const tripTotal = (trip: Trip): number =>
  trip.manualTotal != null
    ? cents(trip.manualTotal)
    : cents(trip.items.reduce((sum, i) => sum + i.price, 0));

/** "2026-09-14" -> "2026-09" */
export const monthKeyOf = (dateKey: string): string => dateKey.slice(0, 7);

export const monthKeyOfDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Month arithmetic on the key itself — no Date, so no DST or TZ surprises. */
export const shiftMonthKey = (monthKey: string, by: number): string => {
  const [y, m] = monthKey.split('-').map(Number);
  const zero = y * 12 + (m - 1) + by;
  return `${Math.floor(zero / 12)}-${String((zero % 12) + 1).padStart(2, '0')}`;
};

/** Human month label: "September 2026". */
export const monthLabel = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

export const tripsInMonth = (trips: Trip[], monthKey: string): Trip[] =>
  trips.filter(t => monthKeyOf(t.date) === monthKey);

export const monthSpend = (trips: Trip[], monthKey: string): number =>
  cents(tripsInMonth(trips, monthKey).reduce((s, t) => s + tripTotal(t), 0));

export const monthTripCount = (trips: Trip[], monthKey: string): number =>
  tripsInMonth(trips, monthKey).length;

export const avgPerTrip = (trips: Trip[], monthKey: string): number => {
  const n = monthTripCount(trips, monthKey);
  return n === 0 ? 0 : cents(monthSpend(trips, monthKey) / n);
};

export type StoreRow = {
  storeId: string;
  name: string;
  trips: number;
  spend: number;
  /** Share of the month's spend, 0..1 (0 when the month is free). */
  share: number;
};

/**
 * Per-store split for a month: "4 times to Lidl, 2 to Esselunga".
 * Sorted by trip count first (that is the sentence the user says out loud),
 * spend as the tie-break. Stores with no trips that month are left out.
 */
export const storeBreakdown = (
  trips: Trip[],
  stores: Store[],
  monthKey: string,
): StoreRow[] => {
  const total = monthSpend(trips, monthKey);
  const rows = new Map<string, StoreRow>();
  for (const trip of tripsInMonth(trips, monthKey)) {
    const row = rows.get(trip.storeId) ?? {
      storeId: trip.storeId,
      name: storeName(stores, trip.storeId),
      trips: 0,
      spend: 0,
      share: 0,
    };
    row.trips += 1;
    row.spend = cents(row.spend + tripTotal(trip));
    rows.set(trip.storeId, row);
  }
  return [...rows.values()]
    .map(r => ({ ...r, share: total === 0 ? 0 : r.spend / total }))
    .sort((a, b) => b.trips - a.trips || b.spend - a.spend);
};

/** A deleted store still names its old trips. */
export const storeName = (stores: Store[], storeId: string): string =>
  stores.find(s => s.id === storeId)?.name ?? 'Unknown store';

export type MonthDelta = {
  current: number;
  previous: number;
  /** current − previous; negative means you spent less than last month. */
  deltaAbs: number;
  /** Fraction of the previous month, null when there is nothing to compare. */
  deltaPct: number | null;
};

export const monthOverMonth = (trips: Trip[], monthKey: string): MonthDelta => {
  const current = monthSpend(trips, monthKey);
  const previous = monthSpend(trips, shiftMonthKey(monthKey, -1));
  return {
    current,
    previous,
    deltaAbs: cents(current - previous),
    deltaPct: previous === 0 ? null : (current - previous) / previous,
  };
};

export type ExpiringItem = {
  tripId: string;
  storeName: string;
  item: TripItem;
  /** Days until it expires; 0 is today, negative is already past. */
  daysLeft: number;
};

const dayDiff = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86400000);
};

/**
 * What is about to go off: everything with an expiry inside the window,
 * soonest first. Already-expired items stay in the list (negative daysLeft) —
 * the thing you most need to see is the yoghurt you already missed.
 */
export const expiringSoon = (
  trips: Trip[],
  today: string,
  days = 5,
): ExpiringItem[] => {
  const out: ExpiringItem[] = [];
  for (const trip of trips) {
    for (const item of trip.items) {
      if (!item.expiresOn) {
        continue;
      }
      const daysLeft = dayDiff(today, item.expiresOn);
      if (daysLeft <= days) {
        out.push({
          tripId: trip.id,
          storeName: trip.storeId,
          item,
          daysLeft,
        });
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
};

/** expiringSoon with store ids resolved to names. */
export const expiringSoonNamed = (
  slice: GrocerySlice,
  today: string,
  days = 5,
): ExpiringItem[] =>
  expiringSoon(slice.trips, today, days).map(e => ({
    ...e,
    storeName: storeName(slice.stores, e.storeName),
  }));

export type ItemRow = { name: string; count: number; spend: number };

/** Where the month's money actually went, by item name (case-insensitive). */
export const topItems = (
  trips: Trip[],
  monthKey: string,
  limit = 5,
): ItemRow[] => {
  const rows = new Map<string, ItemRow>();
  for (const trip of tripsInMonth(trips, monthKey)) {
    for (const item of trip.items) {
      const key = item.name.trim().toLowerCase();
      const row = rows.get(key) ?? {
        name: item.name.trim(),
        count: 0,
        spend: 0,
      };
      row.count += 1;
      row.spend = cents(row.spend + item.price);
      rows.set(key, row);
    }
  }
  return [...rows.values()]
    .sort((a, b) => b.spend - a.spend || b.count - a.count)
    .slice(0, limit);
};

/** Months that have at least one trip, newest first — the scrubber's range. */
export const monthsWithTrips = (trips: Trip[]): string[] =>
  [...new Set(trips.map(t => monthKeyOf(t.date)))].sort((a, b) =>
    a < b ? 1 : -1,
  );
