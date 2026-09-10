/**
 * @format
 *
 * Boot: the native launch screen and the JS splash must read as ONE splash —
 * the JS screen only gates on store hydration and then routes at once. Any
 * artificial dwell shows a second, different-looking splash.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import SplashScreen from '../src/screens/SplashScreen';
import { useStore } from '../src/store/useStore';

const mockReset = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ reset: mockReset, navigate: jest.fn() }),
}));

beforeEach(() => {
  jest.useFakeTimers();
  mockReset.mockClear();
  useStore.getState().reset();
});

afterEach(() => jest.useRealTimers());

test('routes as soon as the store has hydrated — no dwell', async () => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(<SplashScreen />);
  });
  // Flush hydration (AsyncStorage mock resolves on the microtask queue).
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(useStore.persist.hasHydrated()).toBe(true);
  // Only timers of 0 ms may run: a returning splash must not linger.
  await ReactTestRenderer.act(() => {
    jest.advanceTimersByTime(0);
  });
  expect(mockReset).toHaveBeenCalledTimes(1);
  expect(mockReset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: 'Onboarding' }],
  });
  await ReactTestRenderer.act(() => r.unmount());
});
