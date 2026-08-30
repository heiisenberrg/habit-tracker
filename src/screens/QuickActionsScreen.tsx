import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { MOOD_FACES } from '../data/seed';
import { useStore } from '../store/useStore';
import { cardShadow, colors, radius, spacing } from '../theme/theme';

/** "Add Button" overlay from the Figma Home & Add Habit section. */
function QuickActionsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const setMood = useStore(s => s.setMood);

  return (
    <View style={styles.fill}>
      <Pressable style={styles.backdrop} onPress={() => navigation.goBack()} />
      <View
        style={[styles.sheet, { bottom: Math.max(insets.bottom, 12) + 96 }]}
      >
        <View style={styles.card}>
          <Pressable
            onPress={() => navigation.replace('Assistant')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <View style={styles.cardHeader}>
              <AppText variant="bodyMedium">✨ Ask Assistant</AppText>
              <View style={[styles.chip, styles.chipBlue]}>
                <AppText variant="alt" color={colors.blue}>
                  💬
                </AppText>
              </View>
            </View>
            <AppText variant="alt" color={colors.ink40}>
              Create habits, tasks & reminders by chat
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => navigation.replace('Assistant', { flow: 'quick' })}
            style={({ pressed }) => [
              styles.quickAdd,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="alt" color={colors.blue}>
              ⚡ Quick add — type one line, the rest is parsed
            </AppText>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Pressable
            onPress={() =>
              navigation.replace('CreateCustomHabit', { kind: 'quit' })
            }
            style={({ pressed }) => [
              styles.card,
              styles.half,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardHeader}>
              <AppText variant="bodyMedium">Quit Bad Habit</AppText>
              <View style={[styles.chip, styles.chipRed]}>
                <AppText variant="alt" color={colors.red}>
                  ✕
                </AppText>
              </View>
            </View>
            <AppText variant="alt" color={colors.ink40}>
              Never too late...
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => navigation.replace('NewGoodHabit')}
            style={({ pressed }) => [
              styles.card,
              styles.half,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.cardHeader}>
              <AppText variant="bodyMedium">New Good Habit</AppText>
              <View style={[styles.chip, styles.chipGreen]}>
                <AppText variant="alt" color={colors.green}>
                  ✓
                </AppText>
              </View>
            </View>
            <AppText variant="alt" color={colors.ink40}>
              For a better life
            </AppText>
          </Pressable>
        </View>
        <View style={styles.card}>
          <View style={styles.moodRow}>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Add Mood</AppText>
              <AppText variant="alt" color={colors.ink40}>
                How’re you feeling?
              </AppText>
            </View>
            {MOOD_FACES.map(face => (
              <Pressable
                key={face}
                onPress={() => {
                  setMood(face);
                  navigation.goBack();
                }}
                style={({ pressed }) => [
                  styles.moodButton,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="title">{face}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Pressable
        onPress={() => navigation.goBack()}
        style={[styles.close, { bottom: Math.max(insets.bottom, 12) + 20 }]}
      >
        <AppText variant="h6" color={colors.white}>
          ✕
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,4,21,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
    ...cardShadow,
  },
  half: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  chip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRed: { backgroundColor: '#FCE6E5' },
  chipBlue: { backgroundColor: colors.blue10 },
  chipGreen: { backgroundColor: '#E3F3E2' },
  quickAdd: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  moodButton: { padding: 2 },
  pressed: { opacity: 0.7 },
  close: {
    position: 'absolute',
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default QuickActionsScreen;
