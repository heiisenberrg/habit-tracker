import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ProgressRing from '../components/ProgressRing';
import { Card, IconButton, SectionHeader } from '../components/common';
import { PlusIcon, TickSquareIcon, TimeCircleIcon } from '../components/icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { cancelReminder } from '../services/notifications';
import {
  addDays,
  habitStreak,
  progressFor,
  statusOn,
  toDateKey,
  todayKey,
  trackingOf,
  useStore,
} from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HEX6 = /^#[0-9A-Fa-f]{6}$/;

/** Habit detail: progress, streak, recent days, reminder and actions. */
function HabitDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'HabitDetail'>>();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const {
    habits,
    completions,
    statuses,
    increment,
    toggleCheck,
    setStatus,
    removeHabit,
  } = store;

  const habit = habits.find(h => h.id === route.params?.id);

  /* --------------------------- not found --------------------------- */

  if (!habit) {
    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <IconButton
            size={40}
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
          >
            <AppText variant="h6">‹</AppText>
          </IconButton>
          <AppText variant="h6" style={styles.flex}>
            Habit
          </AppText>
        </View>
        <View style={styles.emptyWrap}>
          <AppText variant="h5" center>
            🫥
          </AppText>
          <AppText variant="bodyMedium" center>
            This habit no longer exists
          </AppText>
          <AppText variant="alt" color={colors.ink40} center>
            It may have been deleted on another screen.
          </AppText>
        </View>
      </View>
    );
  }

  /* ----------------------------- data ------------------------------ */

  const accent =
    habit.color && HEX6.test(habit.color) ? habit.color : undefined;
  const tint = accent ? `${accent}1F` : colors.blue10;
  const ringColor = accent ?? colors.blue;

  const amount = completions[habit.id]?.[todayKey()] ?? 0;
  const progress = progressFor(completions, habit);
  const status = statusOn(statuses, habit.id);
  const done = status === null && progress >= 1;
  const streak = habitStreak(store, habit);
  const isCheck = trackingOf(habit) === 'check';

  // Last 7 days (oldest first, ending today): live completions/statuses
  // first, synthesized history filling in older days — real logs only
  // exist from the day the app started being used.
  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i - 6);
    const key = toDateKey(d);
    const daysAgo = 6 - i;
    const dayStatus = statuses[habit.id]?.[key] ?? null;
    const logged = (completions[habit.id]?.[key] ?? 0) >= habit.goal.amount;
    const historic =
      daysAgo > 0 && (store.histories[habit.id]?.[83 - daysAgo] ?? 0) === 1;
    return {
      key,
      label: WD[d.getDay()],
      done: dayStatus == null && (logged || historic),
      status: dayStatus,
    };
  });

  /* ---------------------------- actions ---------------------------- */

  const logToday = () =>
    isCheck ? toggleCheck(habit.id) : increment(habit.id);

  const toggleStatus = (s: 'skipped' | 'failed') =>
    setStatus(habit.id, status === s ? null : s);

  const confirmDelete = () =>
    Alert.alert(
      'Delete habit',
      `Remove “${habit.name}” and its reminder? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            cancelReminder(habit.id);
            removeHabit(habit.id);
            navigation.goBack();
          },
        },
      ],
    );

  /* ---------------------------- render ----------------------------- */

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton
          size={40}
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <AppText variant="h6" style={styles.flex}>
          Habit
        </AppText>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: emoji + name + goal + streak */}
        <Card style={styles.hero}>
          <View style={[styles.emojiTile, { backgroundColor: tint }]}>
            <AppText variant="h5">{habit.emoji}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="title">{habit.name}</AppText>
            <AppText variant="alt" color={colors.ink40}>
              {isCheck
                ? 'Once a day'
                : `${habit.goal.amount} ${habit.goal.unit} daily`}
              {habit.kind === 'quit' ? ' · Quit habit' : ''}
            </AppText>
          </View>
          <View style={styles.streakChip}>
            <AppText variant="bodyMedium">🔥</AppText>
            <AppText variant="bodyMedium" color={colors.ink}>
              {streak}
            </AppText>
            <AppText variant="chip" color={colors.ink40}>
              {streak === 1 ? 'day' : 'days'}
            </AppText>
          </View>
        </Card>

        {/* Today's progress */}
        <View style={styles.section}>
          <SectionHeader title="Today" />
          <Card style={styles.todayCard}>
            <ProgressRing
              size={56}
              strokeWidth={5}
              progress={status ? 0 : progress}
              color={done ? colors.green : ringColor}
              trackColor={colors.ink10}
            >
              <AppText variant="body">{habit.emoji}</AppText>
            </ProgressRing>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">
                {status === 'skipped'
                  ? 'Skipped today'
                  : status === 'failed'
                  ? 'Failed today'
                  : done
                  ? 'Completed — nice!'
                  : isCheck
                  ? 'Not checked in yet'
                  : `${amount}/${habit.goal.amount} ${habit.goal.unit}`}
              </AppText>
              <AppText variant="alt" color={colors.ink40}>
                {status
                  ? 'Clear the mark below to keep logging'
                  : isCheck
                  ? 'Tap to check in for today'
                  : `+${habit.step} ${habit.goal.unit} per tap`}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                done ? `${habit.name} completed` : `Log ${habit.name}`
              }
              onPress={logToday}
              style={({ pressed }) => [
                styles.logBtn,
                pressed && styles.pressed,
              ]}
            >
              {done ? <TickSquareIcon size={24} /> : <PlusIcon size={24} />}
            </Pressable>
          </Card>
        </View>

        {/* Recent days */}
        <View style={styles.section}>
          <SectionHeader title="Last 7 days" />
          <Card style={styles.daysCard}>
            {recentDays.map(d => (
              <View key={d.key} style={styles.dayCell}>
                <View
                  style={[
                    styles.dayDot,
                    d.done && styles.dayDotDone,
                    d.status === 'failed' && styles.dayDotFailed,
                  ]}
                >
                  <AppText
                    variant="chip"
                    color={
                      d.done || d.status === 'failed'
                        ? colors.white
                        : colors.ink20
                    }
                  >
                    {d.done
                      ? '✓'
                      : d.status === 'skipped'
                      ? '–'
                      : d.status === 'failed'
                      ? '✕'
                      : '·'}
                  </AppText>
                </View>
                <AppText variant="chip" color={colors.ink40} center>
                  {d.label}
                </AppText>
              </View>
            ))}
          </Card>
        </View>

        {/* Reminder */}
        {habit.reminder?.enabled && (
          <View style={styles.section}>
            <SectionHeader title="Reminder" />
            <Card style={styles.reminderCard}>
              <TimeCircleIcon size={22} />
              <View style={styles.flex}>
                <AppText variant="bodyMedium">
                  Every day at {habit.reminder.time}
                </AppText>
                <AppText variant="alt" color={colors.ink40}>
                  Delivered as a local notification
                </AppText>
              </View>
            </Card>
          </View>
        )}

        {/* Actions */}
        <View style={styles.section}>
          <SectionHeader title="Actions" />
          <Card style={styles.actionsCard}>
            <Pressable
              onPress={() => toggleStatus('skipped')}
              style={({ pressed }) => [
                styles.actionRow,
                status === 'skipped' && styles.actionActive,
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="body">⏭️</AppText>
              <AppText variant="bodyMedium" style={styles.flex}>
                {status === 'skipped'
                  ? 'Skipped today — tap to undo'
                  : 'Mark today as skipped'}
              </AppText>
              {status === 'skipped' && (
                <AppText variant="chip" color={colors.blue}>
                  On
                </AppText>
              )}
            </Pressable>
            <Pressable
              onPress={() => toggleStatus('failed')}
              style={({ pressed }) => [
                styles.actionRow,
                status === 'failed' && styles.actionActive,
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="body">💔</AppText>
              <AppText variant="bodyMedium" style={styles.flex}>
                {status === 'failed'
                  ? 'Failed today — tap to undo'
                  : 'Mark as failed'}
              </AppText>
              {status === 'failed' && (
                <AppText variant="chip" color={colors.red}>
                  On
                </AppText>
              )}
            </Pressable>
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="body">🗑️</AppText>
              <AppText variant="bodyMedium" color={colors.red}>
                Delete habit
              </AppText>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: screenPadding,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  emojiTile: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  section: { gap: spacing.xs, alignSelf: 'stretch' },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  logBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  dayCell: { alignItems: 'center', gap: spacing.xs },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotDone: { backgroundColor: colors.green },
  dayDotFailed: { backgroundColor: colors.red },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  actionsCard: { gap: spacing.xs, alignSelf: 'stretch', padding: spacing.sm },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  actionActive: { backgroundColor: colors.blue10 },
  pressed: { opacity: 0.7 },
});

export default HabitDetailScreen;
