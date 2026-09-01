import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { Card, IconButton, SegmentControl } from '../components/common';
import { MOOD_FACES } from '../data/seed';
import { getLastNightSleep, SleepSummary } from '../services/health';
import {
  getScreenTimeState,
  openScreenTimeReport,
  ScreenTimeState,
} from '../services/screenTime';
import {
  addDays,
  dayCompletion,
  dayStreak,
  doneOn,
  historyDayFraction,
  karma,
  perfectToday,
  progressFor,
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

const SEGMENTS = ['Daily', 'Weekly', 'Monthly'] as const;
/** Window length in days per segment. */
const WINDOW = [1, 7, 30] as const;
/** How far back navigation may go while history (83 days) still has data. */
const MAX_OFFSET = [83, 11, 2] as const;

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Activity: period-aware summary, wellbeing, completion chart and mood. */
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
  } = store;
  const [seg, setSeg] = useState(1);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [sleep, setSleep] = useState<SleepSummary | null>(null);
  const [screenTime, setScreenTime] = useState<ScreenTimeState>({
    supported: false,
    authorized: false,
  });

  useEffect(() => {
    if (healthConnected) {
      getLastNightSleep().then(setSleep);
    }
  }, [healthConnected]);

  // Screen Time is its own permission, unrelated to Apple Health — asking for
  // it inside the health branch meant it never ran on a fresh install.
  useEffect(() => {
    getScreenTimeState().then(setScreenTime);
  }, []);

  const changeSeg = (i: number) => {
    setSeg(i);
    setOffset(0);
  };

  /* ------------------------- period window ------------------------- */

  const today = useMemo(() => new Date(new Date().setHours(0, 0, 0, 0)), []);
  const windowLen = WINDOW[seg];
  const windowEnd = addDays(today, -offset * windowLen);
  const windowDates = useMemo(
    () =>
      Array.from({ length: windowLen }, (_, i) =>
        addDays(windowEnd, i - (windowLen - 1)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seg, offset],
  );

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const periodTitle =
    offset === 0
      ? ['Today', 'This week', 'This month'][seg]
      : seg === 0
      ? offset === 1
        ? 'Yesterday'
        : windowEnd.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })
      : `${offset} ${seg === 1 ? 'week' : 'month'}${offset > 1 ? 's' : ''} ago`;
  const periodRange =
    windowLen === 1
      ? fmt(windowEnd)
      : `${fmt(windowDates[0])} - ${fmt(windowEnd)}`;

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

  // Daily -> per-habit bars for the focus day
  const dailyBars = habits.map(h => {
    const key = toDateKey(windowEnd);
    let frac: number;
    if (key === todayKey()) {
      frac = statusOn(statuses, h.id) ? 0 : progressFor(completions, h);
    } else {
      const diff = Math.round(
        (today.getTime() - windowEnd.getTime()) / 86400000,
      );
      frac = diff >= 1 && diff <= 83 ? histories[h.id]?.[83 - diff] ?? 0 : 0;
    }
    return { id: h.id, emoji: h.emoji, frac };
  });

  // Weekly -> one point per day; Monthly -> 4 weekly averages of the window
  const series: { label: string; value: number }[] = useMemo(() => {
    if (seg === 1) {
      return windowDates.map(d => ({
        label: WD[d.getDay()],
        value: Math.round((dayFractionFor(d) ?? 0) * 100),
      }));
    }
    if (seg === 2) {
      const chunks: { label: string; value: number }[] = [];
      for (let c = 0; c < 4; c++) {
        const slice = windowDates.slice(c * 7 + 2, c * 7 + 9);
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
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg, offset, completions, statuses, habits]);

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

  const moodDates = (windowLen >= 7 ? windowDates.slice(-7) : [windowEnd]).map(
    d => {
      const key = toDateKey(d);
      const face = moods[key];
      return {
        d: WD[d.getDay()],
        face: face ?? '·',
        lift: face ? Math.max(0, MOOD_FACES.indexOf(face as never)) * 5 : 0,
        logged: !!face,
      };
    },
  );
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
   * Only signals Routiner can verify: a perfect day and Apple Health sleep.
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
        </View>
        <SegmentControl
          tabs={[...SEGMENTS]}
          active={seg}
          onChange={changeSeg}
        />
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
            accessibilityLabel="Earlier period"
            onPress={() => setOffset(o => Math.min(MAX_OFFSET[seg], o + 1))}
          >
            <AppText
              variant="body"
              color={offset >= MAX_OFFSET[seg] ? colors.ink20 : colors.ink60}
            >
              ‹
            </AppText>
          </IconButton>
          <IconButton
            size={34}
            accessibilityLabel="Later period"
            onPress={() => setOffset(o => Math.max(0, o - 1))}
          >
            <AppText
              variant="body"
              color={offset === 0 ? colors.ink20 : colors.ink60}
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
                Summary · {periodTitle.toLowerCase()}
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
                Sleep, pickups & screen time · today
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
                    )} · from Apple Health`
                  : healthConnected
                  ? 'No sleep data last night — log below'
                  : 'Connect Apple Health in Settings, or log manually'}
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

          {/* Screen Time — pickups and social apps, rendered by Apple */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              screenTime.authorized
                ? "Open today's Screen Time report"
                : 'Screen Time report needs permission'
            }
            onPress={() => screenTime.authorized && openScreenTimeReport()}
            style={styles.wbRow}
          >
            <AppText variant="body">📵</AppText>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Pickups & social apps</AppText>
              <AppText variant="alt" color={colors.ink60}>
                {!screenTime.supported
                  ? 'Needs iOS 16 or later'
                  : screenTime.authorized
                  ? "Today's numbers, straight from Screen Time"
                  : 'Turn on Screen Time access in Settings → App Lock'}
              </AppText>
            </View>
            {screenTime.supported && screenTime.authorized && (
              <AppText variant="bodyMedium" color={colors.blue}>
                View
              </AppText>
            )}
          </Pressable>
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
                {seg === 0
                  ? `Per habit · ${periodTitle.toLowerCase()}`
                  : seg === 1
                  ? 'Completion by day'
                  : 'Completion by week'}
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

          {seg === 0 ? (
            <View style={styles.barsRow}>
              {dailyBars.map(b => (
                <Pressable
                  key={b.id}
                  accessibilityRole="button"
                  onPress={() =>
                    navigation.navigate('HabitDetail', { id: b.id })
                  }
                  style={({ pressed }) => [
                    styles.barCol,
                    pressed && styles.barPressed,
                  ]}
                >
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(4, b.frac * 100)}%`,
                          backgroundColor:
                            b.frac >= 1 ? colors.green : colors.blue,
                        },
                      ]}
                    />
                  </View>
                  <AppText variant="body">{b.emoji}</AppText>
                </Pressable>
              ))}
            </View>
          ) : (
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
                    <Circle
                      cx={last.x}
                      cy={last.y}
                      r={4.5}
                      fill={colors.blue}
                    />
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
          )}
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
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 130,
    paddingTop: spacing.sm,
  },
  barCol: { alignItems: 'center', gap: spacing.xs, flex: 1 },
  barPressed: { opacity: 0.7 },
  barTrack: {
    width: 14,
    height: 96,
    borderRadius: 7,
    backgroundColor: colors.ink10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 7 },
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
