import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { IconButton } from '../components/common';
import HabitsSection from '../components/home/HabitsSection';
import HeroBanner from '../components/home/HeroBanner';
import NudgeCard from '../components/home/NudgeCard';
import TasksSection from '../components/home/TasksSection';
import ZenControls, { useZen } from '../components/home/ZenControls';
import { AssistantIcon, DotIcon, NotificationIcon } from '../components/icons';
import { appLockSatisfied } from '../services/appLock';
import { fetchBlocksForDate } from '../services/deviceCalendar';
import { getTodaySteps } from '../services/health';
import { checkRainForSchedule } from '../services/rainAlerts';
import { getCurrentWeather, Weather } from '../services/weather';
import {
  addDays,
  completedCount,
  dayStreak,
  historyDayFraction,
  perfectDayCount,
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
  const { zenOn, zenEndLabel, onZenPress } = useZen();

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
  // One-time, in-context nudge cards (design review 7A): recap after the
  // first perfect day or the first evening with work left; weather once a
  // time block exists. Never more than one at a time; recap first.
  const prefs = store.prefs;
  const eveningWithWorkLeft =
    new Date().getHours() >= 18 &&
    habits.length > 0 &&
    doneCount < habits.length;
  const nudge: {
    text: string;
    dismissKey: 'recapNudgeDismissed' | 'weatherNudgeDismissed';
  } | null =
    !prefs.recap &&
    !prefs.recapNudgeDismissed &&
    (perfectDayCount(store) > 0 || eveningWithWorkLeft)
      ? {
          text: 'Want a 9 pm check-in on days like this? Turn on Evening recap.',
          dismissKey: 'recapNudgeDismissed',
        }
      : !prefs.weather &&
        !prefs.weatherNudgeDismissed &&
        planner.some(t => t.type === 'block')
      ? {
          text: 'Rain heads-ups before your time blocks? Turn on Weather & rain alerts.',
          dismissKey: 'weatherNudgeDismissed',
        }
      : null;

  // The Settings "Weather & rain alerts" toggle owns the location ask
  // (App.tsx configures skipPermissionRequests). Off → no chip, no checks.
  const weatherOn = store.prefs.weather;
  useEffect(() => {
    if (!weatherOn) {
      setWeather(null);
      return;
    }
    getCurrentWeather().then(setWeather);
    checkRainForSchedule(planner, habits);
  }, [weatherOn, planner, habits]);

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
          <IconButton
            accessibilityLabel="Ask Assistant"
            onPress={() => navigation.navigate('Assistant')}
          >
            <AssistantIcon size={24} />
          </IconButton>
          <IconButton
            accessibilityLabel="Notifications"
            onPress={() => navigation.navigate('Notifications')}
          >
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
        <HeroBanner
          dailyProgress={dailyProgress}
          doneCount={doneCount}
          habitCount={habits.length}
          streak={streak}
          perfect={perfect}
          freezes={store.streakFreezes.available}
          mood={mood}
          zenOn={zenOn}
          onCalendar={() => navigation.navigate('Calendar')}
          onMood={() => navigation.navigate('QuickActions')}
          onZen={onZenPress}
          onAddHabit={() => navigation.navigate('NewGoodHabit')}
          onAssistant={() => navigation.navigate('Assistant')}
        />

        {nudge && (
          <NudgeCard
            text={nudge.text}
            onTurnOn={() => navigation.navigate('Settings')}
            onDismiss={() => store.setPref(nudge.dismissKey, true)}
          />
        )}

        <ZenControls
          zenOn={zenOn}
          zenEndLabel={zenEndLabel}
          appLocked={appLocked}
          habits={habits}
        />

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

        {(habits.length > 0 || dayTasks.length > 0) && (
          <TasksSection
            tasks={dayTasks}
            onToggle={togglePlannerItem}
            onMove={movePlannerItem}
            onDelete={deletePlannerItem}
          />
        )}

        <HabitsSection
          habits={habits}
          completions={completions}
          selected={selected}
          onPressHabit={id => navigation.navigate('HabitDetail', { id })}
          onIncrement={habit =>
            trackingOf(habit) === 'check'
              ? toggleCheck(habit.id, selected)
              : increment(habit.id, selected)
          }
        />
      </ScrollView>
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
  gradientFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});

export default HomeScreen;
