/**
 * @format
 *
 * The September sentence is the spec: "6 shops, 4 Lidl, 2 Esselunga, €200,
 * less than August." These tests are that sentence.
 */
import { Trip } from '../src/data/grocery';
import {
  avgPerTrip,
  expiryLabel,
  formatEurCompact,
  monthTick,
  monthlySeries,
  normalizeDateKey,
  expiringSoonNamed,
  monthOverMonth,
  monthSpend,
  monthTripCount,
  monthsWithTrips,
  shiftMonthKey,
  storeBreakdown,
  topItems,
  tripTotal,
} from '../src/services/grocery';
import { DATA_KEYS, migrateStore, useStore } from '../src/store/useStore';

const trip = (over: Partial<Trip> & { id: string; date: string }): Trip => ({
  storeId: 'store-lidl',
  items: [],
  manualTotal: null,
  status: 'closed',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

const item = (name: string, price: number, expiresOn?: string) => ({
  id: `i-${name}-${price}`,
  name,
  qty: 1,
  unit: 'pc' as const,
  price,
  expiresOn,
});

/** September: 4 Lidl + 2 Esselunga = 6 trips, €200. August: €260. */
const SEPTEMBER: Trip[] = [
  trip({ id: 't1', date: '2026-09-02', manualTotal: 40 }),
  trip({ id: 't2', date: '2026-09-08', manualTotal: 30 }),
  trip({
    id: 't3',
    date: '2026-09-14',
    items: [item('Milk', 1.15), item('Onion', 0.99)],
  }),
  trip({ id: 't4', date: '2026-09-21', manualTotal: 47.86 }),
  trip({
    id: 't5',
    date: '2026-09-05',
    storeId: 'store-esselunga',
    manualTotal: 50,
  }),
  trip({
    id: 't6',
    date: '2026-09-19',
    storeId: 'store-esselunga',
    manualTotal: 30,
  }),
  trip({ id: 't0', date: '2026-08-15', manualTotal: 260 }),
];

const STORES = [
  { id: 'store-lidl', name: 'Lidl' },
  { id: 'store-esselunga', name: 'Esselunga' },
  { id: 'store-conad', name: 'Conad' },
];

describe('grocery metrics', () => {
  test('the September sentence', () => {
    expect(monthTripCount(SEPTEMBER, '2026-09')).toBe(6);
    expect(monthSpend(SEPTEMBER, '2026-09')).toBe(200);

    const split = storeBreakdown(SEPTEMBER, STORES, '2026-09');
    expect(split.map(r => [r.name, r.trips])).toEqual([
      ['Lidl', 4],
      ['Esselunga', 2],
    ]);
    expect(split[0].spend).toBe(120);
    expect(split[1].spend).toBe(80);
    expect(split[1].share).toBeCloseTo(0.4, 5);

    const mom = monthOverMonth(SEPTEMBER, '2026-09');
    expect(mom.previous).toBe(260);
    expect(mom.deltaAbs).toBe(-60);
    expect(mom.deltaPct).toBeCloseTo(-60 / 260, 5);
    expect(avgPerTrip(SEPTEMBER, '2026-09')).toBeCloseTo(33.33, 2);
  });

  test('the monthly series spans six months, zeros included, oldest first', () => {
    const series = monthlySeries(SEPTEMBER, '2026-09', 6);
    expect(series.map(p => p.monthKey)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(series.map(p => p.spend)).toEqual([0, 0, 0, 0, 260, 200]);
    expect(series[5].trips).toBe(6);
    // A window that crosses New Year keeps counting backwards correctly.
    expect(monthlySeries([], '2026-01', 3).map(p => p.monthKey)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
    expect(monthTick('2026-09')).toBe('Sep');

    // Bar labels stay short enough for a narrow column.
    expect(formatEurCompact(1.15)).toBe('€1.15');
    expect(formatEurCompact(99.99)).toBe('€99.99');
    expect(formatEurCompact(200)).toBe('€200');
    expect(formatEurCompact(1234.56)).toBe('€1.2k');
    expect(formatEurCompact(12345)).toBe('€12k');
  });

  test('the store split ranks by money and can span all time', () => {
    // Esselunga: fewer trips, more money — the bar encodes spend, so it leads.
    const trips = [
      trip({ id: 'a', date: '2026-09-02', manualTotal: 10 }),
      trip({ id: 'b', date: '2026-09-03', manualTotal: 10 }),
      trip({
        id: 'c',
        date: '2026-09-04',
        storeId: 'store-esselunga',
        manualTotal: 90,
      }),
      trip({
        id: 'd',
        date: '2026-08-04',
        storeId: 'store-conad',
        manualTotal: 40,
      }),
    ];
    const month = storeBreakdown(trips, STORES, '2026-09');
    expect(month.map(r => [r.name, r.spend, r.trips])).toEqual([
      ['Esselunga', 90, 1],
      ['Lidl', 20, 2],
    ]);
    expect(month[0].share).toBeCloseTo(0.818, 3);

    // All time pulls in August's Conad trip and re-bases the shares.
    const all = storeBreakdown(trips, STORES, null);
    expect(all.map(r => r.name)).toEqual(['Esselunga', 'Conad', 'Lidl']);
    expect(all.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1, 5);
  });

  test('a lump-sum trip counts; items are summed only when there is no total', () => {
    expect(
      tripTotal(trip({ id: 'a', date: '2026-09-01', manualTotal: 43.2 })),
    ).toBe(43.2);
    expect(
      tripTotal(
        trip({
          id: 'b',
          date: '2026-09-01',
          items: [item('Milk', 1.15), item('Onion', 0.99), item('Bread', 2.3)],
        }),
      ),
    ).toBe(4.44); // not 4.440000000000001
    // A manual total wins even when items exist (you corrected the receipt).
    expect(
      tripTotal(
        trip({
          id: 'c',
          date: '2026-09-01',
          manualTotal: 5,
          items: [item('Milk', 1.15)],
        }),
      ),
    ).toBe(5);
  });

  test('an empty month reads as zero, not NaN, and has no previous-month percentage', () => {
    expect(monthSpend([], '2026-09')).toBe(0);
    expect(avgPerTrip([], '2026-09')).toBe(0);
    expect(storeBreakdown([], STORES, '2026-09')).toEqual([]);
    const mom = monthOverMonth([], '2026-09');
    expect(mom).toMatchObject({
      current: 0,
      previous: 0,
      deltaAbs: 0,
      deltaPct: null,
    });
    // First month ever: spend exists, nothing to compare against.
    expect(monthOverMonth(SEPTEMBER, '2026-08').deltaPct).toBeNull();
  });

  test('month keys shift across the year boundary', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
    expect(monthsWithTrips(SEPTEMBER)).toEqual(['2026-09', '2026-08']);
    // A December trip must not leak into the January window.
    const dec = [trip({ id: 'd', date: '2025-12-31', manualTotal: 10 })];
    expect(monthSpend(dec, '2026-01')).toBe(0);
    expect(monthSpend(dec, '2025-12')).toBe(10);
  });

  test('expiring soon: already-expired first, store named, far-off items excluded', () => {
    const trips = [
      trip({
        id: 'e1',
        date: '2026-09-01',
        items: [
          item('Yoghurt', 2, '2026-08-31'), // yesterday
          item('Milk', 1.15, '2026-09-03'),
          item('Rice', 3, '2026-12-01'), // way out
        ],
      }),
    ];
    const soon = expiringSoonNamed(
      { stores: STORES, list: [], trips },
      '2026-09-01',
      5,
    );
    expect(soon.map(e => [e.item.name, e.daysLeft])).toEqual([
      ['Yoghurt', -1],
      ['Milk', 2],
    ]);
    expect(soon[0].storeName).toBe('Lidl');
  });

  test('a junk expiry never becomes a date, and a NaN gap never becomes words', () => {
    expect(normalizeDateKey('2026-09-08')).toBe('2026-09-08');
    expect(normalizeDateKey('  2026-09-08  ')).toBe('2026-09-08');
    expect(normalizeDateKey('not-a-date')).toBeUndefined();
    expect(normalizeDateKey('08/09/2026')).toBeUndefined();
    expect(normalizeDateKey('')).toBeUndefined();
    // Real format, impossible day.
    expect(normalizeDateKey('2026-02-31')).toBeUndefined();
    expect(normalizeDateKey('2026-13-01')).toBeUndefined();
    // Leap day exists in 2028, not in 2026.
    expect(normalizeDateKey('2028-02-29')).toBe('2028-02-29');
    expect(normalizeDateKey('2026-02-29')).toBeUndefined();

    expect(expiryLabel(NaN)).toBe('');
    expect(expiryLabel(0)).toBe('expires today');
    expect(expiryLabel(-1)).toBe('expired yesterday');
    expect(expiryLabel(3)).toBe('expires in 3 days');
  });

  test('top items rank the month by spend', () => {
    const trips = [
      trip({
        id: 'x',
        date: '2026-09-02',
        items: [item('Milk', 1.15), item('Coffee', 6)],
      }),
      trip({ id: 'y', date: '2026-09-09', items: [item('milk', 1.25)] }),
      trip({ id: 'z', date: '2026-08-09', items: [item('Milk', 9)] }), // other month
    ];
    expect(topItems(trips, '2026-09', 3)).toEqual([
      { name: 'Coffee', count: 1, spend: 6 },
      { name: 'Milk', count: 2, spend: 2.4 },
    ]);
  });
});

describe('grocery store slice', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  test('a fresh install starts with the three seeded stores and nothing else', () => {
    const g = useStore.getState().grocery;
    expect(g.stores.map(s => s.name)).toEqual(['Lidl', 'Esselunga', 'Conad']);
    expect(g.list).toEqual([]);
    expect(g.trips).toEqual([]);
  });

  test('ticking a list item with a price moves it onto the open trip, once', () => {
    const s = useStore.getState();
    s.addListItem({ name: 'Milk', note: 'skimmed', qty: 1, unit: 'l' });
    s.addListItem({ name: 'Onion', qty: 1, unit: 'kg' });
    const tripId = useStore.getState().startTrip('store-lidl', '2026-09-14');
    const milk = useStore.getState().grocery.list.find(i => i.name === 'Milk')!;

    useStore.getState().buyListItem(tripId, milk.id, {
      qty: 1,
      unit: 'l',
      price: 1.15,
      expiresOn: '2026-09-20',
    });

    const g = useStore.getState().grocery;
    const bought = g.trips[0].items;
    expect(bought).toHaveLength(1);
    expect(bought[0]).toMatchObject({
      name: 'Milk',
      note: 'skimmed',
      price: 1.15,
      expiresOn: '2026-09-20',
    });
    expect(g.list.find(i => i.id === milk.id)?.done).toBe(true);
    expect(g.list.find(i => i.name === 'Onion')?.done).toBe(false);

    // Unknown ids are a no-op, not a crash or a phantom item.
    useStore
      .getState()
      .buyListItem('nope', milk.id, { qty: 1, unit: 'l', price: 1 });
    useStore
      .getState()
      .buyListItem(tripId, 'nope', { qty: 1, unit: 'l', price: 1 });
    expect(useStore.getState().grocery.trips[0].items).toHaveLength(1);
  });

  test('a trip totals its items, accepts a lump sum, and closes; clearing keeps the unbought', () => {
    const tripId = useStore.getState().startTrip('store-esselunga');
    useStore
      .getState()
      .addTripItem(tripId, { name: 'Bread', qty: 1, unit: 'pc', price: 2.3 });
    useStore
      .getState()
      .addTripItem(tripId, { name: 'Eggs', qty: 6, unit: 'pc', price: 2.1 });
    expect(tripTotal(useStore.getState().grocery.trips[0])).toBe(4.4);

    useStore.getState().updateTrip(tripId, { manualTotal: 4.5 });
    expect(tripTotal(useStore.getState().grocery.trips[0])).toBe(4.5);
    useStore.getState().updateTrip(tripId, { manualTotal: null });
    expect(tripTotal(useStore.getState().grocery.trips[0])).toBe(4.4);

    const eggs = useStore.getState().grocery.trips[0].items[1];
    useStore.getState().removeTripItem(tripId, eggs.id);
    expect(useStore.getState().grocery.trips[0].items).toHaveLength(1);

    useStore.getState().closeTrip(tripId);
    expect(useStore.getState().grocery.trips[0].status).toBe('closed');

    useStore.getState().addListItem({ name: 'Coffee' });
    useStore.getState().addListItem({ name: 'Salt' });
    const salt = useStore.getState().grocery.list.find(i => i.name === 'Salt')!;
    useStore.getState().toggleListItem(salt.id);
    useStore.getState().clearBoughtFromList();
    expect(useStore.getState().grocery.list.map(i => i.name)).toEqual([
      'Coffee',
    ]);

    useStore.getState().deleteTrip(tripId);
    expect(useStore.getState().grocery.trips).toEqual([]);
  });

  test('stores can be added, renamed and archived; blank names are refused', () => {
    useStore.getState().addStore('  Coop  ');
    useStore.getState().addStore('   ');
    const stores = useStore.getState().grocery.stores;
    expect(stores.map(s => s.name)).toEqual([
      'Lidl',
      'Esselunga',
      'Conad',
      'Coop',
    ]);

    const coop = stores[3];
    useStore.getState().renameStore(coop.id, 'Coop Italia');
    useStore.getState().renameStore(coop.id, '  ');
    useStore.getState().archiveStore('store-conad', true);
    const after = useStore.getState().grocery.stores;
    expect(after[3].name).toBe('Coop Italia');
    expect(after.find(s => s.id === 'store-conad')?.archived).toBe(true);
  });

  test('blank list items are refused', () => {
    useStore.getState().addListItem({ name: '   ' });
    expect(useStore.getState().grocery.list).toEqual([]);
  });
});

describe('grocery persistence', () => {
  test('v4 installs migrate to a seeded grocery slice, keeping their habits', () => {
    const migrated = migrateStore(
      { habits: [{ id: 'h1' }], onboarded: true },
      4,
    ) as Record<string, unknown>;
    const grocery = migrated.grocery as {
      stores: unknown[];
      list: unknown[];
      trips: unknown[];
    };
    expect(grocery.stores).toHaveLength(3);
    expect(grocery.list).toEqual([]);
    expect(grocery.trips).toEqual([]);
    expect(migrated.habits).toEqual([{ id: 'h1' }]);
  });

  test('an existing grocery slice survives migration untouched', () => {
    const mine = { stores: [{ id: 's', name: 'Mine' }], list: [], trips: [] };
    const migrated = migrateStore({ grocery: mine }, 4) as Record<
      string,
      unknown
    >;
    expect(migrated.grocery).toBe(mine);
  });

  test('grocery rides the backup export contract', () => {
    expect(DATA_KEYS).toContain('grocery');
  });
});
