/**
 * @format
 *
 * Boot/background schedulers must never raise the OS permission prompt.
 * Regression for the first-run gap where the evening recap (and rain
 * heads-ups) requested permission over the splash screen of a brand-new
 * user. Only user-initiated reminder creation may prompt.
 */
jest.mock('@notifee/react-native', () => {
  const api = {
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 0 })),
    createTriggerNotification: jest.fn(async () => 'id'),
    displayNotification: jest.fn(async () => 'id'),
    cancelNotification: jest.fn(async () => undefined),
    createChannel: jest.fn(async () => 'weather'),
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

// The factory above runs when notifications.ts requires notifee (imports are
// hoisted), so grab the same instance back instead of a top-level const.
const mockNotifee = jest.requireMock('@notifee/react-native').default;

import {
  displayNotification,
  RECAP_CHANNEL,
  scheduleDailyReminder,
  scheduleOneOffNotification,
} from '../src/services/notifications';
import { scheduleRecap } from '../src/services/recap';
import { useStore } from '../src/store/useStore';

beforeEach(() => {
  jest.clearAllMocks();
  mockNotifee.getNotificationSettings.mockResolvedValue({
    authorizationStatus: 0,
  });
  useStore.getState().reset();
});

const meditate = {
  id: 'm',
  name: 'Meditate',
  emoji: '🧘',
  type: 'good',
  goal: { amount: 1, unit: 'TIMES' },
  step: 1,
  friendIds: [],
  tracking: 'check',
  kind: 'build',
};

test('scheduleRecap never calls requestPermission, even with content', async () => {
  useStore.setState({
    prefs: { ...useStore.getState().prefs, recap: true },
    habits: [meditate],
  } as never);
  await scheduleRecap(new Date('2026-08-30T10:00:00'));
  expect(mockNotifee.requestPermission).not.toHaveBeenCalled();
  expect(mockNotifee.getNotificationSettings).toHaveBeenCalled();
  // Not granted → nothing scheduled, silently.
  expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
});

test('recap toggled off cancels instead of scheduling', async () => {
  mockNotifee.getNotificationSettings.mockResolvedValue({
    authorizationStatus: 1,
  });
  useStore.setState({
    prefs: { ...useStore.getState().prefs, recap: false },
    habits: [meditate],
  } as never);
  await scheduleRecap(new Date('2026-08-30T10:00:00'));
  expect(mockNotifee.createTriggerNotification).not.toHaveBeenCalled();
  expect(mockNotifee.cancelNotification).toHaveBeenCalledWith('evening-recap');
});

test('passive wrappers schedule only when already granted and never prompt', async () => {
  expect(await displayNotification('y', 't', 'b')).toBe(false);
  expect(await scheduleOneOffNotification('x', 't', 'b', 1)).toBe(false);
  expect(mockNotifee.requestPermission).not.toHaveBeenCalled();

  mockNotifee.getNotificationSettings.mockResolvedValue({
    authorizationStatus: 1,
  });
  expect(await scheduleOneOffNotification('x', 't', 'b', 1)).toBe(true);
  expect(await displayNotification('y', 't', 'b')).toBe(true);
  expect(mockNotifee.requestPermission).not.toHaveBeenCalled();
});

test('recap uses its own Android channel, weather keeps its own', async () => {
  mockNotifee.getNotificationSettings.mockResolvedValue({
    authorizationStatus: 1,
  });
  await scheduleOneOffNotification('x', 't', 'b', 1, RECAP_CHANNEL);
  expect(mockNotifee.createChannel).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: 'recap' }),
  );
  await displayNotification('y', 't', 'b');
  expect(mockNotifee.createChannel).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: 'weather' }),
  );
});

test('user-initiated reminder creation prompts; boot resync does not', async () => {
  await scheduleDailyReminder('h1', 'Meditate', '09:00');
  expect(mockNotifee.requestPermission).toHaveBeenCalledTimes(1);
  await scheduleDailyReminder('h1', 'Meditate', '09:00', { silent: true });
  expect(mockNotifee.requestPermission).toHaveBeenCalledTimes(1);
  expect(mockNotifee.getNotificationSettings).toHaveBeenCalled();
});
