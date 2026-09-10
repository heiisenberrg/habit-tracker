/**
 * Native dark/light override, both platforms.
 *  - iOS: RN's Appearance.setColorScheme misses windows not attached to a
 *    UIWindowScene (our classic AppDelegate window), so ThemeManager
 *    overrides every window and persists the choice in UserDefaults.
 *  - Android: ThemeManager persists the choice in SharedPreferences so the
 *    next cold start inflates the right night resources before JS hydrates
 *    (the tokens are PlatformColor resources — see theme/theme.ts).
 * Both persist for styled cold launches; the runtime flip itself is driven
 * by Appearance.setColorScheme in App.tsx.
 */
import { NativeModules } from 'react-native';

export const applyInterfaceStyle = (style: 'dark' | 'light'): void => {
  NativeModules.ThemeManager?.setStyle?.(style);
};
