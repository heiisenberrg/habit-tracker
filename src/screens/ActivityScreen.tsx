import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import AppText from '../components/AppText';
import ProgressRing from '../components/ProgressRing';
import ScreenTimeRow from '../components/activity/ScreenTimeRow';
import { Card, IconButton } from '../components/common';
import { MOOD_FACES } from '../data/seed';
import { monthKeyOf, monthLabel, shiftMonthKey } from '../services/grocery';
import {
  getLastNightSleep,
  healthSourceName,
  SleepSummary,
} from '../services/health';
import { rhythmLabel, sinceLabel, trackerRows } from '../services/logbook';
import {
  addDays,
  dayCompletion,
  dayStreak,
  doneOn,
  historyDayFraction,
  karma,
  perfectToday,
  statusOn,
  toDateKey,
  todayKey,
  useStore,
} from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

/** Smooth cubic path through points (Catmull-Rom style smoothing). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) {
    return '';
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 2] ?? pts[i - 1];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[i + 1] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** How many calendar months back navigation may go (history holds 83 days). */
const MAX_BACK_MONTHS = 2;

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Activity: monthly summary, wellbeing, completion chart and mood. */
function ActivityScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const store = useStore();
  const {
    habits,
    histories,
    statuses,
    completions,
    planner,
    moods,
    wellbeing,
    setWellbeing,
    healthConnected,
    logbook,
  } = store;
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(todayKey()));
  const [expanded, setExpanded] = useState(true);
  const [sleep, setSleep] = useState<SleepSummary | null>(null);

  useEffect(() => {
    if (healthConnected) {
      getLastNightSleep().then(setSleep);
    }
  }, [healthConnected]);

  /* ------------------------- period window ------------------------- */

  const today = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), []);
  const thisMonth = monthKeyOf(todayKey());
  const minMonth = shiftMonthKey(thisMonth, -MAX_BACK_MONTHS);
  // A CALENDAR month: the 1st through the last day. Days still ahead carry
  // no data, so "this month" reads as the 1st through today.
  const windowDates = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    const len = new Date(y, m, 0).getDate();
    return Array.from({ length: len }, (_, i) => new Date(y, m - 1, i + 1));
  }, [monthKey]);

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const periodTitle =
    monthKey === thisMonth ? 'This month' : monthLabel(monthKey);
  const periodRange = `${fmt(windowDates[0])} - ${fmt(
    windowDates[windowDates.length - 1],
  )}`;

  /* ----------------------- window-aware data ----------------------- */

  /** Fraction of habits completed on a date (live today, history otherwise). */
  const dayFractionFor = (d: Date): number | null => {
    const key = toDateKey(d);
    if (key === todayKey()) {
      // Canonical selector (E2) — same definition rollover writes with.
      return dayCompletion({ completions, statuses, habits, planner }, key);
    }
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff < 1 || diff > 83) {
      return null;
    }
    return historyDayFraction(histories, habits, 83 - diff);
  };

  /** Completed habit-count on a date. */
  const doneCountForDate = (d: Date): number => {
    const key = toDateKey(d);
    if (key === todayKey()) {
      return habits.filter(h => doneOn(completions, statuses, h)).length;
    }
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (diff < 1 || diff > 83) {
      return 0;
    }
    return habits.reduce((a, h) => a + (histories[h.id]?.[83 - diff] ?? 0), 0);
  };

  const fractions = windowDates
    .map(dayFractionFor)
    .filter((f): f is number => f != null);
  const successRate = fractions.length
    ? Math.round(
        (fractions.reduce((a, b) => a + b, 0) / fractions.length) * 100,
      )
    : 0;
  const completedInWindow = windowDates.reduce(
    (a, d) => a + doneCountForDate(d),
    0,
  );
  const perfectDaysInWindow = fractions.filter(f => f >= 1).length;
  const skipped = windowDates.reduce(
    (a, d) =>
      a +
      habits.filter(h => statusOn(statuses, h.id, toDateKey(d)) === 'skipped')
        .length,
    0,
  );
  const failed = windowDates.reduce(
    (a, d) =>
      a +
      habits.filter(h => statusOn(statuses, h.id, toDateKey(d)) === 'failed')
        .length,
    0,
  );
  const points = karma(store);
  const streak = dayStreak(store);

  /* --------------- consistency heatmap (12 weeks) --------------- */

  // Columns are Monday-started weeks, oldest on the left, this week last.
  const heatWeeks = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 77);
    return Array.from({ length: 12 }, (_, w) =>
      Array.from({ length: 7 }, (__, r) => {
        const d = addDays(start, w * 7 + r);
        const future = d.getTime() > today.getTime();
        return { key: toDateKey(d), frac: future ? null : dayFractionFor(d) };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completions, statuses, histories, habits]);

  const summary = [
    { label: 'Completed', value: `${completedInWindow}`, color: colors.ink },
    {
      label: 'Freezes held',
      value: `🧊 ${store.streakFreezes.available}`,
      color: colors.ink,
    },
    { label: 'Points (all-time)', value: `🏅 ${points}`, color: '#B7791F' },
    { label: 'Streak (all-time)', value: `${streak} 🔥`, color: colors.ink },
    { label: 'Skipped', value: `${skipped}`, color: colors.ink60 },
    { label: 'Failed', value: `${failed}`, color: colors.red },
  ];

  /* ----------------------------- chart ----------------------------- */

  const chartW = width - screenPadding * 2 - spacing.lg * 2;
  const chartH = 110;

  // Calendar weeks of the month: W1 = 1st-7th … W4 = 22nd-end.
  const series: { label: string; value: number }[] = useMemo(() => {
    const chunks: { label: string; value: number }[] = [];
    for (let c = 0; c < 4; c++) {
      const slice =
        c === 3 ? windowDates.slice(21) : windowDates.slice(c * 7, c * 7 + 7);
      const vals = slice
        .map(dayFractionFor)
        .filter((f): f is number => f != null);
      chunks.push({
        label: `W${c + 1}`,
        value: vals.length
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100)
          : 0,
      });
    }
    return chunks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, completions, statuses, habits]);

  const pts = series.map((p, i) => ({
    x: 6 + (i * (chartW - 12)) / Math.max(1, series.length - 1),
    y: 12 + (1 - p.value / 100) * (chartH - 24),
  }));
  const line = smoothPath(pts);
  const area = pts.length
    ? `${line} L ${pts[pts.length - 1].x} ${chartH} L ${pts[0].x} ${chartH} Z`
    : '';
  const last = pts[pts.length - 1];

  /* ----------------------------- mood ------------------------------ */

  // The month's last 7 ELAPSED days — future days can't carry a mood.
  const moodDates = windowDates
    .filter(dd => dd.getTime() <= today.getTime())
    .slice(-7)
    .map(d => {
    const key = toDateKey(d);
    const face = moods[key];
    return {
      d: WD[d.getDay()],
      face: face ?? '·',
      lift: face ? Math.max(0, MOOD_FACES.indexOf(face as never)) * 5 : 0,
      logged: !!face,
    };
  });
  const loggedFaces = moodDates.filter(m => m.logged).map(m => m.face);
  const avgMood = loggedFaces.length
    ? [...loggedFaces].sort(
        (a, b) =>
          loggedFaces.filter(f => f === b).length -
          loggedFaces.filter(f => f === a).length,
      )[0]
    : null;
  const moodLabel = avgMood
    ? ['Angry', 'Sad', 'Meh', 'Happy', 'Loving'][
        MOOD_FACES.indexOf(avgMood as never)
      ] ?? 'Logged'
    : 'No mood logged yet';

  /* --------------------------- wellbeing --------------------------- */

  const wb = wellbeing[todayKey()] ?? {};
  const sleepMinutes = sleep?.minutes ?? wb.sleepMinutes ?? null;
  const hhmm = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
      2,
      '0',
    )}`;
  const fmtMin = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  const perfect = perfectToday(store);
  /**
   * Only signals Slay can verify: a perfect day and health-store sleep
   * (Apple Health / Health Connect).
   * Pickups and social minutes are drawn by Apple's Screen Time extension and
   * cannot be read by this app, so scoring them would mean scoring a number
   * the user typed in by hand.
   */
  const productivity = Math.min(
    100,
    (perfect ? 50 : 0) +
      (sleepMinutes != null
        ? sleepMinutes >= 420
          ? 50
          : sleepMinutes >= 360
          ? 25
          : 0
        : 0),
  );

  const bumpWellbeing = (key: 'sleepMinutes', delta: number) => {
    const current = (wb[key] ?? 0) as number;
    setWellbeing(todayKey(), { [key]: Math.max(0, current + delta) });
  };

  /* ------------------------------ render ---------------------------- */

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <AppText variant="h5" style={styles.flex}>
            Activity
          </AppText>
          <IconButton
            size={40}
            accessibilityLabel="Logbook"
            onPress={() => navigation.navigate('Logbook')}
          >
            <AppText variant="body">📒</AppText>
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
        <View style={styles.periodRow}>
          <View style={styles.flex}>
            <AppText variant="bodyMedium">{periodTitle}</AppText>
            <AppText variant="alt" color={colors.ink40}>
              {periodRange}
            </AppText>
          </View>
          <IconButton
            size={34}
            accessibilityLabel="Earlier month"
            onPress={() =>
              monthKey > minMonth && setMonthKey(shiftMonthKey(monthKey, -1))
            }
          >
            <AppText
              variant="body"
              color={monthKey <= minMonth ? colors.ink20 : colors.ink60}
            >
              ‹
            </AppText>
          </IconButton>
          <IconButton
            size={34}
            accessibilityLabel="Later month"
            onPress={() =>
              monthKey < thisMonth && setMonthKey(shiftMonthKey(monthKey, 1))
            }
          >
            <AppText
              variant="body"
              color={monthKey >= thisMonth ? colors.ink20 : colors.ink60}
            >
              ›
            </AppText>
          </IconButton>
        </View>

        {/* Summary */}
        <Card style={styles.card}>
          <Pressable
            style={styles.cardHeader}
            onPress={() => setExpanded(e => !e)}
          >
            <View style={styles.iconChip}>
              <AppText variant="body">👀</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">All Habits</AppText>
              <AppText variant="alt" color={colors.ink40}>
                Summary ·{' '}
                {periodTitle === 'This month' ? 'this month' : periodTitle}
              </AppText>
            </View>
            <ProgressRing
              size={44}
              strokeWidth={4}
              progress={successRate / 100}
              color={successRate >= 70 ? colors.green : colors.blue}
              trackColor={colors.ink10}
            >
              <AppText variant="chip" color={colors.ink60}>
                {successRate}
              </AppText>
            </ProgressRing>
            <AppText variant="body" color={colors.ink40}>
              {expanded ? '⌃' : '⌄'}
            </AppText>
          </Pressable>
          {expanded && (
            <View style={styles.summaryGrid}>
              {summary.map(s => (
                <View key={s.label} style={styles.summaryCell}>
                  <AppText variant="chip" color={colors.ink40}>
                    {s.label}
                  </AppText>
                  <AppText variant="title" color={s.color}>
                    {s.value}
                  </AppText>
                </View>
              ))}
              <View style={styles.summaryCell}>
                <AppText variant="chip" color={colors.ink40}>
                  Perfect Days
                </AppText>
                <AppText variant="title" color={colors.blue}>
                  {perfectDaysInWindow} ⚡
                </AppText>
              </View>
            </View>
          )}
        </Card>

        {/* Consistency heatmap — every day of the last 12 weeks */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconChip}>
              <AppText variant="body">🗓️</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Consistency</AppText>
              <AppText variant="alt" color={colors.ink40}>
                Every day · last 12 weeks
              </AppText>
            </View>
          </View>
          <View style={styles.heatRow}>
            {heatWeeks.map((week, w) => (
              <View key={w} style={styles.heatCol}>
                {week.map(cell => (
                  <View
                    key={cell.key}
                    style={[
                      styles.heatCell,
                      cell.frac == null
                        ? styles.heatFuture
                        : cell.frac >= 1
                        ? styles.heatFull
                        : cell.frac > 0
                        ? styles.heatPart
                        : null,
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
          <View style={styles.heatLegend}>
            <View style={styles.heatCell} />
            <AppText variant="chip" color={colors.ink40}>
              Missed
            </AppText>
            <View style={[styles.heatCell, styles.heatPart]} />
            <AppText variant="chip" color={colors.ink40}>
              Partial
            </AppText>
            <View style={[styles.heatCell, styles.heatFull]} />
            <AppText variant="chip" color={colors.ink40}>
              Perfect
            </AppText>
          </View>
        </Card>

        {/* Wellbeing & productivity */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconChip}>
              <AppText variant="body">🧠</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Wellbeing</AppText>
              <AppText variant="alt" color={colors.ink40}>
                {Platform.OS === 'android'
                  ? 'Sleep, pickups & screen time · today'
                  : 'Sleep · today'}
              </AppText>
            </View>
            <ProgressRing
              size={44}
              strokeWidth={4}
              progress={productivity / 100}
              color={productivity >= 70 ? colors.green : colors.blue}
              trackColor={colors.ink10}
            >
              <AppText variant="chip" color={colors.ink60}>
                {productivity}
              </AppText>
            </ProgressRing>
          </View>

          {/* Sleep */}
          <View style={styles.wbRow}>
            <AppText variant="body">😴</AppText>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">
                {sleepMinutes != null ? fmtMin(sleepMinutes) : 'Sleep'}
              </AppText>
              <AppText variant="alt" color={colors.ink40}>
                {sleep
                  ? `${hhmm(sleep.bedtime)} → ${hhmm(
                      sleep.wake,
                    )} · from ${healthSourceName}`
                  : healthConnected
                  ? 'No sleep data last night — log below'
                  : `Connect ${healthSourceName} in Settings, or log manually`}
              </AppText>
            </View>
            {!sleep && (
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => bumpWellbeing('sleepMinutes', -30)}
                  style={styles.stepBtn}
                >
                  <AppText variant="bodyMedium" color={colors.ink60}>
                    −
                  </AppText>
                </Pressable>
                <AppText variant="chip" color={colors.ink60}>
                  30m
                </AppText>
                <Pressable
                  onPress={() => bumpWellbeing('sleepMinutes', 30)}
                  style={styles.stepBtn}
                >
                  <AppText variant="bodyMedium" color={colors.ink60}>
                    +
                  </AppText>
                </Pressable>
              </View>
            )}
          </View>

          {/* Screen Time — pickups, social and total minutes (Android only;
              Apple keeps these inside its own extension) */}
          <ScreenTimeRow />
        </Card>

        {/* Completion chart */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconChip}>
              <AppText variant="body">📈</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Habits</AppText>
              <AppText variant="alt" color={colors.ink40}>
                Completion by week
              </AppText>
            </View>
            <View style={styles.burnChip}>
              <AppText variant="alt" color={colors.ink}>
                🔥 Burn!
              </AppText>
              <AppText variant="chip" color={colors.ink40}>
                {completedInWindow} habits
              </AppText>
            </View>
          </View>

          <>
            <Svg width={chartW} height={chartH}>
              {[0.25, 0.5, 0.75].map(f => (
                <Line
                  key={f}
                  x1={0}
                  x2={chartW}
                  y1={chartH * f}
                  y2={chartH * f}
                  stroke={colors.ink10}
                  strokeWidth={1}
                  strokeDasharray="4 5"
                />
              ))}
              {pts.length > 1 && (
                <>
                  <Path d={area} fill="rgba(56,67,255,0.10)" />
                  <Path
                    d={line}
                    stroke={colors.blue}
                    strokeWidth={2.5}
                    fill="none"
                  />
                  <Line
                    x1={last.x}
                    x2={last.x}
                    y1={last.y}
                    y2={chartH}
                    stroke={colors.blue}
                    strokeWidth={2}
                  />
                  <Circle cx={last.x} cy={last.y} r={4.5} fill={colors.blue} />
                </>
              )}
            </Svg>
            <View style={styles.xLabels}>
              {series.map((p, i) => (
                <AppText key={i} variant="chip" color={colors.ink20}>
                  {p.label}
                </AppText>
              ))}
            </View>
          </>
        </Card>

        {/* Avg mood */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconChip}>
              <AppText variant="body">{avgMood ?? '🙂'}</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">{moodLabel}</AppText>
              <AppText variant="alt" color={colors.ink40}>
                Avg. mood · tap the mood chip on Home to log
              </AppText>
            </View>
          </View>
          <View style={styles.moodRow}>
            {moodDates.map((m, i) => (
              <View key={i} style={styles.moodCell}>
                <AppText
                  variant="title"
                  color={m.logged ? colors.ink : colors.ink20}
                  style={{ transform: [{ translateY: -m.lift }] }}
                >
                  {m.face}
                </AppText>
                <AppText variant="chip" color={colors.ink20}>
                  {m.d}
                </AppText>
              </View>
            ))}
          </View>
        </Card>

        {/* Last time — the Logbook's headline rows */}
        {logbook.trackers.length > 0 && (
          <Card style={styles.card} accessible={false}>
            <Pressable
              style={styles.cardHeader}
              accessibilityRole="button"
              accessibilityHint="Opens the Logbook"
              onPress={() => navigation.navigate('Logbook')}
            >
              <View style={styles.iconChip}>
                <AppText variant="body">📒</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyMedium">Last time</AppText>
                <AppText variant="alt" color={colors.ink40}>
                  From your Logbook
                </AppText>
              </View>
              <AppText variant="body" color={colors.ink40}>
                ›
              </AppText>
            </Pressable>
            {trackerRows(logbook, todayKey())
              .slice(0, 3)
              .map(row => (
                // No controls inside — merge into ONE VoiceOver element so
                // it reads "Haircut, today · 1 time" as a sentence.
                <View key={row.tracker.id} style={styles.wbRow} accessible>
                  <AppText variant="body">{row.tracker.emoji}</AppText>
                  <AppText variant="bodyMedium" style={styles.flex}>
                    {row.tracker.name}
                  </AppText>
                  <AppText variant="alt" color={colors.ink60}>
                    {sinceLabel(row.daysSince)} · {rhythmLabel(row)}
                  </AppText>
                </View>
              ))}
          </Card>
        )}
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
    gap: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  card: { gap: spacing.md, alignSelf: 'stretch' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  heatCol: { gap: 4 },
  heatCell: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.ink10,
  },
  heatPart: { backgroundColor: colors.blue40 },
  heatFull: { backgroundColor: '#FFC736' },
  heatFuture: { backgroundColor: 'transparent' },
  heatLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  summaryCell: { width: '50%', gap: 2 },
  burnChip: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: 'flex-end',
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  moodCell: { alignItems: 'center', gap: spacing.xs },
  wbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ActivityScreen;
