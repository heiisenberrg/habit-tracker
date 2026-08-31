/**
 * Quote of the day. Live source: ZenQuotes `/api/today` (free, keyless; one
 * quote per calendar day; attribution link required — the Home subtitle opens
 * it). Budget: ONE network request per day — the result is cached by date;
 * a day whose fetch failed retries at most hourly and shows a bundled
 * public-domain line meanwhile. Nothing about the user is sent.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { DailyQuote, FALLBACK_QUOTES } from '../data/quotes';
import { toDateKey } from '../store/useStore';

export type { DailyQuote } from '../data/quotes';

export const QUOTE_CACHE_KEY = 'quote:daily';
export const QUOTE_ATTEMPT_KEY = 'quote:lastAttempt';
export const ZENQUOTES_TODAY_URL = 'https://zenquotes.io/api/today';
export const ZENQUOTES_ATTRIBUTION_URL = 'https://zenquotes.io/';
/** A failed day retries no more than once an hour. */
export const RETRY_BACKOFF_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

/** ZenQuotes shape: `[{ q, a, h, date? }]`. Anything else → null. */
export const parseZenQuotesToday = (
  payload: unknown,
  date: string,
): DailyQuote | null => {
  const first = Array.isArray(payload) ? payload[0] : null;
  if (!first || typeof first !== 'object') {
    return null;
  }
  const q = typeof first.q === 'string' ? first.q.trim() : '';
  const a = typeof first.a === 'string' ? first.a.trim() : '';
  if (!q || q.length > 240) {
    return null;
  }
  return { text: q, author: a || 'Unknown', date, source: 'zenquotes' };
};

/** Same day → same bundled line (day-of-year index). */
export const fallbackQuote = (date: string): DailyQuote => {
  const d = new Date(`${date}T00:00`);
  const start = new Date(d.getFullYear(), 0, 1);
  const day = Math.max(
    0,
    Math.round((d.getTime() - start.getTime()) / 86400000),
  );
  const q = FALLBACK_QUOTES[day % FALLBACK_QUOTES.length];
  return { ...q, date, source: 'bundled' };
};

const readJson = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeJson = async (key: string, value: unknown): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // cache is best-effort
  }
};

const fetchWithTimeout = async (url: string): Promise<unknown> => {
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(
      url,
      controller ? { signal: controller.signal } : {},
    );
    return await res.json();
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

/**
 * The lock-screen widget may have fetched today's quote first (its timeline
 * runs at midnight); it leaves it in the App Group under `dailyQuote`. Reading
 * it here keeps the whole device at one request per day.
 */
const widgetQuoteForDate = async (date: string): Promise<DailyQuote | null> => {
  try {
    const raw: string | null | undefined =
      await NativeModules.WidgetBridge?.getDailyQuote?.();
    const q = raw ? (JSON.parse(raw) as Partial<DailyQuote>) : null;
    if (
      q &&
      q.date === date &&
      typeof q.text === 'string' &&
      q.text.trim() &&
      typeof q.author === 'string'
    ) {
      return { text: q.text, author: q.author, date, source: 'zenquotes' };
    }
  } catch {
    // no bridge (Android/tests) or unreadable value — fall through
  }
  return null;
};

export const getDailyQuote = async (now = new Date()): Promise<DailyQuote> => {
  const date = toDateKey(now);
  const cached = await readJson<DailyQuote>(QUOTE_CACHE_KEY);
  if (cached?.date === date && cached.source === 'zenquotes') {
    return cached; // today's real quote — no request
  }
  const fromWidget = await widgetQuoteForDate(date);
  if (fromWidget) {
    await writeJson(QUOTE_CACHE_KEY, fromWidget);
    return fromWidget; // the widget already spent today's request
  }
  const lastAttempt = await readJson<number>(QUOTE_ATTEMPT_KEY);
  if (lastAttempt && now.getTime() - lastAttempt < RETRY_BACKOFF_MS) {
    return cached?.date === date ? cached : fallbackQuote(date);
  }
  await writeJson(QUOTE_ATTEMPT_KEY, now.getTime());
  try {
    const quote = parseZenQuotesToday(
      await fetchWithTimeout(ZENQUOTES_TODAY_URL),
      date,
    );
    if (quote) {
      await writeJson(QUOTE_CACHE_KEY, quote);
      return quote;
    }
  } catch {
    // offline / blocked / slow — fall through to the bundled line
  }
  const fallback = fallbackQuote(date);
  await writeJson(QUOTE_CACHE_KEY, fallback);
  return fallback;
};
