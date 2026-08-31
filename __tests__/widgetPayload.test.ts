/**
 * @format
 *
 * The consolidated sharedState payload carries today's quote and the offline
 * list, so the lock-screen widget never spends a second request per day.
 */
import { NativeModules } from 'react-native';
import { FALLBACK_QUOTES } from '../src/data/quotes';
import { pushStreakToWidget } from '../src/services/widget';
import { useStore } from '../src/store/useStore';

test('payload includes quote + fallbackQuotes; null quote stays explicit', () => {
  const setSharedState = jest.fn();
  NativeModules.WidgetBridge = { setSharedState };
  useStore.getState().reset();
  const s = useStore.getState();
  pushStreakToWidget({
    ...s,
    dailyQuote: {
      text: 'Well begun is half done.',
      author: 'Aristotle',
      date: '2026-08-31',
      source: 'zenquotes',
    },
  });
  const payload = JSON.parse(setSharedState.mock.calls[0][0]);
  expect(payload.quote).toEqual({
    text: 'Well begun is half done.',
    author: 'Aristotle',
    date: '2026-08-31',
    source: 'zenquotes',
  });
  expect(payload.fallbackQuotes).toHaveLength(FALLBACK_QUOTES.length);
  expect(payload.streak).toBe(0);

  pushStreakToWidget({ ...s, dailyQuote: null });
  expect(JSON.parse(setSharedState.mock.calls[1][0]).quote).toBeNull();
});
