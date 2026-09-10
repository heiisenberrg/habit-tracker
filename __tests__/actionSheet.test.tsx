/**
 * @format
 *
 * Android has no ActionSheetIOS, so showActionSheet drives the themed bottom
 * sheet <ActionSheetHost/> renders. Selection, destructive styling, and
 * dismissal (backdrop / back button → the cancel index) are the contract
 * every caller relies on; iOS must still reach the native sheet untouched.
 */
import React from 'react';
import { ActionSheetIOS, Modal, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer, { ReactTestInstance } from 'react-test-renderer';
import {
  ActionSheetHost,
  showActionSheet,
} from '../src/components/ActionSheet';
import { colors } from '../src/theme/theme';

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'android',
    Version: 34,
    isTV: false,
    isVision: false,
    isTesting: true,
    constants: {
      isTesting: true,
      reactNativeVersion: { major: 0, minor: 87, patch: 0 },
    },
    select: (spec: Record<string, unknown>) =>
      'android' in spec
        ? spec.android
        : 'native' in spec
        ? spec.native
        : spec.default,
  },
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const OPTS = {
  title: 'Zen until 18:30',
  message: 'Reminders pause and your locked apps stay shielded.',
  options: ['End zen early', 'Keep going'],
  destructiveButtonIndex: 0,
  cancelButtonIndex: 1,
};

let renderer: ReactTestRenderer.ReactTestRenderer;

const mount = async () => {
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ActionSheetHost />
      </SafeAreaProvider>,
    );
  });
};

afterEach(async () => {
  await ReactTestRenderer.act(() => renderer?.unmount());
});

const open = async (
  opts: Parameters<typeof showActionSheet>[0],
  onSelect: (i: number) => void,
) => {
  await ReactTestRenderer.act(() => {
    showActionSheet(opts, onSelect);
  });
};

/** The composite element that owns the press handler for a testID/label. */
const pressable = (
  root: ReactTestInstance,
  match: (p: Record<string, unknown>) => boolean,
): ReactTestInstance =>
  root.findAll(n => typeof n.props.onPress === 'function' && match(n.props))[0];

const press = async (node: ReactTestInstance) => {
  await ReactTestRenderer.act(() => {
    node.props.onPress();
  });
};

const optionNodes = (root: ReactTestInstance) =>
  root.findAll(
    n =>
      typeof n.props.testID === 'string' &&
      n.props.testID.startsWith('action-sheet-option-') &&
      typeof n.props.onPress === 'function',
  );

const isText = (t: unknown): boolean => t === 'Text';

const textColor = (root: ReactTestInstance, label: string) => {
  const t = root.findAll(
    n => isText(n.type) && n.props.children === label,
  )[0];
  return StyleSheet.flatten(t.props.style).color;
};

test('picking an option reports its index and closes the sheet', async () => {
  await mount();
  const onSelect = jest.fn();
  await open(OPTS, onSelect);
  const root = renderer.root;
  expect(optionNodes(root)).toHaveLength(1); // cancel is drawn separately
  await press(pressable(root, p => p.testID === 'action-sheet-option-0'));
  expect(onSelect).toHaveBeenCalledWith(0);
  expect(optionNodes(root)).toHaveLength(0);
});

test('header and cancel render; destructive option is red', async () => {
  await mount();
  await open(OPTS, jest.fn());
  const root = renderer.root;
  expect(root.findAll(n => n.props.children === OPTS.title)).not.toHaveLength(
    0,
  );
  expect(
    root.findAll(n => n.props.children === OPTS.message),
  ).not.toHaveLength(0);
  expect(textColor(root, 'End zen early')).toBe(colors.red);
  expect(textColor(root, 'Keep going')).not.toBe(colors.red);
});

test('cancel row, backdrop and back button all report the cancel index', async () => {
  await mount();
  const root = renderer.root;

  const viaCancel = jest.fn();
  await open(OPTS, viaCancel);
  await press(pressable(root, p => p.testID === 'action-sheet-cancel'));
  expect(viaCancel).toHaveBeenCalledWith(1);

  const viaBackdrop = jest.fn();
  await open(OPTS, viaBackdrop);
  await press(pressable(root, p => p.accessibilityLabel === 'Dismiss'));
  expect(viaBackdrop).toHaveBeenCalledWith(1);

  const viaBack = jest.fn();
  await open(OPTS, viaBack);
  await ReactTestRenderer.act(() => {
    root.findByType(Modal).props.onRequestClose();
  });
  expect(viaBack).toHaveBeenCalledWith(1);
  expect(optionNodes(root)).toHaveLength(0);
});

test('without a cancel button a dismissal reports one past the last option', async () => {
  await mount();
  const onSelect = jest.fn();
  await open({ options: ['15 minutes', '30 minutes'] }, onSelect);
  const root = renderer.root;
  expect(optionNodes(root)).toHaveLength(2);
  expect(root.findAll(n => n.props.testID === 'action-sheet-cancel')).toEqual(
    [],
  );
  await press(pressable(root, p => p.accessibilityLabel === 'Dismiss'));
  expect(onSelect).toHaveBeenCalledWith(2);
});

test('a call with no host mounted answers as a dismissal', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const onSelect = jest.fn();
  showActionSheet(OPTS, onSelect);
  expect(onSelect).toHaveBeenCalledWith(1);
  warn.mockRestore();
});

test('iOS still goes to the native ActionSheetIOS', async () => {
  const native = jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation(() => {});
  Platform.OS = 'ios';
  try {
    await mount();
    const onSelect = jest.fn();
    showActionSheet(OPTS, onSelect);
    expect(native).toHaveBeenCalledWith(OPTS, onSelect);
    expect(renderer.root.findAllByType(Modal)).toEqual([]);
  } finally {
    Platform.OS = 'android';
    native.mockRestore();
  }
});
