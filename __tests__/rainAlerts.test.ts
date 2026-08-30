/**
 * @format
 */
import {
  filterNotNotified,
  findRainWarnings,
  formatHour,
  preWarnTimestamp,
  scheduleFromPersisted,
  upcomingItems,
} from '../src/services/rainAlerts';
import { parseHourly } from '../src/services/weather';

const NOW = new Date('2026-08-22T17:30:00');

test('parseHourly zips Open-Meteo hourly arrays into entries', () => {
  const payload = {
    hourly: {
      time: ['2026-08-22T18:00', '2026-08-22T19:00'],
      precipitation_probability: [10, 70],
      weather_code: [2, 61],
    },
  };
  expect(parseHourly(payload)).toEqual([
    { time: '2026-08-22T18:00', prob: 10, code: 2 },
    { time: '2026-08-22T19:00', prob: 70, code: 61 },
  ]);
});

test('parseHourly returns empty for malformed payloads', () => {
  expect(parseHourly(null)).toEqual([]);
  expect(parseHourly({})).toEqual([]);
  expect(parseHourly({ hourly: { time: ['2026-08-22T18:00'] } })).toEqual([]);
});

test('upcomingItems picks today’s undone timed tasks still ahead', () => {
  const planner = [
    {
      id: 'g',
      date: '2026-08-22',
      title: 'Go grocery shopping',
      time: '19:00',
      type: 'task' as const,
      done: false,
    },
    {
      id: 'done',
      date: '2026-08-22',
      title: 'Done already',
      time: '20:00',
      type: 'task' as const,
      done: true,
    },
    {
      id: 'past',
      date: '2026-08-22',
      title: 'This morning',
      time: '09:00',
      type: 'task' as const,
      done: false,
    },
    {
      id: 'anytime',
      date: '2026-08-22',
      title: 'No time set',
      time: '',
      type: 'task' as const,
      done: false,
    },
    {
      id: 'tomorrow',
      date: '2026-08-23',
      title: 'Not today',
      time: '19:00',
      type: 'task' as const,
      done: false,
    },
    {
      id: 'block',
      date: '2026-08-22',
      title: 'Focus block',
      time: '18:30–19:30',
      type: 'block' as const,
      done: false,
    },
  ];
  expect(upcomingItems(planner, [], NOW)).toEqual([
    { id: 'g', title: 'Go grocery shopping', hour: 19, dateKey: '2026-08-22' },
    { id: 'block', title: 'Focus block', hour: 18, dateKey: '2026-08-22' },
  ]);
});

test('upcomingItems includes enabled habit reminders still ahead', () => {
  const habits = [
    {
      id: 'run',
      name: 'Evening run',
      reminder: { time: '21:00', enabled: true },
    },
    { id: 'off', name: 'Read', reminder: { time: '22:00', enabled: false } },
    { id: 'am', name: 'Meditate', reminder: { time: '07:00', enabled: true } },
    { id: 'none', name: 'Stretch' },
  ];
  expect(upcomingItems([], habits, NOW)).toEqual([
    { id: 'run', title: 'Evening run', hour: 21, dateKey: '2026-08-22' },
  ]);
});

test('warns when the task hour crosses the rain threshold', () => {
  const items = [
    { id: 'g', title: 'Go grocery shopping', hour: 19, dateKey: '2026-08-22' },
  ];
  const entries = [{ time: '2026-08-22T19:00', prob: 70, code: 61 }];
  expect(findRainWarnings(items, entries)).toEqual([
    {
      id: 'g',
      title: 'Go grocery shopping',
      hour: 19,
      prob: 70,
      emoji: '🌧️',
      label: 'Rain',
    },
  ]);
});

test('stays quiet below the threshold with a dry weather code', () => {
  const items = [
    { id: 'g', title: 'Groceries', hour: 19, dateKey: '2026-08-22' },
  ];
  expect(
    findRainWarnings(items, [{ time: '2026-08-22T19:00', prob: 20, code: 2 }]),
  ).toEqual([]);
  expect(
    findRainWarnings(items, [{ time: '2026-08-22T20:00', prob: 90, code: 61 }]),
  ).toEqual([]);
});

test('warns at exactly 40% and on precipitation codes at low probability', () => {
  const items = [
    { id: 'g', title: 'Groceries', hour: 19, dateKey: '2026-08-22' },
  ];
  expect(
    findRainWarnings(items, [{ time: '2026-08-22T19:00', prob: 40, code: 2 }]),
  ).toHaveLength(1);
  const thunder = findRainWarnings(items, [
    { time: '2026-08-22T19:00', prob: 10, code: 95 },
  ]);
  expect(thunder).toHaveLength(1);
  expect(thunder[0].label).toBe('Thunderstorm');
});

test('formats hours in 12-hour clock', () => {
  expect(formatHour(0)).toBe('12 AM');
  expect(formatHour(9)).toBe('9 AM');
  expect(formatHour(12)).toBe('12 PM');
  expect(formatHour(19)).toBe('7 PM');
});

test('preWarnTimestamp lands an hour before the task', () => {
  expect(preWarnTimestamp('2026-08-22', 19, NOW)).toBe(
    new Date('2026-08-22T18:00:00').getTime(),
  );
});

test('preWarnTimestamp is null when that moment is past or too close', () => {
  // pre-warn for an 18:00 task would be 17:00 — already behind 17:30
  expect(preWarnTimestamp('2026-08-22', 18, NOW)).toBeNull();
  // at 17:55, the 18:00 pre-warn for a 19:00 task is only 5 min away
  expect(
    preWarnTimestamp('2026-08-22', 19, new Date('2026-08-22T17:55:00')),
  ).toBeNull();
});

test('scheduleFromPersisted extracts planner and habits from store JSON', () => {
  const task = {
    id: 'g',
    date: '2026-08-22',
    title: 'Groceries',
    time: '19:00',
    type: 'task',
    done: false,
  };
  const habit = {
    id: 'run',
    name: 'Evening run',
    reminder: { time: '21:00', enabled: true },
  };
  const raw = JSON.stringify({
    state: { planner: [task], habits: [habit] },
    version: 0,
  });
  expect(scheduleFromPersisted(raw)).toEqual({
    planner: [task],
    habits: [habit],
  });
});

test('scheduleFromPersisted returns an empty schedule for bad JSON', () => {
  expect(scheduleFromPersisted(null)).toEqual({ planner: [], habits: [] });
  expect(scheduleFromPersisted('nonsense')).toEqual({
    planner: [],
    habits: [],
  });
  expect(scheduleFromPersisted('{}')).toEqual({ planner: [], habits: [] });
});

test('filterNotNotified drops warnings already sent today', () => {
  const warnings = [
    { id: 'a', title: 'A', hour: 18, prob: 50, emoji: '🌧️', label: 'Rain' },
    { id: 'b', title: 'B', hour: 19, prob: 60, emoji: '🌧️', label: 'Rain' },
  ];
  const record = { a: '2026-08-22', b: '2026-08-21' };
  expect(filterNotNotified(warnings, record, '2026-08-22')).toEqual([
    warnings[1],
  ]);
});
