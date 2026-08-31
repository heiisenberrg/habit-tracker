import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import {
  DailyQuote,
  getDailyQuote,
  ZENQUOTES_ATTRIBUTION_URL,
} from '../services/quotes';
import { todayKey, useStore } from '../store/useStore';
import { gradients, radius, screenPadding, spacing } from '../theme/theme';

/** How long the first open of the day dwells on the quote before Home. */
export const QUOTE_DWELL_MS = 30_000;

/**
 * Where the splash goes once the store has hydrated: returning users see the
 * quote of the day once per calendar day, then Home.
 */
export const routeAfterSplash = (
  onboarded: boolean,
  quoteShownOn: string | null | undefined,
  today: string,
): 'Onboarding' | 'QuoteOfDay' | 'Main' => {
  if (!onboarded) {
    return 'Onboarding';
  }
  return quoteShownOn === today ? 'Main' : 'QuoteOfDay';
};

/** Full-screen quote of the day: 30 s dwell, tap Continue to go on. */
function QuoteOfDayScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const markQuoteShown = useStore(s => s.markQuoteShown);
  const setDailyQuote = useStore(s => s.setDailyQuote);
  const [quote, setQuote] = useState<DailyQuote | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    markQuoteShown(todayKey());
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  useEffect(() => {
    let alive = true;
    getDailyQuote().then(q => {
      if (alive) {
        setQuote(q);
        setDailyQuote(q);
      }
    });
    return () => {
      alive = false;
    };
  }, [setDailyQuote]);

  useEffect(() => {
    // Progress bar + auto-advance share one clock.
    Animated.timing(progress, {
      toValue: 1,
      duration: QUOTE_DWELL_MS,
      useNativeDriver: false,
    }).start();
    const t = setTimeout(finish, QUOTE_DWELL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient
      colors={gradients.blue}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <View
        style={[
          styles.body,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <AppText variant="chip" color="rgba(255,255,255,0.75)">
          Quote of the day
        </AppText>
        <View style={styles.center}>
          {quote ? (
            <>
              <AppText variant="h5" color="#FFFFFF" accessibilityRole="text">
                “{quote.text}”
              </AppText>
              <AppText variant="title" color="rgba(255,255,255,0.85)">
                — {quote.author}
              </AppText>
            </>
          ) : (
            <AppText variant="title" color="rgba(255,255,255,0.85)">
              Finding today’s line…
            </AppText>
          )}
        </View>
        <View style={styles.footer}>
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Time until Home"
          >
            <Animated.View style={[styles.bar, { width }]} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue"
            onPress={finish}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <AppText variant="bodyMedium" color="#FFFFFF">
              Continue
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Quotes by ZenQuotes"
            onPress={() =>
              Linking.openURL(ZENQUOTES_ATTRIBUTION_URL).catch(() => {})
            }
            hitSlop={8}
          >
            <AppText variant="alt" color="rgba(255,255,255,0.7)" center>
              Quotes by ZenQuotes
            </AppText>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { flex: 1, paddingHorizontal: screenPadding, gap: spacing.lg },
  center: { flex: 1, justifyContent: 'center', gap: spacing.md },
  footer: { gap: spacing.md },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  bar: { height: 3, backgroundColor: '#FFFFFF' },
  cta: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});

export default QuoteOfDayScreen;
