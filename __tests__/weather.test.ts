/**
 * @format
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  describeWeatherCode,
  getCurrentWeather,
  isFresh,
  parseOpenMeteo,
  POSITION_CACHE_KEY,
  WEATHER_CACHE_KEY,
  WEATHER_TTL_MS,
} from '../src/services/weather';

jest.mock(
  '@react-native-community/geolocation',
  () => ({
    getCurrentPosition: (_ok: unknown, err: (e: { code: number }) => void) =>
      err({ code: 1 }),
  }),
  { virtual: true },
);

test('describes clear, cloudy and overcast WMO codes', () => {
  expect(describeWeatherCode(0)).toEqual({ emoji: '☀️', label: 'Clear' });
  expect(describeWeatherCode(1)).toEqual({
    emoji: '🌤️',
    label: 'Mostly clear',
  });
  expect(describeWeatherCode(2)).toEqual({
    emoji: '⛅️',
    label: 'Partly cloudy',
  });
  expect(describeWeatherCode(3)).toEqual({ emoji: '☁️', label: 'Overcast' });
});

test('groups drizzle, rain and showers as rain', () => {
  for (const code of [51, 55, 61, 65, 66, 80, 82]) {
    expect(describeWeatherCode(code)).toEqual({ emoji: '🌧️', label: 'Rain' });
  }
});

test('describes fog, snow and thunderstorm codes', () => {
  expect(describeWeatherCode(45)).toEqual({ emoji: '🌫️', label: 'Fog' });
  expect(describeWeatherCode(48)).toEqual({ emoji: '🌫️', label: 'Fog' });
  for (const code of [71, 75, 77, 85, 86]) {
    expect(describeWeatherCode(code)).toEqual({ emoji: '❄️', label: 'Snow' });
  }
  for (const code of [95, 96, 99]) {
    expect(describeWeatherCode(code)).toEqual({
      emoji: '⛈️',
      label: 'Thunderstorm',
    });
  }
});

test('falls back to overcast for unknown codes', () => {
  expect(describeWeatherCode(42)).toEqual({ emoji: '☁️', label: 'Overcast' });
  expect(describeWeatherCode(-1)).toEqual({ emoji: '☁️', label: 'Overcast' });
});

test('cache is fresh strictly within the TTL window', () => {
  const now = 1_700_000_000_000;
  expect(isFresh(now - WEATHER_TTL_MS + 1, now)).toBe(true);
  expect(isFresh(now, now)).toBe(true);
  expect(isFresh(now - WEATHER_TTL_MS, now)).toBe(false);
  expect(isFresh(now - WEATHER_TTL_MS * 2, now)).toBe(false);
});

test('parses an Open-Meteo current-weather payload', () => {
  const payload = {
    current: { temperature_2m: 23.6, weather_code: 61 },
  };
  expect(parseOpenMeteo(payload, 1_700_000_000_000)).toEqual({
    temp: 24,
    emoji: '🌧️',
    label: 'Rain',
    fetchedAt: 1_700_000_000_000,
  });
});

test('returns null for malformed payloads', () => {
  expect(parseOpenMeteo(null, 0)).toBeNull();
  expect(parseOpenMeteo({}, 0)).toBeNull();
  expect(parseOpenMeteo({ current: { weather_code: 3 } }, 0)).toBeNull();
});

test('serves a fresh cache without hitting the network', async () => {
  const cached = { temp: 21, emoji: '☀️', label: 'Clear', fetchedAt: 1000 };
  await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cached));
  const fetchSpy = jest.fn();
  (globalThis as any).fetch = fetchSpy;

  const result = await getCurrentWeather(1000 + WEATHER_TTL_MS - 1);

  expect(result).toEqual(cached);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test('falls back to the last known position when GPS fails', async () => {
  await AsyncStorage.removeItem(WEATHER_CACHE_KEY);
  await AsyncStorage.setItem(
    POSITION_CACHE_KEY,
    JSON.stringify({ lat: 13.08, lon: 80.27 }),
  );
  const fetchSpy = jest.fn().mockResolvedValue({
    json: async () => ({ current: { temperature_2m: 30.2, weather_code: 2 } }),
  });
  (globalThis as any).fetch = fetchSpy;

  const result = await getCurrentWeather(5_000_000);

  expect(fetchSpy).toHaveBeenCalledWith(
    expect.stringContaining('latitude=13.08'),
  );
  expect(result).toMatchObject({ temp: 30, label: 'Partly cloudy' });
  await AsyncStorage.removeItem(POSITION_CACHE_KEY);
  await AsyncStorage.removeItem(WEATHER_CACHE_KEY);
});

test('falls back to stale cache when location is unavailable', async () => {
  const stale = { temp: 18, emoji: '🌧️', label: 'Rain', fetchedAt: 1000 };
  await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(stale));
  const fetchSpy = jest.fn();
  (globalThis as any).fetch = fetchSpy;

  const result = await getCurrentWeather(1000 + WEATHER_TTL_MS * 10);

  expect(result).toEqual(stale);
  expect(fetchSpy).not.toHaveBeenCalled();
});
