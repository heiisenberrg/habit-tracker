import React from 'react';
import { StyleSheet, View } from 'react-native';
import HabitCard from '../HabitCard';
import { SectionHeader } from '../common';
import { Habit } from '../../data/seed';
import { CompletionMap } from '../../store/useStore';
import { spacing } from '../../theme/theme';

type Props = {
  habits: Habit[];
  completions: CompletionMap;
  selected: string;
  onPressHabit: (id: string) => void;
  onIncrement: (habit: Habit) => void;
};

/** The habit cards for the selected day. */
function HabitsSection({
  habits,
  completions,
  selected,
  onPressHabit,
  onIncrement,
}: Props) {
  return (
    <View style={styles.section}>
      <SectionHeader title="Habits" />
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
  section: { gap: spacing.xs, alignSelf: 'stretch' },
});

export default HabitsSection;
