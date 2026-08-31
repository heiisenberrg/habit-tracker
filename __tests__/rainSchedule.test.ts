/**
 * @format
 *
 * checkRainForSchedule end to end with a mocked forecast: a rainy hour over
 * a scheduled block produces exactly one heads-up through the passive
 * displayNotification wrapper (default weather channel, never a prompt).
 */
jest.mock('../src/services/weather', () => ({
  ...jest.requireActual('../src/services/weather'),
  getHourlyForecast: jest.fn(async () => [
    { time: '2026-08-22T18:00', prob: 70, code: 61 },
    { time: '2026-08-22T19:00', prob: 75, code: 61 },
  ]),
}));
jest.mock('../src/services/notifications', () => ({
  displayNotification: jest.fn(async () => true),
  scheduleOneOffNotification: jest.fn(async () => true),
  cancelNotificationById: jest.fn(async () => undefined),
}));

import { checkRainForSchedule } from '../src/services/rainAlerts';
import {
  displayNotification,
  scheduleOneOffNotification,
} from '../src/services/notifications';

// 16:00 — the block at 18:00 is ahead AND its pre-warning slot is still in the future.
const NOW = new Date('2026-08-22T16:00:00');

test('a rainy hour over a scheduled block notifies once, via the passive wrapper', async () => {
  const planner = [
    {
      id: 'g',
      date: '2026-08-22',
      title: 'Evening run',
      time: '18:00–19:00',
      type: 'block' as const,
      done: false,
    },
  ];
  const first = await checkRainForSchedule(planner, [], NOW);
  expect(first.map(w => w.id)).toEqual(['g']);
  expect(displayNotification).toHaveBeenCalledTimes(1);
  const [id, title] = (displayNotification as jest.Mock).mock.calls[0];
  expect(id).toBe('rain-g');
  expect(title).toBe('Weather heads-up');
  // No passive flag any more — the wrapper is passive by construction.
  expect((displayNotification as jest.Mock).mock.calls[0]).toHaveLength(3);
  expect(scheduleOneOffNotification).toHaveBeenCalled();

  // Same day, same item → deduped.
  const second = await checkRainForSchedule(planner, [], NOW);
  expect(second).toEqual([]);
  expect(displayNotification).toHaveBeenCalledTimes(1);
});
