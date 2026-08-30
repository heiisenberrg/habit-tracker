/**
 * Routiner design tokens, extracted from the Figma community file.
 * Light/dark aware: on iOS every token is a DynamicColorIOS pair, so colors
 * resolve natively per appearance — including inside StyleSheet.create styles
 * frozen at module load. The Settings toggle drives Appearance.setColorScheme.
 * (Android falls back to the light palette until a theming pass lands there.)
 */
import {
  ColorValue,
  DynamicColorIOS,
  Platform,
  TextStyle,
  ViewStyle,
} from 'react-native';

const C = (light: string, dark: string): ColorValue =>
  Platform.OS === 'ios' ? DynamicColorIOS({ light, dark }) : light;

export const colors = {
  black: '#000000',
  /** Pure white — text on brand gradients; never theme-flipped. */
  white: '#FFFFFF',
  /** Card / sheet background (white ↔ dark surface). */
  surface: C('#FFFFFF', '#171826'),
  background: C('#F6F9FF', '#0E0F17'),
  ink: C('#040415', '#F2F2F7'), // Black 100
  ink60: C('#686873', '#A8A8B8'),
  ink40: C('#9B9BA1', '#8A8A99'),
  ink20: C('#CDCDD0', '#3E3F52'),
  ink10: C('#EAECF0', '#252638'),
  // Borders must be static: DynamicColorIOS doesn't resolve on border props
  // under Fabric and falls back to black. Translucent gray reads as a light
  // hairline on white and a lifted hairline on dark surfaces.
  border: 'rgba(138,143,168,0.28)',
  borderStrong: 'rgba(138,143,168,0.55)',
  blue: '#3843FF', // Blue 100 — brand, both modes
  blue40: '#AFB4FF',
  blue10: C('#EBECFF', '#252A5C'),
  info10: C('#DDF2FC', '#173248'),
  green: '#3BA935',
  red: '#E3524F',
  // Blue gradient endpoints, sampled from the provided splash/onboarding artwork
  gradientStart: '#706CFF',
  gradientEnd: '#0516FF',
} as const;

export const gradients = {
  blue: [colors.gradientStart, colors.gradientEnd] as [string, string],
};

const family = Platform.select({ ios: 'System', default: 'sans-serif' });

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

/** Typography scale (Airbnb Cereal Book=400 / Medium=500 / Bold=700). */
export const type = {
  h5: font(24, 32, '700', -1),
  h6: font(20, 24, '500'),
  title: font(18, 24, '500'),
  bodyMedium: font(14, 20, '500'),
  body: font(14, 20, '400'),
  alt: font(12, 16, '400'),
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

/** Shadows/Box Shadow: #232C5D at 6%, radius 68 — approximated for RN. */
export const cardShadow: ViewStyle = {
  shadowColor: '#232C5D',
  shadowOpacity: 0.06,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 10 },
  elevation: 3,
};

export const screenPadding = spacing.xl;
