/**
 * @format
 *
 * Accessibility contract (eng review 2026-08-31): every icon-only control is
 * a named element, containers that hold controls do not merge them, and the
 * habit card exposes two elements — the body (opens details) and Log.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import HabitCard from '../src/components/HabitCard';
import { Card, IconButton } from '../src/components/common';
import TasksSection from '../src/components/home/TasksSection';
import GroceryScreen from '../src/screens/GroceryScreen';
import SettingsScreen from '../src/screens/SettingsScreen';
import { Habit } from '../src/data/seed';
import { useStore } from '../src/store/useStore';

jest.mock('@react-navigation/native', () => {
  const ReactActual = jest.requireActual('react');
  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
    // SettingsScreen re-checks permissions on focus; run the effect once.
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactActual.useEffect(() => {
        const cleanup = effect();
        return typeof cleanup === 'function' ? cleanup : undefined;
      }, []);
    },
  };
});

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const labelsOf = (root: ReactTestInstance) =>
  root
    .findAll(n => typeof n.props.accessibilityLabel === 'string')
    .map(n => n.props.accessibilityLabel as string);

const render = async (el: React.ReactElement) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(el);
  });
  return r;
};

const plants: Habit = {
  id: 'p',
  name: 'Water Plants',
  emoji: '🌿',
  type: 'good',
  goal: { amount: 1, unit: 'TIMES' },
  step: 1,
  friendIds: [],
  tracking: 'check',
  kind: 'build',
};

describe('HabitCard', () => {
  test('exposes a body button and a separate Log button; container does not merge', async () => {
    const r = await render(
      <HabitCard
        habit={plants}
        amount={0}
        onPress={() => {}}
        onIncrement={() => {}}
      />,
    );
    const labels = labelsOf(r.root);
    expect(labels).toContain('Log Water Plants');
    expect(labels).toContain('Water Plants, 0 of 1 TIMES, opens details');
    expect(
      r.root.findAll(n => n.props.accessible === false).length,
    ).toBeGreaterThan(0);
  });

  test('done state renames the action', async () => {
    const r = await render(
      <HabitCard
        habit={plants}
        amount={1}
        onPress={() => {}}
        onIncrement={() => {}}
      />,
    );
    expect(labelsOf(r.root)).toContain('Water Plants completed');
  });
});

describe('IconButton / Card primitives', () => {
  test('IconButton carries role + label', async () => {
    const r = await render(
      <IconButton accessibilityLabel="Back" onPress={() => {}}>
        <></>
      </IconButton>,
    );
    // The host view (not the composite) carries the role.
    expect(
      r.root.findAll(
        n =>
          n.props.accessibilityLabel === 'Back' &&
          n.props.accessibilityRole === 'button',
      ).length,
    ).toBeGreaterThan(0);
  });

  test('Card passes accessible={false} through to its Pressable', async () => {
    const r = await render(
      <Card onPress={() => {}} accessible={false}>
        <></>
      </Card>,
    );
    expect(
      r.root.findAll(n => n.props.accessible === false).length,
    ).toBeGreaterThan(0);
  });
});

describe('TasksSection', () => {
  test('checkbox, postpone and delete are named; checkbox exposes checked state', async () => {
    const tasks = [
      {
        id: 't',
        date: '2026-08-31',
        title: 'Standup',
        time: '',
        type: 'task' as const,
        done: false,
      },
    ];
    const r = await render(
      <TasksSection
        tasks={tasks}
        onToggle={() => {}}
        onMove={() => {}}
        onDelete={() => {}}
      />,
    );
    const labels = labelsOf(r.root);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Mark Standup done',
        'Postpone Standup one day',
        'Delete Standup',
      ]),
    );
    const box = r.root.findAll(
      n => n.props.accessibilityLabel === 'Mark Standup done',
    )[0];
    expect(box.props.accessibilityRole).toBe('checkbox');
    expect(box.props.accessibilityState).toEqual({ checked: false });
  });
});

describe('SettingsScreen', () => {
  test('every switch and the back button are named', async () => {
    const r = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <SettingsScreen />
      </SafeAreaProvider>,
    );
    const labels = labelsOf(r.root);
    for (const name of [
      'Back',
      'Dark Mode',
      'Sounds',
      'Vacation Mode',
      'Evening recap',
      'Weather & rain alerts',
      'Apple Health',
      'Device Calendar',
      'App Lock',
      'Zen runs iOS Focus',
    ]) {
      expect(labels).toContain(name);
    }
    await ReactTestRenderer.act(() => {
      r.unmount();
    });
  });
});

describe('GroceryScreen', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  test('empty state names its controls and offers a way to start', async () => {
    const r = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <GroceryScreen />
      </SafeAreaProvider>,
    );
    const labels = labelsOf(r.root);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Manage stores',
        'Add something to buy',
        'Add to list',
      ]),
    );
    await ReactTestRenderer.act(() => {
      r.unmount();
    });
  });

  test('a list line is a labelled checkbox with a named remove button', async () => {
    useStore.getState().addListItem({ name: 'Milk', note: 'skimmed' });
    const r = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <GroceryScreen />
      </SafeAreaProvider>,
    );
    const line = useStore.getState().grocery.list[0];
    // A Pressable matches at several layers: the host carries the a11y props,
    // the composite carries onPress.
    const box = r.root.findAll(
      n =>
        n.props.accessibilityRole === 'checkbox' &&
        n.props.accessibilityLabel === 'Milk',
    );
    const host = box.find(n => typeof n.type === 'string')!;
    const pressable = box.find(n => typeof n.props.onPress === 'function')!;
    expect(host.props.accessibilityState).toEqual({ checked: false });
    expect(labelsOf(r.root)).toContain('Remove Milk');

    // Ticking on the hub marks it bought without inventing a price.
    await ReactTestRenderer.act(() => {
      pressable.props.onPress();
    });
    expect(useStore.getState().grocery.list[0].done).toBe(true);
    expect(line.id).toBe(useStore.getState().grocery.list[0].id);
    await ReactTestRenderer.act(() => {
      r.unmount();
    });
  });
});
