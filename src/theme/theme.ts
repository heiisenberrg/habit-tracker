/**
 * Slay design tokens — REWORKED 2026-09 to the system the user extracted
 * from a Netflix-style audit: #E50914 accent, #161616/#232323/#2D2D2D dark
 * surfaces, white text with a 70% secondary, Helvetica Neue at a 16px-dominant
 * scale (400/500/700). Dark mode is the system's native home; light mode maps
 * the same roles onto white/neutral grays.
 *
 * Light/dark aware: every dynamic token is a native colour reference, so it
 * resolves per appearance even inside StyleSheet.create styles frozen at
 * module load. iOS wraps the pair in DynamicColorIOS; Android points at
 * `@color/<token>` and the SAME pairs live in res/values/colors.xml (light)
 * and res/values-night/colors.xml (dark) — __tests__/themeAndroid.test.ts
 * pins the XML to DYNAMIC_TOKENS so the two can't drift. The Settings toggle
 * drives Appearance.setColorScheme; on Android that flips night resources,
 * and App.tsx remounts the navigator so already-created views (which keep
 * their resolved colour ints) pick the new values up.
 *
 * LEGACY KEY NAMES: `blue`, `blue40`, `blue10` and `gradients.blue` now carry
 * the brand RED — ~30 files reference the keys, so the values changed and the
 * names did not. A rename sweep is a mechanical follow-up if wanted.
 */
import {
  Appearance,
  ColorValue,
  DynamicColorIOS,
  Platform,
  PlatformColor,
  TextStyle,
  ViewStyle,
} from 'react-native';

/**
 * The light/dark hex behind every dynamic token — the single source both
 * platforms are generated from. Keys double as the Android resource names
 * (`@color/<key>`), so renaming one means renaming it in both colors.xml.
 */
export const DYNAMIC_TOKENS = {
  /** Card / sheet background (white ↔ #232323 from the audit). */
  surface: { light: '#FFFFFF', dark: '#232323' },
  background: { light: '#F5F5F5', dark: '#161616' },
  ink: { light: '#000000', dark: '#FFFFFF' },
  /** The audit's #ffffffb3 secondary, mirrored for light. */
  ink60: { light: '#000000B3', dark: '#FFFFFFB3' },
  /**
   * Glyphs, dividers and disabled affordances only — NOT for text under
   * 16pt (use ink60). Carried over from design review 2026-08-31, 10A.
   */
  ink40: { light: '#8C8C8C', dark: '#808080' },
  ink20: { light: '#D9D9D9', dark: '#404040' },
  ink10: { light: '#E6E6E6', dark: '#2D2D2D' },
  blue10: { light: '#FDECEC', dark: '#3A1D1F' },
  info10: { light: '#EDEDED', dark: '#333333' },
} as const;

export type DynamicToken = keyof typeof DYNAMIC_TOKENS;

const C = (token: DynamicToken): ColorValue => {
  const { light, dark } = DYNAMIC_TOKENS[token];
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({ light, dark });
  }
  if (Platform.OS === 'android') {
    return PlatformColor(`@color/${token}`);
  }
  return light;
};

/**
 * Plain hex for a dynamic token, picked for the scheme in force right now.
 * Only for the few props a native colour reference cannot travel through
 * (string-built SVG xml, colour maths, string concatenation); everywhere
 * else use `colors.<token>` so the value re-resolves natively.
 */
export const staticColor = (
  token: DynamicToken,
  scheme: 'light' | 'dark' | null | undefined = Appearance.getColorScheme(),
): string => DYNAMIC_TOKENS[token][scheme === 'dark' ? 'dark' : 'light'];

/**
 * RN writes alpha last (#RRGGBBAA); Android resources want it first
 * (#AARRGGBB). Shared with the XML-drift test so both sides agree on the
 * exact string colors.xml must carry.
 */
export const toAndroidHex = (hex: string): string => {
  const h = hex.toUpperCase();
  return h.length === 9 ? `#${h.slice(7, 9)}${h.slice(1, 7)}` : h;
};

export const colors = {
  black: '#000000',
  /** Pure white — text on brand fills; never theme-flipped. */
  white: '#FFFFFF',
  // Dynamic tokens — see DYNAMIC_TOKENS for the pairs and their roles.
  surface: C('surface'),
  background: C('background'),
  ink: C('ink'),
  ink60: C('ink60'),
  ink40: C('ink40'),
  ink20: C('ink20'),
  ink10: C('ink10'),
  // Borders must be static: DynamicColorIOS doesn't resolve on border props
  // under Fabric and falls back to black. #808080-based hairlines read on
  // both surfaces (the audit's lone border color).
  border: 'rgba(128,128,128,0.35)',
  borderStrong: 'rgba(128,128,128,0.6)',
  blue: '#E50914', // BRAND (legacy key name) — the audit's accent red
  blue40: '#F0777D',
  blue10: C('blue10'),
  info10: C('info10'),
  green: '#3BA935',
  /** Destructive — same hue family as brand, as the source system does. */
  red: '#E50914',
  // Brand gradient endpoints: accent red into its pressed/deep step.
  gradientStart: '#E50914',
  gradientEnd: '#B20710',
} as const;

/**
 * Chart steps: ONE hue, two steps (selected vs the rest) — the charts show a
 * single measure, so identity comes from labels, not from more hues. Each
 * pair re-validated with the dataviz validator against its own surface after
 * the red rework: light #E50914/#8E262B (ΔE 17.6, both ≥3:1 on #FFFFFF) and
 * dark #F6121D/#C86F88 (ΔE 15.3, both ≥3:1 on #232323; the off step leans
 * rose because the dark lightness band caps same-hue separation). CVD
 * separation sits in the 6–8 relief band, which is legal here because every
 * column carries a direct value label. Literal hex — picked per scheme at
 * render time.
 */
export const chartSteps = {
  light: { on: '#E50914', off: '#8E262B' },
  dark: { on: '#F6121D', off: '#C86F88' },
} as const;

export const gradients = {
  blue: [colors.gradientStart, colors.gradientEnd] as [string, string],
};

// The audit's stack is "Netflix Sans", Helvetica Neue, …, sans-serif.
// Netflix Sans isn't shipped on iOS, so the honest resolution is the next
// name in the stack: Helvetica Neue on iOS, Roboto (sans-serif) on Android.
const family = Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' });

const font = (
  size: number,
  lineHeight: number,
  weight: TextStyle['fontWeight'],
  letterSpacing = 0,
): TextStyle => ({
  fontFamily: family,
  fontSize: size,
  lineHeight,
  fontWeight: weight,
  letterSpacing,
});

/**
 * Typography scale from the audit: 16px/400 dominant (lh 21), 24px headers,
 * 14px secondary, 10px chips; weights 400/500/700 only, no letterspacing.
 */
export const type = {
  h5: font(24, 30, '700'),
  h6: font(20, 24, '500'),
  title: font(16, 21, '700'),
  bodyMedium: font(16, 21, '500'),
  body: font(16, 21, '400'),
  alt: font(14, 18, '400'),
  chip: { ...font(10, 16, '700', 1), textTransform: 'uppercase' as const },
} as const;

export type TypeVariant = keyof typeof type;

export const radius = { sm: 12, md: 16, lg: 24, xl: 32, pill: 100 } as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Neutral card shadow — soft on white, near-invisible on #161616 (by design). */
export const cardShadow: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 3,
};

export const screenPadding = spacing.xl;
