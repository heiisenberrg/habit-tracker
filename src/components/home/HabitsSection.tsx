import React from 'react';
import { StyleSheet, View } from 'react-native';
import AppText from '../AppText';
import HabitCard from '../HabitCard';
import { IconButton } from '../common';
import { Habit } from '../../data/seed';
import { CompletionMap } from '../../store/useStore';
import { colors, spacing } from '../../theme/theme';

type Props = {
  habits: Habit[];
  completions: CompletionMap;
  selected: string;
  onPressHabit: (id: string) => void;
  onIncrement: (habit: Habit) => void;
  /** With habits present this is the ONLY route into New Good Habit —
   *  the old Add sheet is gone and the hero CTA only shows when empty. */
  onAdd: () => void;
};

/** The habit cards for the selected day. */
function HabitsSection({
  habits,
  completions,
  selected,
  onPressHabit,
  onIncrement,
  onAdd,
}: Props) {
  if (habits.length === 0) {
    return null; // the hero renders the dedicated empty state (3A)
  }
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <AppText variant="bodyMedium" style={styles.flex}>
          Habits
        </AppText>
        <IconButton size={32} accessibilityLabel="Add a habit" onPress={onAdd}>
          <AppText variant="body" color={colors.ink60}>
            ＋
          </AppText>
        </IconButton>
      </View>
      {habits.map(habit => (
        <HabitCard
          key={habit.id}
          habit={habit}
          amount={completions[habit.id]?.[selected] ?? 0}
          onPress={() => onPressHabit(habit.id)}
          onIncrement={() => onIncrement(habit)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  section: { gap: spacing.xs, alignSelf: 'stretch' },
});

export default HabitsSection;
