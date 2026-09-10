/**
 * Expense metrics — pure functions over the manual entries plus the grocery
 * trips, so every number on the Expenses tab is a unit test. All month math
 * and cent-rounding is shared with the grocery service.
 */
import { Debt, Expense } from '../data/expenses';
import { Trip } from '../data/grocery';
import { cents, formatEur, monthSpend, shiftMonthKey } from './grocery';

export type ExpensePoint = { monthKey: string; spend: number };

export const expensesInMonth = (
  entries: Expense[],
  monthKey: string,
): Expense[] => entries.filter(e => e.monthKey === monthKey);

/** The month's hand-entered bills, in cents-safe euros. */
export const monthManualTotal = (
  entries: Expense[],
  monthKey: string,
): number =>
  cents(expensesInMonth(entries, monthKey).reduce((s, e) => s + e.amount, 0));

/** Everything the month cost: manual bills + the Grocery tab's spend. */
export const monthTotal = (
  entries: Expense[],
  trips: Trip[],
  monthKey: string,
): number =>
  cents(monthManualTotal(entries, monthKey) + monthSpend(trips, monthKey));

export type ExpenseDelta = {
  current: number;
  previous: number;
  /** current − previous; negative means a cheaper month. */
  deltaAbs: number;
  deltaPct: number | null;
};

export const expenseMonthOverMonth = (
  entries: Expense[],
  trips: Trip[],
  monthKey: string,
): ExpenseDelta => {
  const current = monthTotal(entries, trips, monthKey);
  const previous = monthTotal(entries, trips, shiftMonthKey(monthKey, -1));
  return {
    current,
    previous,
    deltaAbs: cents(current - previous),
    deltaPct: previous === 0 ? null : (current - previous) / previous,
  };
};

/**
 * The last `count` months ending at `endMonthKey`, oldest first — the series
 * behind the month bars. Zero months stay in with a zero, so a cheap month
 * reads as cheap rather than disappearing. Spend is the FULL total: manual
 * bills plus the grocery trips.
 */
export const expenseMonthlySeries = (
  entries: Expense[],
  trips: Trip[],
  endMonthKey: string,
  count = 6,
): ExpensePoint[] =>
  Array.from({ length: count }, (_, i) => {
    const monthKey = shiftMonthKey(endMonthKey, i - (count - 1));
    return { monthKey, spend: monthTotal(entries, trips, monthKey) };
  });

export type DebtTotals = { owedToMe: number; iOwe: number; net: number };

/** Open debts only — settled ones are history, not money in flight. */
export const debtTotals = (debts: Debt[]): DebtTotals => {
  const open = debts.filter(d => !d.settled);
  const sum = (dir: Debt['direction']) =>
    cents(
      open.filter(d => d.direction === dir).reduce((s, d) => s + d.amount, 0),
    );
  const owedToMe = sum('owedToMe');
  const iOwe = sum('iOwe');
  return { owedToMe, iOwe, net: cents(owedToMe - iOwe) };
};

/** "Owed to you €50.00 · you owe €20.00" / "All square". */
export const debtSentence = (t: DebtTotals): string => {
  const parts = [
    t.owedToMe > 0 ? `Owed to you ${formatEur(t.owedToMe)}` : '',
    t.iOwe > 0 ? `you owe ${formatEur(t.iOwe)}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'All square';
};

const dupKey = (e: Pick<Expense, 'category' | 'note'>): string =>
  `${e.category}|${(e.note ?? '').trim().toLowerCase()}`;

/**
 * The recurring-bills helper: last month's entries that this month doesn't
 * have yet (same category + note counts as "already there"), remapped to
 * `monthKey`. Pure — the store action mints ids and appends.
 */
export const copyFromPreviousMonth = (
  entries: Expense[],
  monthKey: string,
): Omit<Expense, 'id' | 'createdAt'>[] => {
  const have = new Set(expensesInMonth(entries, monthKey).map(dupKey));
  return expensesInMonth(entries, shiftMonthKey(monthKey, -1))
    .filter(e => !have.has(dupKey(e)))
    .map(e => ({
      monthKey,
      category: e.category,
      amount: e.amount,
      note: e.note,
    }));
};
