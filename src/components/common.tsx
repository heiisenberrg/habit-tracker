import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
  ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppText from './AppText';
import { cardShadow, colors, gradients, radius, spacing } from '../theme/theme';

/** White rounded card with hairline border + soft shadow (Routiner card base). */
export function Card({
  style,
  children,
  onPress,
}: {
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

/** 48pt (default) square bordered icon button, e.g. header calendar/notification. */
export function IconButton({
  children,
  onPress,
  size = 48,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size },
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Primary full-width gradient pill button. */
export function PrimaryButton({
  label,
  onPress,
  style,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}) {
  // LinearGradient needs literal colors, so resolve the disabled gray per
  // scheme here (a light pill on a dark screen reads as enabled).
  const disabledFill = useColorScheme() === 'dark' ? '#2E3040' : '#C9CAD6';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.pressed,
        style,
      ]}
    >
      <LinearGradient
        colors={disabled ? [disabledFill, disabledFill] : gradients.blue}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.gradientFill}
      />
      <AppText variant="bodyMedium" color={colors.white}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Secondary (white bordered) full-width pill button. */
export function SecondaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.pressed,
        style,
      ]}
    >
      <AppText variant="bodyMedium">{label}</AppText>
    </Pressable>
  );
}

/** Two-tab segmented control (e.g. Today / Clubs). */
export function SegmentControl({
  tabs,
  active,
  onChange,
  badges,
}: {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
  badges?: (string | number | undefined)[];
}) {
  return (
    <View style={styles.segment}>
      {tabs.map((tab, i) => (
        <Pressable
          key={tab}
          onPress={() => onChange(i)}
          style={[styles.segmentTab, i === active && styles.segmentTabActive]}
        >
          <AppText
            variant="bodyMedium"
            color={i === active ? colors.blue : colors.ink60}
          >
            {tab}
          </AppText>
          {badges?.[i] != null && (
            <View style={styles.segmentBadge}>
              <AppText variant="chip" color={colors.blue}>
                {badges[i]}
              </AppText>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** Overlapping avatar row with optional "+N" tail chip. */
export function AvatarStack({
  sources,
  extra,
  size = 28,
}: {
  sources: ImageSourcePropType[];
  extra?: number;
  size?: number;
}) {
  return (
    <View style={styles.avatarRow}>
      {sources.map((source, i) => (
        <Image
          key={i}
          source={source}
          style={[
            styles.avatar,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: i === 0 ? 0 : -8,
            },
          ]}
        />
      ))}
      {extra != null && extra > 0 && (
        <View
          style={[
            styles.avatarExtra,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -8,
            },
          ]}
        >
          <AppText variant="chip" color={colors.blue}>
            +{extra}
          </AppText>
        </View>
      )}
    </View>
  );
}

/** Section header row: title + "VIEW ALL" action. */
export function SectionHeader({
  title,
  onViewAll,
}: {
  title: string;
  onViewAll?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="bodyMedium" style={styles.sectionTitle}>
        {title}
      </AppText>
      {onViewAll && (
        <Pressable onPress={onViewAll} hitSlop={8}>
          <AppText variant="chip" color={colors.blue}>
            View All
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...cardShadow,
  },
  pressed: { opacity: 0.7 },
  iconButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    height: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradientFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  secondaryButton: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.ink10,
    borderRadius: radius.md,
    padding: 2,
    alignSelf: 'stretch',
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md - 2,
  },
  segmentTabActive: { backgroundColor: colors.surface, ...cardShadow },
  segmentBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { borderWidth: 1, borderColor: colors.white },
  avatarExtra: {
    backgroundColor: colors.blue10,
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  sectionTitle: { flex: 1 },
});
