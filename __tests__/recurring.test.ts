/**
 * @format
 *
 * Recurring bills: "rent, €650, the 1st of every month" — when the next due
 * moment is, which months materialize into the ledger (once each), what the
 * reminder says, and that boot-time resync never prompts.
 */
jest.mock('@notifee/react-native', () => {
  const api = {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
    createTriggerNotification: jest.fn(async () => 'id'),
    displayNotification: jest.fn(async () => 'id'),
    cancelNotification: jest.fn(async () => undefined),
    getTriggerNotificationIds: jest.fn(async () => []),
    createChannel: jest.fn(async () => 'recurring'),
    setNotificationCategories: jest.fn(async () => undefined),
    onBackgroundEvent: jest.fn(),
    onForegroundEvent: jest.fn(() => () => undefined),
  };
  return {
    __esModule: true,
    default: api,
    TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
    RepeatFrequency: { DAILY: 1 },
    AndroidImportance: { HIGH: 4 },
    EventType: { ACTION_PRESS: 2 },
  };
});

const mockNotifee = jest.requireMock('@notifee/react-native').default;

import { RecurringExpense } from '../src/data/expenses';
import {
  dueDayKey,
  nextDueDate,
  pendingMaterializations,
  resyncRecurringReminders,
  triggersForRules,
} from '../src/services/recurringExpenses';
import { useStore } from '../src/store/useStore';

const rule = (
  over: Partial<RecurringExpense> & { id: string },
): RecurringExpense => ({
  category: 'rent',
  amount: 650,
  day: 1,
  enabled: true,
  createdAt: '2026-07-15T10:00:00.000Z',
  ...over,
});

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0);

describe('due dates', () => {
  test('day 31 clamps to short months', () => {
    expect(dueDayKey({ day: 31 }, '2026-04')).toBe('2026-04-30');
    expect(dueDayKey({ day: 31 }, '2026-02')).toBe('2026-02-28');
    expect(dueDayKey({ day: 25 }, '2026-09')).toBe('2026-09-25');
  });

  test('next due is this month before 09:00 on the day, else next month', () => {
    expect(nextDueDate({ day: 25 }, at(2026, 9, 3))).toEqual(
      at(2026, 9, 25, 9, 0),
    );
    expect(nextDueDate({ day: 25 }, at(2026, 9, 25, 8, 59))).toEqual(
      at(2026, 9, 25, 9, 0),
    );
    expect(nextDueDate({ day: 25 }, at(2026, 9, 25, 9, 0))).toEqual(
      at(2026, 10, 25, 9, 0),
    );
  });
});

describe('materialization', () => {
  test('catches up every due month since creation, oldest first', () => {
    const { additions, lastAdded } = pendingMaterializations(
      [rule({ id: 'r1' })],
      at(2026, 9, 3),
    );
    expect(additions.map(a => a.monthKey)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(additions[0]).toMatchObject({
      recurringId: 'r1',
      category: 'rent',
      amount: 650,
    });
    expect(lastAdded.r1).toBe('2026-09');
  });

  test('a not-yet-due month stops the walk; disabled rules do nothing', () => {
    const { additions } = pendingMaterializations(
      [rule({ id: 'r1', day: 25, createdAt: '2026-09-03T10:00:00.000Z' })],
      at(2026, 9, 3),
    );
    expect(additions).toEqual([]);
    expect(
      pendingMaterializations([rule({ id: 'r1', enabled: false })], at(2026, 9, 3))
        .additions,
    ).toEqual([]);
  });

  test('the bookmark makes it idempotent', () => {
    const { additions } = pendingMaterializations(
      [rule({ id: 'r1', lastAddedMonth: '2026-08' })],
      at(2026, 9, 3),
    );
    expect(additions.map(a => a.monthKey)).toEqual(['2026-09']);
    expect(
      pendingMaterializations(
        [rule({ id: 'r1', lastAddedMonth: '2026-09' })],
        at(2026, 9, 3),
      ).additions,
    ).toEqual([]);
  });
});

describe('reminders', () => {
  test('one trigger per enabled rule with the bill in the copy', () => {
    const t = triggersForRules(
      [
        rule({ id: 'r1', note: 'Via Roma' }),
        rule({ id: 'r2', category: 'mobile', amount: 20, day: 25 }),
        rule({ id: 'r3', enabled: false }),
      ],
      at(2026, 9, 3),
    );
    expect(t.map(x => x.id)).toEqual(['recur-r2', 'recur-r1']);
    expect(t[0].timestamp).toBe(at(2026, 9, 25, 9, 0).getTime());
    expect(t[1].timestamp).toBe(at(2026, 10, 1, 9, 0).getTime());
    expect(t[1].title).toBe('🏠 Home rent · Via Roma');
    expect(t[0].body).toBe('€20.00 due today — added to your expenses');
  });

  test('resync is silent, cancels stale recur-* ids only', async () => {
    mockNotifee.getTriggerNotificationIds.mockResolvedValue([
      'recur-gone',
      'date-a-on',
      'evening-recap',
    ]);
    await resyncRecurringReminders([rule({ id: 'r1' })], at(2026, 9, 3));
    expect(mockNotifee.requestPermission).not.toHaveBeenCalled();
    const cancelled = mockNotifee.cancelNotification.mock.calls.map(
      (c: [string]) => c[0],
    );
    expect(cancelled).toEqual(['recur-gone']);
    const [notification, trigger] =
      mockNotifee.createTriggerNotification.mock.calls[0];
    expect(notification.id).toBe('recur-r1');
    expect(trigger).toEqual({
      type: 0,
      timestamp: at(2026, 10, 1, 9, 0).getTime(),
    });
  });
});

describe('store slice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStore.getState().reset();
  });

  test('addRecurring validates amount and day', () => {
    const s = useStore.getState();
    expect(s.addRecurring({ category: 'rent', amount: 0, day: 1 })).toBe('');
    expect(s.addRecurring({ category: 'rent', amount: 650, day: 0 })).toBe('');
    expect(s.addRecurring({ category: 'rent', amount: 650, day: 32 })).toBe('');
    const id = s.addRecurring({ category: 'rent', amount: 650, day: 1 });
    expect(id).toMatch(/^rec-/);
    expect(useStore.getState().recurring[0]).toMatchObject({
      enabled: true,
      day: 1,
    });
  });

  test('rollRecurring adds each due month once and a deleted entry stays deleted', () => {
    useStore.setState({ recurring: [rule({ id: 'r1' })] } as never);
    useStore.getState().rollRecurring(at(2026, 9, 3));
    let expenses = useStore.getState().expenses;
    expect(expenses.map(e => e.monthKey)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(expenses[0].recurringId).toBe('r1');

    // Idempotent.
    useStore.getState().rollRecurring(at(2026, 9, 5));
    expect(useStore.getState().expenses).toHaveLength(3);

    // The user deletes September's rent — the roll must not resurrect it.
    const sept = useStore
      .getState()
      .expenses.find(e => e.monthKey === '2026-09');
    useStore.getState().removeExpense((sept as { id: string }).id);
    useStore.getState().rollRecurring(at(2026, 9, 6));
    expect(useStore.getState().expenses).toHaveLength(2);

    // October arrives → exactly one more.
    useStore.getState().rollRecurring(at(2026, 10, 1));
    expect(
      useStore.getState().expenses.map(e => e.monthKey),
    ).toEqual(['2026-07', '2026-08', '2026-10']);
  });
});
