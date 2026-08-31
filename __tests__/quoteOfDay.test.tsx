/**
 * @format
 *
 * First open of the day: splash → QuoteOfDay (30 s or Continue) → Main, once
 * per calendar day; returning users on the same day go straight to Main.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer, { act } from 'react-test-renderer';
import QuoteOfDayScreen, {
  QUOTE_DWELL_MS,
  routeAfterSplash,
} from '../src/screens/QuoteOfDayScreen';
import { todayKey, useStore } from '../src/store/useStore';

const mockNavReset = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    reset: mockNavReset,
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));
jest.mock('../src/services/quotes', () => ({
  ...jest.requireActual('../src/services/quotes'),
  getDailyQuote: jest.fn(async () => ({
    text: 'Well begun is half done.',
    author: 'Aristotle',
    date: '2026-08-31',
    source: 'zenquotes',
  })),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('routeAfterSplash', () => {
  test('new user → Onboarding regardless of the quote flag', () => {
    expect(routeAfterSplash(false, null, '2026-08-31')).toBe('Onboarding');
    expect(routeAfterSplash(false, '2026-08-31', '2026-08-31')).toBe(
      'Onboarding',
    );
  });
  test('returning user: first open of the day → QuoteOfDay, later → Main', () => {
    expect(routeAfterSplash(true, null, '2026-08-31')).toBe('QuoteOfDay');
    expect(routeAfterSplash(true, '2026-08-30', '2026-08-31')).toBe(
      'QuoteOfDay',
    );
    expect(routeAfterSplash(true, '2026-08-31', '2026-08-31')).toBe('Main');
  });
});

describe('QuoteOfDayScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavReset.mockClear();
    useStore.getState().reset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const render = async () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <QuoteOfDayScreen />
        </SafeAreaProvider>,
      );
    });
    return r;
  };

  test('auto-advances to Main after the dwell and marks the day', async () => {
    const r = await render();
    expect(mockNavReset).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(QUOTE_DWELL_MS + 10);
    });
    expect(mockNavReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Main' }],
    });
    expect(useStore.getState().quoteShownOn).toBe(todayKey());
    expect(useStore.getState().dailyQuote?.author).toBe('Aristotle');
    await act(async () => {
      r.unmount();
    });
  });

  test('Continue skips the wait; the timer cannot fire a second reset', async () => {
    const r = await render();
    const btn = r.root.findAll(
      n =>
        n.props.accessibilityLabel === 'Continue' &&
        n.props.accessibilityRole === 'button',
    )[0];
    await act(async () => {
      btn.props.onPress();
    });
    expect(mockNavReset).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(QUOTE_DWELL_MS + 10);
    });
    expect(mockNavReset).toHaveBeenCalledTimes(1);
    await act(async () => {
      r.unmount();
    });
  });
});
