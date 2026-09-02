/**
 * @format
 *
 * The Home mood emoji means "set my mood". Tapping it must not also offer the
 * assistant and the habit builders.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer, { ReactTestInstance, act } from 'react-test-renderer';
import { MOOD_FACES } from '../src/data/seed';
import QuickActionsScreen from '../src/screens/QuickActionsScreen';
import { todayKey, useStore } from '../src/store/useStore';

const mockGoBack = jest.fn();
let mockRouteParams: object | undefined;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: mockGoBack,
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const textOf = (root: ReactTestInstance) =>
  root
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string)
    .join(' | ');

const render = async () => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <QuickActionsScreen />
      </SafeAreaProvider>,
    );
  });
  return r;
};

describe('QuickActionsScreen', () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    useStore.getState().reset();
  });

  test('only: mood shows the mood picker and nothing else', async () => {
    mockRouteParams = { only: 'mood' };
    const r = await render();
    const text = textOf(r.root);
    expect(text).toContain('Add Mood');
    expect(text).not.toContain('Ask Assistant');
    expect(text).not.toContain('Quit Bad Habit');
    expect(text).not.toContain('New Good Habit');
    expect(text).not.toContain('Quick add');
    await act(async () => {
      r.unmount();
    });
  });

  test('picking a face sets the mood for today and closes', async () => {
    mockRouteParams = { only: 'mood' };
    const r = await render();
    const face = MOOD_FACES[1];
    const button = r.root
      .findAll(n => n.props.accessibilityLabel === `Set mood ${face}`)
      .find(n => typeof n.props.onPress === 'function')!;
    await act(async () => {
      button.props.onPress();
    });
    expect(useStore.getState().mood).toBe(face);
    expect(useStore.getState().moods[todayKey()]).toBe(face);
    expect(mockGoBack).toHaveBeenCalled();
    await act(async () => {
      r.unmount();
    });
  });

  test('without the flag the full sheet still renders', async () => {
    mockRouteParams = undefined;
    const r = await render();
    const text = textOf(r.root);
    expect(text).toContain('Ask Assistant');
    expect(text).toContain('Quit Bad Habit');
    expect(text).toContain('New Good Habit');
    expect(text).toContain('Add Mood');
    await act(async () => {
      r.unmount();
    });
  });
});
