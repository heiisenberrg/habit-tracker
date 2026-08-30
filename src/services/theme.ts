/**
 * Native dark/light override. RN's Appearance.setColorScheme misses windows
 * not attached to a UIWindowScene (our classic AppDelegate window), so the
 * ThemeManager native module overrides every window and persists the choice
 * in UserDefaults for styled cold launches.
 */
import { NativeModules } from 'react-native';

export const applyInterfaceStyle = (style: 'dark' | 'light'): void => {
  NativeModules.ThemeManager?.setStyle?.(style);
};
