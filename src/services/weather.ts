/**
 * Current weather for the Home chip. Data: Open-Meteo (free, keyless);
 * position: device GPS via @react-native-community/geolocation. Readings
 * cache in AsyncStorage for 30 min, and any failure (no permission, no
 * network, bad payload) serves the last cached reading so callers
 * degrade gracefully.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

let Geolocation: any = null;
try {
  const mod = require('@react-native-community/geolocation');
  Geolocation = mod.default ?? mod;
} catch {
  Geolocation = null;
}

export type Weather = {
  /** °C, rounded */
  temp: number;
  emoji: string;
  label: string;
  /** epoch ms of the reading */
  fetchedAt: number;
};

export const WEATHER_CACHE_KEY = 'weather:cache';
export const WEATHER_TTL_MS = 30 * 60 * 1000;

export const isFresh = (fetchedAt: number, now: number): boolean =>
  now - fetchedAt < WEATHER_TTL_MS;

/** WMO weather code (Open-Meteo `weather_code`) -> chip emoji + label. */
export const describeWeatherCode = (
  code: number,
): { emoji: string; label: string } => {
  if (code === 0) {
    return { emoji: '☀️', label: 'Clear' };
  }
  if (code === 1) {
    return { emoji: '🌤️', label: 'Mostly clear' };
  }
  if (code === 2) {
    return { emoji: '⛅️', label: 'Partly cloudy' };
  }
  if (code === 45 || code === 48) {
    return { emoji: '🌫️', label: 'Fog' };
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { emoji: '🌧️', label: 'Rain' };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { emoji: '❄️', label: 'Snow' };
  }
  if (code === 95 || code === 96 || code === 99) {
    return { emoji: '⛈️', label: 'Thunderstorm' };
  }
  return { emoji: '☁️', label: 'Overcast' };
};

export const parseOpenMeteo = (
  payload: any,
  fetchedAt: number,
): Weather | null => {
  const temp = payload?.current?.temperature_2m;
  const code = payload?.current?.weather_code;
  if (typeof temp !== 'number' || typeof code !== 'number') {
    return null;
  }
  return { temp: Math.round(temp), ...describeWeatherCode(code), fetchedAt };
};

export const POSITION_CACHE_KEY = 'weather:lastPos';

type Position = { lat: number; lon: number };

const getLivePosition = (): Promise<Position | null> =>
  new Promise(resolve => {
    if (typeof Geolocation?.getCurrentPosition !== 'function') {
      resolve(null);
      return;
    }
    try {
      Geolocation.getCurrentPosition(
        (pos: { coords: { latitude: number; longitude: number } }) =>
          resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 10000, maximumAge: 10 * 60 * 1000 },
      );
    } catch {
      resolve(null);
    }
  });

/**
 * Live GPS fix when possible, else the last known position — background
 * wake-ups can't always get a fresh fix, and weather for a slightly old
 * location beats no weather at all.
 */
const getPosition = async (): Promise<Position | null> => {
  const live = await getLivePosition();
  if (live) {
    AsyncStorage.setItem(POSITION_CACHE_KEY, JSON.stringify(live)).catch(
      () => {},
    );
    return live;
  }
  try {
    const raw = await AsyncStorage.getItem(POSITION_CACHE_KEY);
    const pos = raw ? JSON.parse(raw) : null;
    return typeof pos?.lat === 'number' && typeof pos?.lon === 'number'
      ? pos
      : null;
  } catch {
    return null;
  }
};

export type HourlyEntry = {
  /** Local-time hour, e.g. "2026-08-22T19:00" (Open-Meteo timezone=auto) */
  time: string;
  /** Precipitation probability 0..100 */
  prob: number;
  /** WMO weather code */
  code: number;
};

export const HOURLY_CACHE_KEY = 'weather:hourly';

export const parseHourly = (payload: any): HourlyEntry[] => {
  const times = payload?.hourly?.time;
  const probs = payload?.hourly?.precipitation_probability;
  const codes = payload?.hourly?.weather_code;
  if (!Array.isArray(times) || !Array.isArray(probs) || !Array.isArray(codes)) {
    return [];
  }
  return times.map((time: string, i: number) => ({
    time,
    prob: probs[i] ?? 0,
    code: codes[i] ?? 0,
  }));
};

/** Today's hour-by-hour precipitation outlook, cached like current weather. */
export const getHourlyForecast = async (
  now = Date.now(),
): Promise<HourlyEntry[]> => {
  let cached: { entries: HourlyEntry[]; fetchedAt: number } | null = null;
  try {
    const raw = await AsyncStorage.getItem(HOURLY_CACHE_KEY);
    cached = raw ? JSON.parse(raw) : null;
  } catch {
    cached = null;
  }
  if (cached && isFresh(cached.fetchedAt, now)) {
    return cached.entries;
  }

  const pos = await getPosition();
  if (!pos) {
    return cached?.entries ?? [];
  }
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&hourly=precipitation_probability,weather_code&forecast_days=1&timezone=auto`,
    );
    const entries = parseHourly(await res.json());
    if (!entries.length) {
      return cached?.entries ?? [];
    }
    await AsyncStorage.setItem(
      HOURLY_CACHE_KEY,
      JSON.stringify({ entries, fetchedAt: now }),
    );
    return entries;
  } catch {
    return cached?.entries ?? [];
  }
};

/** Cached-or-live current weather, or null when nothing is available. */
export const getCurrentWeather = async (
  now = Date.now(),
): Promise<Weather | null> => {
  let cached: Weather | null = null;
  try {
    const raw = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
    cached = raw ? (JSON.parse(raw) as Weather) : null;
  } catch {
    cached = null;
  }
  if (cached && isFresh(cached.fetchedAt, now)) {
    return cached;
  }

  const pos = await getPosition();
  if (!pos) {
    return cached;
  }
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current=temperature_2m,weather_code`,
    );
    const weather = parseOpenMeteo(await res.json(), now);
    if (!weather) {
      return cached;
    }
    await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(weather));
    return weather;
  } catch {
    return cached;
  }
};
