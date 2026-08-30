import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { popularHabits } from '../data/seed';
import { useStore } from '../store/useStore';
import { cardShadow, colors, radius, spacing } from '../theme/theme';
import { PlusIcon } from '../components/icons';

/** "New Good Habit" sheet from the Figma Home & Add Habit section. */
function NewGoodHabitScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const addHabit = useStore(s => s.addHabit);

  const addPopular = (p: (typeof popularHabits)[number]) => {
    const amount = p.name === 'Walk' ? 10 : p.name === 'Swim' ? 30 : 10;
    addHabit({
      id: `${p.name.toLowerCase()}-${Date.now()}`,
      name: p.name,
      emoji: p.emoji,
      type: 'good',
      goal: { amount, unit: p.name === 'Walk' ? 'KM' : 'MIN' },
      step: p.name === 'Walk' ? 2 : 10,
      friendIds: [],
      tracking: 'count',
      kind: 'build',
    });
    navigation.replace('Success', { title: `${p.name} added to your habits!` });
  };

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: Math.max(insets.top, spacing.lg),
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
      ]}
    >
      <View style={styles.handle} />
      <AppText variant="chip" color={colors.ink40}>
        New Good Habit
      </AppText>
      <Pressable
        onPress={() => navigation.replace('CreateCustomHabit')}
        style={({ pressed }) => [styles.customRow, pressed && styles.pressed]}
      >
        <AppText variant="bodyMedium" style={styles.flex}>
          Create Custom Habit
        </AppText>
        <View style={styles.plusChip}>
          <PlusIcon size={20} />
        </View>
      </Pressable>
      <AppText variant="chip" color={colors.ink40}>
        Popular Habits
      </AppText>
      <View style={styles.popularRow}>
        {popularHabits.map(p => (
          <Pressable
            key={p.name}
            onPress={() => addPopular(p)}
            style={({ pressed }) => [
              styles.popularCard,
              { backgroundColor: p.tint },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.popularEmoji}>
              <AppText variant="title">{p.emoji}</AppText>
            </View>
            {/* Static ink: the pastel card tints don't flip with the theme. */}
            <AppText variant="bodyMedium" color="#040415">
              {p.name}
            </AppText>
            <AppText variant="alt" color="#686873">
              {p.detail}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  flex: { flex: 1 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink10,
    alignSelf: 'center',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...cardShadow,
  },
  plusChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularRow: { flexDirection: 'row', gap: spacing.sm },
  popularCard: {
    flex: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  popularEmoji: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  pressed: { opacity: 0.75 },
});

export default NewGoodHabitScreen;
