/**
 * @format
 *
 * Remember dates: "Ajay's birthday, 25 June — every year, the day before at
 * 09:00." These tests are that sentence: when the next one is, which
 * triggers get armed, what the notification says, and that boot-time resync
 * never raises the OS permission prompt.
 */
jest.mock('@notifee/react-native', () => {
  const api = {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
    createTriggerNotification: jest.fn(async () => 'id'),
    displayNotification: jest.fn(async () => 'id'),
    cancelNotification: jest.fn(async () => undefined),
    getTriggerNotificationIds: jest.fn(async () => []),
    createChannel: jest.fn(async () => 'dates'),
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

import { RememberedDate } from '../src/data/dates';
import {
  MAX_DATE_TRIGGERS,
  dateNotificationIds,
  resyncDateReminders,
} from '../src/services/dateReminders';
import {
  countdownLabel,
  daysUntil,
  formatDateLabel,
  nextOccurrence,
  notificationCopy,
  remindLabel,
  selectTriggers,
  triggersFor,
  upcoming,
  validateDateParts,
  yearsOn,
} from '../src/services/dates';
import { DATA_KEYS, migrateStore, useStore } from '../src/store/useStore';

const entry = (
  over: Partial<RememberedDate> & { id: string },
): RememberedDate => ({
  title: "Ajay's birthday",
  kind: 'birthday',
  day: 25,
  month: 6,
  year: 1996,
  repeat: 'yearly',
  remind: 'both',
  time: '09:00',
  enabled: true,
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

/** Local-time constructor — never ISO strings, the tests must not depend on TZ. */
const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0);

describe('next occurrence', () => {
  test('a yearly date still ahead this year is this year', () => {
    expect(nextOccurrence(entry({ id: 'a' }), at(2026, 3, 1))).toEqual(
      at(2026, 6, 25, 9, 0),
    );
  });

  test('a yearly date already passed rolls to next year', () => {
    expect(nextOccurrence(entry({ id: 'a' }), at(2026, 9, 1))).toEqual(
      at(2027, 6, 25, 9, 0),
    );
  });

  test('on the day itself: before the reminder time it is today, after it is next year', () => {
    expect(nextOccurrence(entry({ id: 'a' }), at(2026, 6, 25, 8, 59))).toEqual(
      at(2026, 6, 25, 9, 0),
    );
    expect(nextOccurrence(entry({ id: 'a' }), at(2026, 6, 25, 9, 0))).toEqual(
      at(2027, 6, 25, 9, 0),
    );
  });

  test('29 February lands on 28 February in a non-leap year', () => {
    const leap = entry({ id: 'l', day: 29, month: 2, year: 2000 });
    expect(nextOccurrence(leap, at(2026, 1, 1))).toEqual(at(2026, 2, 28, 9, 0));
    expect(nextOccurrence(leap, at(2028, 1, 1))).toEqual(at(2028, 2, 29, 9, 0));
  });

  test('a one-off date is itself while ahead and null once it has passed', () => {
    const fd = entry({
      id: 'fd',
      kind: 'deadline',
      repeat: 'once',
      day: 15,
      month: 11,
      year: 2026,
    });
    expect(nextOccurrence(fd, at(2026, 9, 1))).toEqual(at(2026, 11, 15, 9, 0));
    expect(nextOccurrence(fd, at(2026, 11, 16))).toBeNull();
  });
});

describe('days until', () => {
  test('counts calendar days, and stays "today" after the reminder time', () => {
    const e = entry({ id: 'a' });
    expect(daysUntil(e, at(2026, 6, 13, 23, 0))).toBe(12);
    expect(daysUntil(e, at(2026, 6, 24))).toBe(1);
    expect(daysUntil(e, at(2026, 6, 25, 22, 0))).toBe(0);
    expect(daysUntil(e, at(2026, 6, 26))).toBe(364);
  });

  test('a past one-off has no countdown', () => {
    const fd = entry({ id: 'fd', repeat: 'once', year: 2026, day: 1, month: 1 });
    expect(daysUntil(fd, at(2026, 1, 1))).toBe(0);
    expect(daysUntil(fd, at(2026, 1, 2))).toBeNull();
  });

  test('countdown labels', () => {
    expect(countdownLabel(0)).toBe('Today');
    expect(countdownLabel(1)).toBe('Tomorrow');
    expect(countdownLabel(12)).toBe('In 12 days');
    expect(countdownLabel(null)).toBe('Past');
  });
});

describe('triggers', () => {
  test('"both" arms the day before and the day itself, at the chosen time', () => {
    const t = triggersFor(entry({ id: 'a' }), at(2026, 3, 1));
    expect(t.map(x => x.id)).toEqual(['date-a-before', 'date-a-on']);
    expect(t[0].timestamp).toBe(at(2026, 6, 24, 9, 0).getTime());
    expect(t[1].timestamp).toBe(at(2026, 6, 25, 9, 0).getTime());
  });

  test('"on" and "dayBefore" arm one trigger each', () => {
    expect(
      triggersFor(entry({ id: 'a', remind: 'on' }), at(2026, 3, 1)).map(
        x => x.id,
      ),
    ).toEqual(['date-a-on']);
    expect(
      triggersFor(entry({ id: 'a', remind: 'dayBefore' }), at(2026, 3, 1)).map(
        x => x.id,
      ),
    ).toEqual(['date-a-before']);
  });

  test('a day-before slot already behind us is skipped, the day itself still fires', () => {
    // 24 June 10:00 — the 09:00 heads-up is gone, tomorrow's still ahead.
    const t = triggersFor(entry({ id: 'a' }), at(2026, 6, 24, 10, 0));
    expect(t.map(x => x.id)).toEqual(['date-a-on']);
  });

  test('a day-before on 1 January reaches back into the old year', () => {
    const ny = entry({ id: 'ny', day: 1, month: 1, year: undefined });
    const t = triggersFor(ny, at(2026, 9, 1));
    expect(t[0].timestamp).toBe(at(2026, 12, 31, 9, 0).getTime());
    expect(t[1].timestamp).toBe(at(2027, 1, 1, 9, 0).getTime());
  });

  test('disabled entries and past one-offs arm nothing', () => {
    expect(triggersFor(entry({ id: 'a', enabled: false }), at(2026, 3, 1))).toEqual([]);
    expect(
      triggersFor(
        entry({ id: 'fd', repeat: 'once', year: 2020 }),
        at(2026, 3, 1),
      ),
    ).toEqual([]);
  });

  test('selectTriggers orders by time across entries and caps the count', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      entry({ id: `d${i}`, day: 1 + (i % 28), month: 1 + (i % 12) }),
    );
    const all = selectTriggers(many, at(2025, 12, 1), 1000);
    expect(all).toHaveLength(60);
    for (let i = 1; i < all.length; i++) {
      expect(all[i].timestamp).toBeGreaterThanOrEqual(all[i - 1].timestamp);
    }
    expect(selectTriggers(many, at(2025, 12, 1), 5)).toHaveLength(5);
    expect(MAX_DATE_TRIGGERS).toBeLessThanOrEqual(64);
  });
});

describe('what the notification says', () => {
  test('a birthday with a year says the age', () => {
    expect(notificationCopy(entry({ id: 'a' }), 'before', 2026)).toEqual({
      title: "🎂 Ajay's birthday",
      body: 'Tomorrow · turns 30',
    });
    expect(notificationCopy(entry({ id: 'a' }), 'on', 2026).body).toBe(
      'Today · turns 30',
    );
  });

  test('without a year there is no age', () => {
    expect(
      notificationCopy(entry({ id: 'a', year: undefined }), 'on', 2026).body,
    ).toBe('Today');
  });

  test('anniversaries and remembrance count years; deadlines just say when', () => {
    expect(
      notificationCopy(
        entry({ id: 'w', kind: 'anniversary', title: 'Wedding', year: 2016 }),
        'on',
        2026,
      ),
    ).toEqual({ title: '💍 Wedding', body: 'Today · 10 years' });
    expect(
      notificationCopy(
        entry({ id: 'g', kind: 'remembrance', title: 'Grandpa', year: 2021 }),
        'before',
        2026,
      ),
    ).toEqual({ title: '🕯 Grandpa', body: 'Tomorrow · 5 years' });
    expect(
      notificationCopy(
        entry({
          id: 'fd',
          kind: 'deadline',
          title: 'FD closes',
          repeat: 'once',
          year: 2026,
        }),
        'on',
        2026,
      ),
    ).toEqual({ title: '🏦 FD closes', body: 'Today' });
  });

  test('yearsOn is null for one-offs, missing years, and the birth year itself', () => {
    expect(yearsOn(entry({ id: 'a' }), 2026)).toBe(30);
    expect(yearsOn(entry({ id: 'a', year: undefined }), 2026)).toBeNull();
    expect(yearsOn(entry({ id: 'a', repeat: 'once', year: 2026 }), 2026)).toBeNull();
    expect(yearsOn(entry({ id: 'a', year: 2026 }), 2026)).toBeNull();
  });
});

describe('labels', () => {
  test('date and reminder labels', () => {
    expect(formatDateLabel(entry({ id: 'a' }))).toBe('25 June 1996');
    expect(formatDateLabel(entry({ id: 'a', year: undefined }))).toBe('25 June');
    expect(remindLabel(entry({ id: 'a' }))).toBe('Day before & on the day · 09:00');
    expect(remindLabel(entry({ id: 'a', remind: 'on', time: '18:00' }))).toBe(
      'On the day · 18:00',
    );
    expect(remindLabel(entry({ id: 'a', remind: 'dayBefore' }))).toBe(
      '1 day before · 09:00',
    );
  });

  test('upcoming sorts soonest first and parks past one-offs at the end', () => {
    const list = [
      entry({ id: 'far', day: 25, month: 12 }),
      entry({ id: 'past', repeat: 'once', year: 2026, day: 1, month: 1 }),
      entry({ id: 'soon', day: 3, month: 9, year: undefined }),
      entry({ id: 'today', day: 1, month: 9, year: undefined }),
    ];
    const rows = upcoming(list, at(2026, 9, 1));
    expect(rows.map(r => r.entry.id)).toEqual(['today', 'soon', 'far', 'past']);
    expect(rows[0].days).toBe(0);
    expect(rows[3].days).toBeNull();
  });
});

describe('validation', () => {
  test('accepts real calendar days, rejects the rest', () => {
    expect(validateDateParts({ day: 25, month: 6, repeat: 'yearly' })).toBeNull();
    expect(validateDateParts({ day: 29, month: 2, repeat: 'yearly' })).toBeNull();
    expect(
      validateDateParts({ day: 29, month: 2, year: 2025, repeat: 'yearly' }),
    ).toMatch(/2025/);
    expect(validateDateParts({ day: 31, month: 4, repeat: 'yearly' })).toBeTruthy();
    expect(validateDateParts({ day: 0, month: 6, repeat: 'yearly' })).toBeTruthy();
    expect(validateDateParts({ day: 5, month: 13, repeat: 'yearly' })).toBeTruthy();
  });

  test('a one-off needs a year', () => {
    expect(validateDateParts({ day: 15, month: 11, repeat: 'once' })).toMatch(/year/i);
    expect(
      validateDateParts({ day: 15, month: 11, year: 2026, repeat: 'once' }),
    ).toBeNull();
  });
});

describe('store slice', () => {
  beforeEach(() => useStore.getState().reset());

  test('add, update, remove', () => {
    const id = useStore.getState().addDate({
      title: "  Ajay's birthday ",
      kind: 'birthday',
      day: 25,
      month: 6,
      year: 1996,
      repeat: 'yearly',
      remind: 'dayBefore',
      time: '09:00',
    });
    expect(id).toMatch(/^date-/);
    const saved = useStore.getState().dates[0];
    expect(saved.title).toBe("Ajay's birthday");
    expect(saved.enabled).toBe(true);

    useStore.getState().updateDate(id, { remind: 'both', enabled: false });
    expect(useStore.getState().dates[0]).toMatchObject({
      remind: 'both',
      enabled: false,
    });

    useStore.getState().removeDate(id);
    expect(useStore.getState().dates).toEqual([]);
  });

  test('an empty title is not stored', () => {
    expect(
      useStore.getState().addDate({
        title: '   ',
        kind: 'other',
        day: 1,
        month: 1,
        repeat: 'yearly',
        remind: 'on',
        time: '09:00',
      }),
    ).toBe('');
    expect(useStore.getState().dates).toEqual([]);
  });

  test('v6 migration gives older installs an empty list; dates are backed up', () => {
    expect(migrateStore({ habits: [] }, 5)).toMatchObject({ dates: [] });
    const kept = migrateStore({ dates: [{ id: 'x' }] }, 5);
    expect(kept.dates).toEqual([{ id: 'x' }]);
    expect(DATA_KEYS).toContain('dates');
  });
});

describe('scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotifee.getNotificationSettings.mockResolvedValue({
      authorizationStatus: 1,
    });
    mockNotifee.getTriggerNotificationIds.mockResolvedValue([]);
    useStore.getState().reset();
  });

  test('resync arms every enabled entry silently — never prompts', async () => {
    await resyncDateReminders(
      [entry({ id: 'a' }), entry({ id: 'b', remind: 'on', enabled: false })],
      at(2026, 3, 1),
    );
    expect(mockNotifee.requestPermission).not.toHaveBeenCalled();
    const ids = mockNotifee.createTriggerNotification.mock.calls.map(
      (c: [{ id: string }]) => c[0].id,
    );
    expect(ids).toEqual(['date-a-before', 'date-a-on']);
  });

  test('without permission nothing is scheduled and nothing prompts', async () => {
    mockNotifee.getNotificationSettings.mockResolvedValue({
      authorizationStatus: 0,
    });
    await resyncDateReminders([entry({ id: 'a' })], at(2026, 3, 1));
    expect(mockNotifee.requestPermission).not.toHaveBeenCalled();
    expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
  });

  test('stale date-* triggers are cancelled; other triggers are left alone', async () => {
    mockNotifee.getTriggerNotificationIds.mockResolvedValue([
      'date-gone-on',
      'date-a-before',
      'reminder-habit1',
      'evening-recap',
    ]);
    await resyncDateReminders([entry({ id: 'a', remind: 'on' })], at(2026, 3, 1));
    const cancelled = mockNotifee.cancelNotification.mock.calls.map(
      (c: [string]) => c[0],
    );
    expect(cancelled.sort()).toEqual(['date-a-before', 'date-gone-on']);
    expect(dateNotificationIds('a')).toEqual(['date-a-on', 'date-a-before']);
  });

  test('the trigger carries the copy and a plain timestamp trigger', async () => {
    await resyncDateReminders([entry({ id: 'a', remind: 'on' })], at(2026, 3, 1));
    const [notification, trigger] =
      mockNotifee.createTriggerNotification.mock.calls[0];
    expect(notification).toMatchObject({
      id: 'date-a-on',
      title: "🎂 Ajay's birthday",
      body: 'Today · turns 30',
    });
    expect(trigger).toEqual({
      type: 0,
      timestamp: at(2026, 6, 25, 9, 0).getTime(),
    });
  });
});
