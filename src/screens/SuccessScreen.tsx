import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Polygon,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import AppText from '../components/AppText';
import { RootStackParamList } from '../navigation/RootNavigator';
import { dayStreak, useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

/**
 * Gold congrats screen per the Figma Success design. Two variants: with a
 * `title` param (habit just added) or without (perfect day — every habit and
 * task done, fired once per day from Home).
 */
function SuccessScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Success'>>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const store = useStore();

  const isPerfectDay = !route.params?.title;
  const streak = dayStreak(store);
  // Perfect day: the shield shows the real streak. Habit added: a checkmark
  // (there is no meaningful number to show).
  const badge = isPerfectDay && streak > 0 ? String(streak) : null;

  const headline = isPerfectDay
    ? 'Congrats!\nGoal achieved —\na perfect day!'
    : 'Congrats!';
  const sub = route.params?.title ?? undefined;

  // Mirror the milestone into the in-app inbox (Home latches the Success
  // navigation once per day, so this can't spam).
  const inboxLogged = useRef(false);
  useEffect(() => {
    if (isPerfectDay && !inboxLogged.current) {
      inboxLogged.current = true;
      useStore.getState().addInboxItem({
        title: 'Perfect day! ⚡',
        body: 'You completed every habit today. Your streak keeps growing — keep it up!',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cx = width / 2;
  const cy = height * 0.36;
  const rays: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a1 = (i * 30 * Math.PI) / 180;
    const a2 = ((i * 30 + 14) * Math.PI) / 180;
    const r = Math.max(width, height);
    rays.push(
      `${cx},${cy} ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} ${
        cx + r * Math.cos(a2)
      },${cy + r * Math.sin(a2)}`,
    );
  }

  return (
    <LinearGradient colors={['#FFC554', '#F7A928']} style={styles.fill}>
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {rays.map((points, i) => (
          <Polygon key={i} points={points} fill="rgba(255,255,255,0.10)" />
        ))}
      </Svg>

      <Pressable
        onPress={() => navigation.goBack()}
        style={[styles.back, { top: insets.top + spacing.sm }]}
      >
        <AppText variant="h6">‹</AppText>
      </Pressable>

      <View
        style={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <View style={styles.hero}>
          {/* gold badge shield: real streak count, or a check for a new habit */}
          <Svg width={150} height={168} viewBox="0 0 120 134">
            <Defs>
              <SvgGradient id="shield" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFE082" />
                <Stop offset="1" stopColor="#F9A825" />
              </SvgGradient>
            </Defs>
            <Path
              d="M60 6 C 80 14 98 15 110 12 L 110 66 C 110 96 90 116 60 128 C 30 116 10 96 10 66 L 10 12 C 22 15 40 14 60 6 Z"
              fill="url(#shield)"
              stroke="#FFD54F"
              strokeWidth={4}
            />
            <SvgText
              x="60"
              y={badge && badge.length > 2 ? '80' : '84'}
              fontSize={badge && badge.length > 2 ? '36' : '52'}
              fontWeight="bold"
              fill="#F57F17"
              textAnchor="middle"
            >
              {badge ?? '✓'}
            </SvgText>
          </Svg>
          <AppText variant="h5" color={colors.white} center>
            {headline}
          </AppText>
          <AppText
            variant="body"
            color="rgba(255,255,255,0.92)"
            center
            style={styles.body}
          >
            {sub ??
              (streak > 1
                ? `That's ${streak} perfect days in a row. This badge is a symbol of your commitment to yourself — keep the streak alive!`
                : 'Every habit and task done today. This badge is a symbol of your commitment to yourself — keep going!')}
          </AppText>
        </View>
        <Pressable
          onPress={() =>
            navigation.reset({ index: 0, routes: [{ name: 'Main' }] })
          }
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <AppText variant="bodyMedium">Continue</AppText>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  back: {
    position: 'absolute',
    left: screenPadding,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: screenPadding },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  body: { maxWidth: 300 },
  button: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});

export default SuccessScreen;
