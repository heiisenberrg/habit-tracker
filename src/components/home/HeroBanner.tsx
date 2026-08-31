import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppText from '../AppText';
import ProgressRing from '../ProgressRing';
import { PrimaryButton } from '../common';
import { CalendarIcon } from '../icons';
import { colors, gradients, radius, spacing } from '../../theme/theme';

type Props = {
  dailyProgress: number;
  doneCount: number;
  habitCount: number;
  streak: number;
  perfect: boolean;
  freezes: number;
  mood: string;
  zenOn: boolean;
  onCalendar: () => void;
  onMood: () => void;
  onZen: () => void;
  /** Empty-habits state actions (design review 3A). */
  onAddHabit: () => void;
  onAssistant: () => void;
};

/**
 * Headline + sub-line derive from the SAME signal as the ring so they never
 * disagree (design review 5A): the first partial log is acknowledged.
 */
export const heroCopy = (
  dailyProgress: number,
  doneCount: number,
  habitCount: number,
): { title: string; sub: string } => {
  const pct = Math.round(dailyProgress * 100);
  if (habitCount === 0) {
    return { title: 'Start with one habit', sub: '' };
  }
  if (doneCount === habitCount) {
    return {
      title: 'Perfect day — streak secured! 🔥',
      sub: `${doneCount} of ${habitCount} habits done today`,
    };
  }
  if (doneCount === 0 && pct === 0) {
    return {
      title: 'Fresh day. Start small.',
      sub: `0 of ${habitCount} habits done today`,
    };
  }
  if (doneCount === 0) {
    return {
      title: `Good start — ${pct}% in`,
      sub: `0 of ${habitCount} done · keep going`,
    };
  }
  return {
    title: `Nice pace — ${habitCount - doneCount} to go`,
    sub: `${doneCount} of ${habitCount} habits done today`,
  };
};

/** Daily goal banner with quick actions: calendar · streak · mood · zen. */
function HeroBanner({
  dailyProgress,
  doneCount,
  habitCount,
  streak,
  perfect,
  freezes,
  mood,
  zenOn,
  onCalendar,
  onMood,
  onZen,
  onAddHabit,
  onAssistant,
}: Props) {
  const copy = heroCopy(dailyProgress, doneCount, habitCount);
  // A small nod when progress goes UP (the only motion in this banner).
  const scale = useRef(new Animated.Value(1)).current;
  const lastProgress = useRef(dailyProgress);
  useEffect(() => {
    if (dailyProgress > lastProgress.current) {
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
    lastProgress.current = dailyProgress;
  }, [dailyProgress, scale]);

  if (habitCount === 0) {
    return (
      <View style={styles.infoBox}>
        <LinearGradient
          colors={gradients.blue}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={styles.gradientFill}
        />
        <View style={styles.orbitSm} pointerEvents="none" />
        <View style={styles.orbitLg} pointerEvents="none" />
        <AppText variant="title" color={colors.white}>
          {copy.title}
        </AppText>
        <AppText variant="body" color="rgba(255,255,255,0.85)">
          Pick something you will actually do today — the streak starts with it.
        </AppText>
        <PrimaryButton
          label="Add a habit"
          onPress={onAddHabit}
          style={styles.emptyCta}
        />
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Ask the assistant"
          onPress={onAssistant}
          hitSlop={8}
        >
          <AppText variant="bodyMedium" color={colors.white} center>
            or ask the assistant
          </AppText>
        </Pressable>
      </View>
    );
  }

  return (
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
        <Animated.View style={{ transform: [{ scale }] }}>
          <ProgressRing size={56} strokeWidth={4} progress={dailyProgress}>
            <AppText variant="bodyMedium" color={colors.white}>
              {Math.round(dailyProgress * 100)}%
            </AppText>
          </ProgressRing>
        </Animated.View>
        <View style={styles.flex}>
          <AppText variant="title" color={colors.white}>
            {copy.title}
          </AppText>
          <AppText variant="alt" color={colors.blue40}>
            {copy.sub}
          </AppText>
        </View>
      </View>
      <View style={styles.infoActions}>
        <Pressable style={styles.infoBtn} onPress={onCalendar}>
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
          {freezes > 0 && (
            <AppText variant="chip" color="#9BE8FF">
              🧊{freezes}
            </AppText>
          )}
        </View>
        <Pressable style={styles.infoBtn} onPress={onMood}>
          <AppText variant="h6">{mood}</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={zenOn ? 'Zen session running' : 'Start zen'}
          style={[styles.infoBtn, zenOn && styles.zenOn]}
          onPress={onZen}
        >
          <AppText variant="bodyMedium">🧘</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  zenOn: { backgroundColor: 'rgba(255,255,255,0.34)' },
  emptyCta: { alignSelf: 'stretch' },
  streakEmojiIdle: { opacity: 0.35 },
  gradientFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});

export default HeroBanner;
