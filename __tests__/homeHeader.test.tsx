/**
 * @format
 *
 * Home's header carries the greeting and a one-line status — never the quote
 * of the day (that lives on the first-open interstitial and the widget).
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import HomeScreen from '../src/screens/HomeScreen';
import { useStore } from '../src/store/useStore';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useFocusEffect: () => undefined,
}));

jest.mock('../src/services/quotes', () => ({
  ...jest.requireActual('../src/services/quotes'),
  getDailyQuote: jest.fn(async () => ({
    text: 'Well begun is half done.',
    author: 'Aristotle',
    date: '2026-09-01',
    source: 'zenquotes',
  })),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const isText = (t: unknown): boolean =>
  t === 'Text' || (t as { displayName?: string } | null)?.displayName === 'Text';

const textsOf = (root: ReactTestInstance): string[] =>
  root
    .findAll(n => isText(n.type))
    .flatMap(n =>
      (Array.isArray(n.props.children) ? n.props.children : [n.props.children])
        .filter((c: unknown) => typeof c === 'string')
        .map((c: string) => c),
    );

test('the header greets and never shows the quote of the day', async () => {
  useStore.getState().reset();
  useStore.setState({ onboarded: true, user: { name: 'Aj', surname: '', email: '' } } as never);
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <HomeScreen />
      </SafeAreaProvider>,
    );
  });
  // Let the quote promise settle — the widget still needs it in the store.
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const labels = r.root
    .findAll(n => typeof n.props.accessibilityLabel === 'string')
    .map(n => n.props.accessibilityLabel as string);
  expect(labels.some(l => /Quote of the day/i.test(l))).toBe(false);
  const texts = textsOf(r.root).join(' ');
  expect(texts).not.toMatch(/Aristotle|Well begun/);
  expect(texts).toMatch(/make habits together/);
  expect(useStore.getState().dailyQuote?.author).toBe('Aristotle');
  await ReactTestRenderer.act(() => r.unmount());
});
