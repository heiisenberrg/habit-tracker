/**
 * Grocery tab data model.
 *
 * A TRIP is the unit of record — "6 shops in September, 4 at Lidl" is a
 * question about trips, not about loose items. The to-buy list is the on-ramp:
 * ticking a ListItem with a price turns it into a TripItem on the open trip,
 * so nothing is ever typed twice.
 */

export type Unit = 'pc' | 'kg' | 'g' | 'l' | 'ml' | 'pack';

export const UNITS: Unit[] = ['pc', 'kg', 'g', 'l', 'ml', 'pack'];

/** A shop you buy from. Archived stores stay on old trips, leave the picker. */
export type Store = {
  id: string;
  name: string;
  archived?: boolean;
};

/** A line on the to-buy list, written before leaving the house. */
export type ListItem = {
  id: string;
  name: string;
  /** "skimmed", "the big pack" — whatever tells you which one to grab. */
  note?: string;
  qty?: number;
  unit?: Unit;
  /** True once it has been bought into a trip. */
  done: boolean;
  addedOn: string; // YYYY-MM-DD
};

/** A line actually paid for on a trip. */
export type TripItem = {
  id: string;
  name: string;
  note?: string;
  qty: number;
  unit: Unit;
  /** Euros paid for this line in total (not per unit). */
  price: number;
  expiresOn?: string; // YYYY-MM-DD
};

/** One shop: a store, a date, and what came home. */
export type Trip = {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  items: TripItem[];
  /**
   * Set when a shop is logged as a lump sum ("€43.20 at Lidl"); null means
   * the total is the sum of the items.
   */
  manualTotal: number | null;
  status: 'open' | 'closed';
  createdAt: string; // ISO
};

export type GrocerySlice = {
  stores: Store[];
  list: ListItem[];
  trips: Trip[];
};

/** Stores every install starts with; renameable and archivable like any other. */
export const SEED_STORES: Store[] = [
  { id: 'store-lidl', name: 'Lidl' },
  { id: 'store-esselunga', name: 'Esselunga' },
  { id: 'store-conad', name: 'Conad' },
];

export const emptyGrocery = (): GrocerySlice => ({
  stores: SEED_STORES.map(s => ({ ...s })),
  list: [],
  trips: [],
});
