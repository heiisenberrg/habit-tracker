/**
 * @format
 *
 * The Expenses sentence is the spec: "September cost €715 — €650 rent and
 * €25 wifi by hand, €40 of groceries from the trips — €60 less than August,
 * and the rent copies itself into October."
 */
import { Expense } from '../src/data/expenses';
import { Trip } from '../src/data/grocery';
import {
  copyFromPreviousMonth,
  debtSentence,
  debtTotals,
  expenseMonthOverMonth,
  expenseMonthlySeries,
  expensesInMonth,
  monthManualTotal,
  monthTotal,
} from '../src/services/expenses';
import { DATA_KEYS, migrateStore, useStore } from '../src/store/useStore';

const exp = (over: Partial<Expense> & { id: string }): Expense => ({
  monthKey: '2026-09',
  category: 'rent',
  amount: 650,
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

const trip = (over: Partial<Trip> & { id: string; date: string }): Trip => ({
  storeId: 'store-lidl',
  items: [],
  manualTotal: null,
  status: 'closed',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

const SEPT: Expense[] = [
  exp({ id: 'e1' }),
  exp({ id: 'e2', category: 'wifi', amount: 24.9, note: 'Fastweb' }),
  exp({ id: 'e3', category: 'restaurant', amount: 0.1 }),
  exp({ id: 'e0', monthKey: '2026-08', amount: 650 }),
  exp({ id: 'e0b', monthKey: '2026-08', category: 'gas', amount: 85 }),
];

const TRIPS: Trip[] = [
  trip({ id: 't1', date: '2026-09-02', manualTotal: 40 }),
  trip({ id: 't0', date: '2026-08-15', manualTotal: 40 }),
];

describe('expense metrics', () => {
  test('manual totals stay cents-exact and month-scoped', () => {
    expect(monthManualTotal(SEPT, '2026-09')).toBe(675);
    expect(monthManualTotal(SEPT, '2026-08')).toBe(735);
    expect(expensesInMonth(SEPT, '2026-09').map(e => e.id)).toEqual([
      'e1',
      'e2',
      'e3',
    ]);
  });

  test('the month total folds in the grocery spend', () => {
    expect(monthTotal(SEPT, TRIPS, '2026-09')).toBe(715);
    expect(monthTotal([], TRIPS, '2026-09')).toBe(40);
  });

  test('the month series ends at the anchor, keeps zero months, folds groceries', () => {
    const series = expenseMonthlySeries(SEPT, TRIPS, '2026-09', 6);
    expect(series).toHaveLength(6);
    expect(series[0].monthKey).toBe('2026-04');
    expect(series[5]).toEqual({ monthKey: '2026-09', spend: 715 });
    expect(series[4]).toEqual({ monthKey: '2026-08', spend: 775 });
    expect(series[3]).toEqual({ monthKey: '2026-07', spend: 0 });
  });

  test('month over month compares full totals', () => {
    const d = expenseMonthOverMonth(SEPT, TRIPS, '2026-09');
    expect(d.current).toBe(715);
    expect(d.previous).toBe(775);
    expect(d.deltaAbs).toBe(-60);
    const empty = expenseMonthOverMonth([], [], '2026-09');
    expect(empty.deltaPct).toBeNull();
  });
});

describe('copy last month', () => {
  test('copies only the bills this month is missing', () => {
    // September already has rent; August had rent + gas → only gas copies.
    const additions = copyFromPreviousMonth(SEPT, '2026-09');
    expect(additions).toEqual([
      { monthKey: '2026-09', category: 'gas', amount: 85, note: undefined },
    ]);
  });

  test('same category with different notes are different bills', () => {
    const two = [
      exp({ id: 'a', monthKey: '2026-08', category: 'restaurant', note: 'Marco' }),
      exp({ id: 'b', monthKey: '2026-08', category: 'restaurant', note: 'Anna' }),
      exp({ id: 'c', monthKey: '2026-09', category: 'restaurant', note: 'marco ' }),
    ];
    const additions = copyFromPreviousMonth(two, '2026-09');
    expect(additions.map(a => a.note)).toEqual(['Anna']);
  });

  test('an empty previous month copies nothing', () => {
    expect(copyFromPreviousMonth(SEPT, '2026-08')).toEqual([]);
  });
});

describe('debts', () => {
  const debt = (over: Record<string, unknown>) => ({
    id: 'd1',
    person: 'Marco',
    direction: 'owedToMe' as const,
    amount: 50,
    settled: false,
    createdAt: '2026-09-01T10:00:00.000Z',
    ...over,
  });

  test('totals count only open debts, both ways', () => {
    const t = debtTotals([
      debt({ id: 'a' }),
      debt({ id: 'b', direction: 'iOwe', amount: 20.5 }),
      debt({ id: 'c', amount: 100, settled: true }),
    ]);
    expect(t).toEqual({ owedToMe: 50, iOwe: 20.5, net: 29.5 });
    expect(debtSentence(t)).toBe('Owed to you €50.00 · you owe €20.50');
    expect(debtSentence(debtTotals([]))).toBe('All square');
  });

  test('add validates, settle toggles, remove deletes', () => {
    useStore.getState().reset();
    const s = useStore.getState();
    expect(
      s.addDebt({ person: '  ', direction: 'owedToMe', amount: 50 }),
    ).toBe('');
    expect(
      s.addDebt({ person: 'Marco', direction: 'owedToMe', amount: 0 }),
    ).toBe('');
    const id = s.addDebt({ person: ' Marco ', direction: 'owedToMe', amount: 50 });
    expect(id).toMatch(/^debt-/);
    expect(useStore.getState().debts[0]).toMatchObject({
      person: 'Marco',
      settled: false,
    });
    useStore.getState().updateDebt(id, { settled: true });
    expect(useStore.getState().debts[0].settled).toBe(true);
    useStore.getState().removeDebt(id);
    expect(useStore.getState().debts).toEqual([]);
  });

  test('v8 migration gives older installs an empty list; debts are backed up', () => {
    expect(migrateStore({}, 7)).toMatchObject({ debts: [] });
    expect(DATA_KEYS).toContain('debts');
  });
});

describe('store slice', () => {
  beforeEach(() => useStore.getState().reset());

  test('add, update, remove — amounts always cents-rounded and positive', () => {
    const id = useStore.getState().addExpense({
      monthKey: '2026-09',
      category: 'rent',
      amount: 650.005,
    });
    expect(id).toMatch(/^exp-/);
    expect(useStore.getState().expenses[0].amount).toBeCloseTo(650.01, 2);

    useStore.getState().updateExpense(id, { amount: NaN });
    expect(useStore.getState().expenses[0].amount).toBeCloseTo(650.01, 2);
    useStore.getState().updateExpense(id, { amount: 700, note: 'new flat' });
    expect(useStore.getState().expenses[0]).toMatchObject({
      amount: 700,
      note: 'new flat',
    });

    useStore.getState().removeExpense(id);
    expect(useStore.getState().expenses).toEqual([]);
  });

  test('a zero or broken amount is not stored', () => {
    const s = useStore.getState();
    expect(
      s.addExpense({ monthKey: '2026-09', category: 'gas', amount: 0 }),
    ).toBe('');
    expect(
      s.addExpense({ monthKey: '2026-09', category: 'gas', amount: NaN }),
    ).toBe('');
    expect(useStore.getState().expenses).toEqual([]);
  });

  test('copyLastMonthExpenses appends and reports the count', () => {
    useStore.getState().addExpense({
      monthKey: '2026-08',
      category: 'rent',
      amount: 650,
    });
    useStore.getState().addExpense({
      monthKey: '2026-08',
      category: 'wifi',
      amount: 25,
    });
    expect(useStore.getState().copyLastMonthExpenses('2026-09')).toBe(2);
    // Idempotent: the second copy finds nothing missing.
    expect(useStore.getState().copyLastMonthExpenses('2026-09')).toBe(0);
    expect(
      expensesInMonth(useStore.getState().expenses, '2026-09'),
    ).toHaveLength(2);
  });

  test('v7 migration gives older installs an empty ledger; expenses are backed up', () => {
    expect(migrateStore({ habits: [] }, 6)).toMatchObject({ expenses: [] });
    const kept = migrateStore({ expenses: [{ id: 'x' }] }, 6);
    expect(kept.expenses).toEqual([{ id: 'x' }]);
    expect(DATA_KEYS).toContain('expenses');
  });
});
