/**
 * @format
 *
 * Quote of the day: exactly one network request per day, cached by date;
 * a failed day falls back to the bundled list and retries at most hourly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { FALLBACK_QUOTES } from '../src/data/quotes';
import {
  fallbackQuote,
  getDailyQuote,
  parseZenQuotesToday,
  QUOTE_CACHE_KEY,
  RETRY_BACKOFF_MS,
  ZENQUOTES_TODAY_URL,
} from '../src/services/quotes';

const ok = (body: unknown) =>
  Promise.resolve({ json: () => Promise.resolve(body) } as Response);
const zen = (q: string, a = 'Mae West') => [
  { q, a, h: '<blockquote/>', date: '2026-08-31' },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  NativeModules.WidgetBridge = undefined;
  (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn();
});

test('parseZenQuotesToday accepts the [{q,a}] shape and rejects garbage', () => {
  expect(parseZenQuotesToday(zen('Begin.'), '2026-08-31')).toEqual({
    text: 'Begin.',
    author: 'Mae West',
    date: '2026-08-31',
    source: 'zenquotes',
  });
  expect(parseZenQuotesToday([], '2026-08-31')).toBeNull();
  expect(parseZenQuotesToday({ q: 'x' }, '2026-08-31')).toBeNull();
  expect(parseZenQuotesToday([{ q: '   ' }], '2026-08-31')).toBeNull();
  expect(
    parseZenQuotesToday([{ q: 'x'.repeat(241), a: 'y' }], '2026-08-31'),
  ).toBeNull();
  expect(parseZenQuotesToday([{ q: 'No author' }], '2026-08-31')?.author).toBe(
    'Unknown',
  );
});

test('one request per day: second call on the same day hits the cache', async () => {
  const fetchMock = globalThis.fetch as jest.Mock;
  fetchMock.mockReturnValue(
    ok(zen('The score never interested me, only the game.')),
  );
  const now = new Date('2026-08-31T09:00:00');
  const first = await getDailyQuote(now);
  const second = await getDailyQuote(new Date('2026-08-31T21:30:00'));
  expect(first.source).toBe('zenquotes');
  expect(second).toEqual(first);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe(ZENQUOTES_TODAY_URL);
  // a new calendar day → one new request
  fetchMock.mockReturnValue(
    ok(
      zen(
        'To a mind that is still, the entire universe surrenders.',
        'Zhuangzi',
      ),
    ),
  );
  const next = await getDailyQuote(new Date('2026-09-01T07:00:00'));
  expect(next.date).toBe('2026-09-01');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('offline: bundled fallback, cached, and retried at most hourly', async () => {
  const fetchMock = globalThis.fetch as jest.Mock;
  fetchMock.mockRejectedValue(new Error('offline'));
  const t0 = new Date('2026-08-31T09:00:00');
  const q1 = await getDailyQuote(t0);
  expect(q1.source).toBe('bundled');
  expect(q1).toEqual(fallbackQuote('2026-08-31'));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  // 10 minutes later: no new request, same bundled line
  const q2 = await getDailyQuote(new Date(t0.getTime() + 10 * 60 * 1000));
  expect(q2).toEqual(q1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  // back online after the backoff: the real quote replaces the fallback
  fetchMock.mockReturnValue(ok(zen('Well begun is half done.', 'Aristotle')));
  const q3 = await getDailyQuote(new Date(t0.getTime() + RETRY_BACKOFF_MS + 1));
  expect(q3.source).toBe('zenquotes');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(
    JSON.parse((await AsyncStorage.getItem(QUOTE_CACHE_KEY)) as string),
  ).toEqual(q3);
});

test('malformed payload also falls back instead of throwing', async () => {
  (globalThis.fetch as jest.Mock).mockReturnValue(
    ok({ error: 'rate limited' }),
  );
  const q = await getDailyQuote(new Date('2026-08-31T09:00:00'));
  expect(q.source).toBe('bundled');
});

test('fallback is deterministic per day and cycles the bundled list', () => {
  expect(fallbackQuote('2026-08-31')).toEqual(fallbackQuote('2026-08-31'));
  expect(fallbackQuote('2026-01-01').text).toBe(FALLBACK_QUOTES[0].text);
  expect(fallbackQuote('2026-01-02').text).toBe(FALLBACK_QUOTES[1].text);
  expect(FALLBACK_QUOTES.every(q => q.text.length <= 140 && q.author)).toBe(
    true,
  );
});

test('a quote the widget already fetched today is reused — no request from the app', async () => {
  const fetchMock = globalThis.fetch as jest.Mock;
  NativeModules.WidgetBridge = {
    getDailyQuote: jest.fn(async () =>
      JSON.stringify({
        text: 'Great acts are made up of small deeds.',
        author: 'Lao Tzu',
        date: '2026-08-31',
        source: 'zenquotes',
      }),
    ),
  };
  const q = await getDailyQuote(new Date('2026-08-31T08:00:00'));
  expect(q.author).toBe('Lao Tzu');
  expect(q.source).toBe('zenquotes');
  expect(fetchMock).not.toHaveBeenCalled();
  // yesterday's widget quote is ignored
  NativeModules.WidgetBridge = {
    getDailyQuote: jest.fn(async () =>
      JSON.stringify({ text: 'old', author: 'x', date: '2026-08-30' }),
    ),
  };
  await AsyncStorage.clear();
  fetchMock.mockReturnValue(ok(zen('Fresh.')));
  const q2 = await getDailyQuote(new Date('2026-08-31T08:00:00'));
  expect(q2.text).toBe('Fresh.');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
