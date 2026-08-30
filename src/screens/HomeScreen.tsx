import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import HabitCard from '../components/HabitCard';
import ProgressRing from '../components/ProgressRing';
import { Card, IconButton, SectionHeader } from '../components/common';
import {
  CalendarIcon,
  DotIcon,
  NotificationIcon,
  TimeCircleIcon,
} from '../components/icons';
import {
  appLockConditionLabel,
  appLockSatisfied,
  zenActiveAt,
} from '../services/appLock';
import { fetchBlocksForDate } from '../services/deviceCalendar';
import { getTodaySteps } from '../services/health';
import { cancelReminder, resyncReminders } from '../services/notifications';
import { checkRainForSchedule } from '../services/rainAlerts';
import { getCurrentWeather, Weather } from '../services/weather';
import {
  addDays,
  completedCount,
  dayStreak,
  historyDayFraction,
  perfectToday,
  progressFor,
  toDateKey,
  todayKey,
  trackingOf,
  useStore,
} from '../store/useStore';
import {
  colors,
  gradients,
  radius,
  screenPadding,
  spacing,
} from '../theme/theme';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function weekAround(today: Date) {
  return Array.from({ length: 8 }, (_, i) => addDays(today, i - 1));
}

function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const {
    user,
    mood,
    habits,
    completions,
    planner,
    histories,
    inbox,
    increment,
    toggleCheck,
    setCompletion,
    togglePlannerItem,
    movePlannerItem,
    deletePlannerItem,
    healthConnected,
    calendarConnected,
    importCalendarBlocks,
    congratsShownOn,
    markCongratsShown,
  } = store;
  const [selected, setSelected] = useState(() => todayKey());
  const [weather, setWeather] = useState<Weather | null>(null);

  const days = useMemo(() => weekAround(new Date()), []);
  const doneCount = completedCount(completions, habits, selected);
  const dailyProgress = habits.length
    ? habits.reduce(
        (sum, h) => sum + progressFor(completions, h, selected),
        0,
      ) / habits.length
    : 0;
  const streak = dayStreak(store);
  const perfect = perfectToday(store);
  const appLocked =
    store.appLock.enabled &&
    !appLockSatisfied(store.appLock, habits, completions, store.statuses);
  const zenOn = zenActiveAt(store.zen.until);
  const zenEndLabel = store.zen.until
    ? `${String(new Date(store.zen.until).getHours()).padStart(
        2,
        '0',
      )}:${String(new Date(store.zen.until).getMinutes()).padStart(2, '0')}`
    : '';

  /** Start a quiet session: pause our reminders; the App-level effect
   *  raises the Screen Time shield from the new zen end-time. */
  const startZen = (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60000).toISOString();
    store.setZen({ until });
    habits.filter(h => h.reminder?.enabled).forEach(h => cancelReminder(h.id));
    if (store.zen.useFocusShortcut) {
      Linking.openURL('shortcuts://run-shortcut?name=Routiner%20Zen').catch(
        () => {},
      );
    }
  };

  const endZen = () => {
    store.setZen({ until: null });
    if (!store.prefs.vacationMode) {
      resyncReminders(habits);
    }
  };

  const ZEN_MINUTES = [15, 30, 60, 120];
  const onZenPress = () => {
    if (zenOn) {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Zen until ${zenEndLabel}`,
          options: ['End zen early', 'Keep going'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        i => {
          if (i === 0) {
            endZen();
          }
        },
      );
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Quiet time for…',
        message: 'Reminders pause and your locked apps stay shielded.',
        options: ['15 minutes', '30 minutes', '1 hour', '2 hours', 'Cancel'],
        cancelButtonIndex: 4,
      },
      i => {
        if (i < 4) {
          startZen(ZEN_MINUTES[i]);
        }
      },
    );
  };
  const dayTasks = planner
    .filter(t => t.date === selected)
    .sort((a, b) => ((a.time || '99') < (b.time || '99') ? -1 : 1));

  /** 🔥 marker for a day cell: perfect history day, or today once perfect. */
  const flameFor = (d: Date) => {
    const key = toDateKey(d);
    if (key === todayKey()) {
      return perfect;
    }
    const diff = Math.round(
      (new Date(todayKey()).getTime() - new Date(key).getTime()) / 86400000,
    );
    if (diff < 1 || diff > 83) {
      return false;
    }
    return historyDayFraction(histories, habits, 83 - diff) >= 1;
  };

  // HealthKit step sync -> the STEPS habit
  useEffect(() => {
    if (!healthConnected) {
      return;
    }
    getTodaySteps().then(steps => {
      if (steps == null) {
        return;
      }
      const walk = habits.find(h => h.goal.unit === 'STEPS');
      if (!walk) {
        return;
      }
      const current = completions[walk.id]?.[todayKey()] ?? 0;
      const next = Math.min(walk.goal.amount, steps);
      if (next > current) {
        setCompletion(walk.id, next, todayKey());
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [healthConnected]);

  // Local weather -> header chip (cached 30 min; hidden when unavailable),
  // plus rain heads-ups for today's scheduled tasks and habit reminders.
  // Re-runs when the schedule changes; forecast is cached and alerts
  // dedupe per item per day, so repeats are cheap and quiet.
  useEffect(() => {
    getCurrentWeather().then(setWeather);
    checkRainForSchedule(planner, habits);
  }, [planner, habits]);

  // Device calendar sync -> today's time blocks
  useEffect(() => {
    if (!calendarConnected) {
      return;
    }
    fetchBlocksForDate(new Date()).then(blocks => {
      if (blocks.length) {
        importCalendarBlocks(todayKey(), blocks);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarConnected]);

  // Perfect day -> streak congrats, once per day
  useEffect(() => {
    if (perfect && congratsShownOn !== todayKey()) {
      markCongratsShown(todayKey());
      const t = setTimeout(() => navigation.navigate('Success'), 400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfect]);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <View style={styles.flex}>
            <AppText variant="title">Hi, {user.name || 'there'}</AppText>
            <AppText variant="body" color={colors.ink40}>
              {perfect
                ? 'Perfect day! Streak extended ⚡'
                : 'Let’s make habits together!'}
            </AppText>
          </View>
          {weather && (
            <View
              style={styles.weatherChip}
              accessible
              accessibilityLabel={`${weather.label}, ${weather.temp} degrees`}
            >
              <AppText variant="bodyMedium">{weather.emoji}</AppText>
              <AppText variant="bodyMedium" color={colors.ink40}>
                {weather.temp}°
              </AppText>
            </View>
          )}
          <IconButton onPress={() => navigation.navigate('Notifications')}>
            <NotificationIcon size={24} />
            {inbox.some(i => !i.read) && (
              <View style={styles.notifDot}>
                <DotIcon size={8} />
              </View>
            )}
          </IconButton>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 140 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily goal banner with quick actions: calendar · streak · mood */}
        <View style={styles.infoBox}>
          <LinearGradient
            colors={gradients.blue}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.6, y: 1 }}
            style={styles.gradientFill}
          />
          {/* Orbit rings, echoing the onboarding artwork */}
          <View style={styles.orbitSm} pointerEvents="none" />
          <View style={styles.orbitLg} pointerEvents="none" />
          <View style={styles.infoTop}>
            <ProgressRing size={56} strokeWidth={4} progress={dailyProgress}>
              <AppText variant="bodyMedium" color={colors.white}>
                {Math.round(dailyProgress * 100)}%
              </AppText>
            </ProgressRing>
            <View style={styles.flex}>
              <AppText variant="title" color={colors.white}>
                {habits.length > 0 && doneCount === habits.length
                  ? 'Perfect day — streak secured! 🔥'
                  : doneCount === 0
                  ? 'Fresh day. Start small.'
                  : `Nice pace — ${habits.length - doneCount} to go`}
              </AppText>
              <AppText variant="alt" color={colors.blue40}>
                {doneCount} of {habits.length} habits done today
              </AppText>
            </View>
          </View>
          <View style={styles.infoActions}>
            <Pressable
              style={styles.infoBtn}
              onPress={() => navigation.navigate('Calendar')}
            >
              <CalendarIcon size={22} />
            </Pressable>
            <View style={styles.infoBtn}>
              <AppText
                variant="bodyMedium"
                style={!perfect && styles.streakEmojiIdle}
              >
                🔥
              </AppText>
              <AppText
                variant="bodyMedium"
                color={perfect ? '#FFC736' : colors.white}
              >
                {streak}
              </AppText>
            </View>
            <Pressable
              style={styles.infoBtn}
              onPress={() => navigation.navigate('QuickActions')}
            >
              <AppText variant="h6">{mood}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={zenOn ? 'Zen session running' : 'Start zen'}
              style={[styles.infoBtn, zenOn && styles.zenOn]}
              onPress={onZenPress}
            >
              <AppText variant="bodyMedium">🧘</AppText>
            </Pressable>
          </View>
        </View>

        {(zenOn || appLocked) && (
          <View style={styles.lockChip}>
            <AppText variant="alt" color={colors.ink60}>
              {zenOn
                ? `🧘 Zen until ${zenEndLabel} — reminders paused`
                : `🔒 Apps locked ${appLockConditionLabel(
                    store.appLock,
                    habits,
                  )}`}
            </AppText>
          </View>
        )}

        {/* Week strip with streak flames */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.week}
        >
          {days.map(d => {
            const key = toDateKey(d);
            const active = key === selected;
            const flame = flameFor(d);
            return (
              <Pressable
                key={key}
                onPress={() => setSelected(key)}
                style={[styles.day, active && styles.dayActive]}
              >
                {active && (
                  <LinearGradient
                    colors={gradients.blue}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientFill}
                  />
                )}
                <AppText
                  variant="h6"
                  color={active ? colors.white : colors.ink}
                  center
                >
                  {d.getDate()}
                </AppText>
                <AppText
                  variant="chip"
                  color={active ? 'rgba(255,255,255,0.85)' : colors.ink20}
                  center
                >
                  {DAY_LABELS[d.getDay()]}
                </AppText>
                {flame && <AppText style={styles.dayFlame}>🔥</AppText>}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Today's tasks */}
        <View style={styles.section}>
          <SectionHeader title="Tasks" />
          {dayTasks.length === 0 && (
            <Card style={styles.emptyCard}>
              <AppText variant="alt" color={colors.ink40} center>
                Nothing planned — add a task or block time from the calendar
              </AppText>
            </Card>
          )}
          {dayTasks.map(t => (
            <Card key={t.id} style={styles.taskCard}>
              {t.type === 'task' ? (
                <Pressable
                  onPress={() => togglePlannerItem(t.id)}
                  style={[styles.checkbox, t.done && styles.checkboxDone]}
                >
                  {t.done && (
                    <AppText variant="chip" color={colors.white}>
                      ✓
                    </AppText>
                  )}
                </Pressable>
              ) : (
                <TimeCircleIcon size={22} />
              )}
              <View style={styles.flex}>
                <AppText
                  variant="bodyMedium"
                  color={t.done ? colors.ink40 : colors.ink}
                  style={t.done && styles.struck}
                >
                  {t.title}
                </AppText>
                <View style={styles.taskMetaRow}>
                  <AppText variant="alt" color={colors.ink40}>
                    {t.time || (t.type === 'task' ? 'Any time' : '')}
                  </AppText>
                  {t.type === 'block' && (
                    <View style={styles.blockChip}>
                      <AppText variant="chip" color={colors.ink40}>
                        time block
                      </AppText>
                    </View>
                  )}
                </View>
              </View>
              {t.type === 'task' && !t.done && (
                <Pressable
                  onPress={() =>
                    movePlannerItem(
                      t.id,
                      toDateKey(addDays(new Date(`${t.date}T00:00`), 1)),
                    )
                  }
                  style={styles.postponeChip}
                >
                  <AppText variant="chip" color={colors.blue}>
                    +1d
                  </AppText>
                </Pressable>
              )}
              <Pressable hitSlop={8} onPress={() => deletePlannerItem(t.id)}>
                <AppText variant="body" color={colors.ink20}>
                  ✕
                </AppText>
              </Pressable>
            </Card>
          ))}
        </View>

        {/* Habits */}
        <View style={styles.section}>
          <SectionHeader title="Habits" />
          {habits.map(habit => (
            <HabitCard
              key={habit.id}
              habit={habit}
              amount={completions[habit.id]?.[selected] ?? 0}
              onPress={() =>
                navigation.navigate('HabitDetail', { id: habit.id })
              }
              onIncrement={() =>
                trackingOf(habit) === 'check'
                  ? toggleCheck(habit.id, selected)
                  : increment(habit.id, selected)
              }
            />
          ))}
        </View>
      </ScrollView>

      {/* Assistant FAB */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask Assistant"
        onPress={() => navigation.navigate('Assistant')}
        style={({ pressed }) => [
          styles.fab,
          { bottom: Math.max(insets.bottom, 12) + 92 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <LinearGradient
          colors={gradients.blue}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}
        />
        <AppText variant="h6" color="#FFFFFF">
          ✨
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  notifDot: { position: 'absolute', top: 7, right: 7 },
  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.info10,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    marginRight: spacing.sm,
  },
  streakEmojiIdle: { opacity: 0.35 },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  week: { gap: spacing.sm },
  day: {
    width: 64,
    height: 64,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayActive: { borderColor: 'transparent', overflow: 'hidden' },
  dayFlame: {
    position: 'absolute',
    bottom: 2,
    fontSize: 9,
    lineHeight: 11,
  },
  infoBox: {
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  orbitSm: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    right: -48,
    top: -74,
  },
  orbitLg: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    right: -102,
    top: -128,
  },
  lockChip: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  zenOn: { backgroundColor: 'rgba(255,255,255,0.34)' },
  infoTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoActions: { flexDirection: 'row', gap: spacing.sm },
  infoBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.md,
  },
  gradientFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  section: { gap: spacing.xs, alignSelf: 'stretch' },
  emptyCard: { paddingVertical: spacing.md, alignSelf: 'stretch' },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.blue, borderColor: colors.blue },
  struck: { textDecorationLine: 'line-through' },
  taskMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  postponeChip: {
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.blue10,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  fab: {
    position: 'absolute',
    right: screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#232C5D',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});

export default HomeScreen;
