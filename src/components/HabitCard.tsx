import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from './AppText';
import ProgressRing from './ProgressRing';
import { Card } from './common';
import { PlusIcon, TickSquareIcon } from './icons';
import { colors, radius, spacing } from '../theme/theme';
import { Habit } from '../data/seed';

type Props = {
  habit: Habit;
  /** current completion amount for the displayed date */
  amount: number;
  onIncrement?: () => void;
  onPress?: () => void;
};

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

/** Routiner habit card: progress ring + emoji, name, "500/2000 ML", +/done. */
function HabitCard({ habit, amount, onIncrement, onPress }: Props) {
  const progress = Math.min(1, amount / habit.goal.amount);
  const done = progress >= 1;
  // Optional per-habit accent (from the habit creator), hex-only for safety.
  const accent =
    habit.color && HEX6.test(habit.color) ? habit.color : undefined;

  return (
    <Card onPress={onPress} style={styles.card}>
      <ProgressRing
        size={36}
        strokeWidth={3}
        progress={progress}
        color={accent ?? colors.blue}
        trackColor={colors.ink10}
      >
        <View
          style={[
            styles.emojiTile,
            accent != null && { backgroundColor: `${accent}24` },
          ]}
        >
          <AppText variant="body">{habit.emoji}</AppText>
        </View>
      </ProgressRing>
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <AppText variant="bodyMedium" style={styles.name}>
            {habit.name}
          </AppText>
          <AppText variant="alt" color={done ? colors.green : colors.ink40}>
            {amount}/{habit.goal.amount} {habit.goal.unit}
          </AppText>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${progress * 100}%` },
              accent != null && { backgroundColor: accent },
              done && styles.fillDone,
            ]}
          />
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          done ? `${habit.name} completed` : `Log ${habit.name}`
        }
        onPress={onIncrement}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
      >
        {done ? <TickSquareIcon size={24} /> : <PlusIcon size={24} />}
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  emojiTile: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 6 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { flex: 1 },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.ink10,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.blue,
  },
  fillDone: { backgroundColor: colors.green },
  action: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default HabitCard;
