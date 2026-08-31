import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppText from '../AppText';
import ProgressRing from '../ProgressRing';
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
}: Props) {
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
        <ProgressRing size={56} strokeWidth={4} progress={dailyProgress}>
          <AppText variant="bodyMedium" color={colors.white}>
            {Math.round(dailyProgress * 100)}%
          </AppText>
        </ProgressRing>
        <View style={styles.flex}>
          <AppText variant="title" color={colors.white}>
            {habitCount === 0
              ? 'Add your first habit ✨'
              : doneCount === habitCount
              ? 'Perfect day — streak secured! 🔥'
              : doneCount === 0
              ? 'Fresh day. Start small.'
              : `Nice pace — ${habitCount - doneCount} to go`}
          </AppText>
          <AppText variant="alt" color={colors.blue40}>
            {doneCount} of {habitCount} habits done today
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
