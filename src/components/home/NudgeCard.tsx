import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '../AppText';
import { Card } from '../common';
import { colors, radius, spacing } from '../../theme/theme';

type Props = {
  text: string;
  onTurnOn: () => void;
  onDismiss: () => void;
};

/**
 * One-time bridge from a relevant moment to a Settings nudge (design review
 * 7A). Never raises a system dialog itself; "Turn on" just opens Settings.
 */
function NudgeCard({ text, onTurnOn, onDismiss }: Props) {
  return (
    <Card style={styles.card}>
      <AppText variant="body" color={colors.ink} style={styles.text}>
        {text}
      </AppText>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Turn on"
          onPress={onTurnOn}
          style={styles.primary}
        >
          <AppText variant="bodyMedium" color={colors.white}>
            Turn on
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          onPress={onDismiss}
          hitSlop={8}
        >
          <AppText variant="bodyMedium" color={colors.ink60}>
            Not now
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, alignSelf: 'stretch' },
  text: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  primary: {
    backgroundColor: colors.blue,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});

export default NudgeCard;
