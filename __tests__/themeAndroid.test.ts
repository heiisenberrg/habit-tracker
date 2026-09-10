/// <reference types="node" />
/**
 * @format
 *
 * Android dark mode: the theme's dynamic tokens are PlatformColor('@color/…')
 * references backed by res/values/colors.xml (light) and
 * res/values-night/colors.xml (dark). Those XML files are hand-written, so
 * this test pins them to DYNAMIC_TOKENS — a pair edited on one side only
 * fails here instead of shipping a mismatched Android palette.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PlatformColor } from 'react-native';
import {
  colors,
  DYNAMIC_TOKENS,
  DynamicToken,
  staticColor,
  toAndroidHex,
} from '../src/theme/theme';

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

const RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const parseColors = (file: string): Record<string, string> => {
  const xml = fs.readFileSync(file, 'utf8');
  const out: Record<string, string> = {};
  for (const m of xml.matchAll(
    /<color name="([^"]+)">\s*([^<\s]+)\s*<\/color>/g,
  )) {
    out[m[1]] = m[2].toUpperCase();
  }
  return out;
};

const light = parseColors(path.join(RES, 'values', 'colors.xml'));
const night = parseColors(path.join(RES, 'values-night', 'colors.xml'));
const tokens = Object.keys(DYNAMIC_TOKENS) as DynamicToken[];

test.each(tokens)(
  '%s carries the exact light/dark pair in both colors.xml',
  token => {
    expect(light[token]).toBe(toAndroidHex(DYNAMIC_TOKENS[token].light));
    expect(night[token]).toBe(toAndroidHex(DYNAMIC_TOKENS[token].dark));
  },
);

test('every colour named in one qualifier exists in the other', () => {
  // A night-only or light-only entry would silently fall back to the other
  // scheme's value on device.
  expect(Object.keys(night).sort()).toEqual(Object.keys(light).sort());
});

test('on Android every dynamic token is its @color reference', () => {
  for (const token of tokens) {
    expect(colors[token]).toEqual(PlatformColor(`@color/${token}`));
  }
});

test('borders and brand colours stay static strings', () => {
  // DynamicColorIOS/PlatformColor cannot travel through border props under
  // Fabric, and the brand red is the same in both schemes.
  expect(typeof colors.border).toBe('string');
  expect(typeof colors.borderStrong).toBe('string');
  expect(typeof colors.blue).toBe('string');
  expect(typeof colors.red).toBe('string');
});

test('toAndroidHex moves the alpha byte first and uppercases', () => {
  expect(toAndroidHex('#000000B3')).toBe('#B3000000');
  expect(toAndroidHex('#ffffffb3')).toBe('#B3FFFFFF');
  expect(toAndroidHex('#ffffff')).toBe('#FFFFFF');
});

test('staticColor resolves a plain hex for the given scheme', () => {
  expect(staticColor('surface', 'dark')).toBe('#232323');
  expect(staticColor('surface', 'light')).toBe('#FFFFFF');
  // Unknown scheme (no override yet) reads as light, the app's boot value.
  expect(staticColor('surface', null)).toBe('#FFFFFF');
});
