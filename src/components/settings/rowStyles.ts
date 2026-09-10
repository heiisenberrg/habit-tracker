import { StyleSheet } from 'react-native';
import { cardShadow, colors, radius, spacing } from '../../theme/theme';

/**
 * The Settings screen's group/row vocabulary, shared with the section
 * components under src/components/settings so every extracted section
 * renders pixel-identical to the inline rows in SettingsScreen.tsx.
 */
export const settingsStyles = StyleSheet.create({
  flex: { flex: 1 },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
