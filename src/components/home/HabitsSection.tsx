import React from 'react';
import { StyleSheet, View } from 'react-native';
import HabitCard from '../HabitCard';
import { Card, SectionHeader } from '../common';
import { Habit } from '../../data/seed';
import { CompletionMap } from '../../store/useStore';
import AppText from '../AppText';
import { colors, spacing } from '../../theme/theme';

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
      {habits.length === 0 && (
        <Card style={styles.emptyCard}>
          <AppText variant="alt" color={colors.ink40} center>
            No habits yet — tap ✨ in the header to add your first
          </AppText>
        </Card>
      )}
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
  emptyCard: { paddingVertical: spacing.md, alignSelf: 'stretch' },
});

export default HabitsSection;
