/**
 * Expense tracker data model.
 *
 * An EXPENSE is one bill in one month — "Home rent, €650, September". The
 * month is the unit of tracking: groceries join each month automatically
 * from the Grocery tab's trips, everything else is added by hand (and the
 * recurring bills can be copied over from the previous month).
 */

export type ExpenseCategory =
  | 'rent'
  | 'electricity'
  | 'gas'
  | 'waste'
  | 'mobile'
  | 'restaurant'
  | 'wifi'
  | 'transport'
  | 'other';

export type Expense = {
  id: string;
  monthKey: string; // YYYY-MM
  category: ExpenseCategory;
  /** Euros paid in total. */
  amount: number;
  /** "Fastweb", "dinner with Marco" — whatever tells you which bill. */
  note?: string;
  /** Set when a recurring rule materialized this entry. */
  recurringId?: string;
  createdAt: string; // ISO
};

/**
 * A RECURRING EXPENSE is the rule behind a bill — "rent, €650, the 1st of
 * every month". On the due day it lands in the ledger as a normal Expense
 * (editable on its own) and a reminder fires. `lastAddedMonth` bookmarks
 * how far materialization got, so a deleted entry stays deleted.
 */
export type RecurringExpense = {
  id: string;
  category: ExpenseCategory;
  amount: number;
  note?: string;
  /** Day of the month it's due, 1..31 (clamped to short months). */
  day: number;
  enabled: boolean;
  lastAddedMonth?: string; // YYYY-MM
  createdAt: string; // ISO
};

export type CategoryMeta = {
  category: ExpenseCategory;
  emoji: string;
  label: string;
};

export const CATEGORIES: CategoryMeta[] = [
  { category: 'rent', emoji: '🏠', label: 'Home rent' },
  { category: 'electricity', emoji: '⚡', label: 'Electricity' },
  { category: 'gas', emoji: '🔥', label: 'Gas' },
  { category: 'waste', emoji: '🗑', label: 'Waste' },
  { category: 'mobile', emoji: '📱', label: 'Mobile recharge' },
  { category: 'restaurant', emoji: '🍽', label: 'Eating out' },
  { category: 'wifi', emoji: '📶', label: 'WiFi' },
  { category: 'transport', emoji: '🚌', label: 'Transport' },
  { category: 'other', emoji: '📦', label: 'Other' },
];

export const categoryMeta = (category: ExpenseCategory): CategoryMeta =>
  CATEGORIES.find(c => c.category === category) ??
  CATEGORIES[CATEGORIES.length - 1];

/** Who owes whom. */
export type DebtDirection = 'owedToMe' | 'iOwe';

/**
 * A DEBT is money in flight — "Marco owes me €50", "I owe the landlord
 * €200". Not month-scoped: it stays open until settled, unlike an expense.
 */
export type Debt = {
  id: string;
  person: string;
  direction: DebtDirection;
  /** Euros. */
  amount: number;
  note?: string;
  settled: boolean;
  createdAt: string; // ISO
};
