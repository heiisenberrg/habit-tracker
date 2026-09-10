import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { todayKey, useStore } from '../store/useStore';
import { routeAfterSplash } from './QuoteOfDayScreen';

const mark = require('../assets/splash-logo.png');

/** #161616 + the brand-red mark — pixel-for-pixel the native launch screen. */
function SplashScreen() {
  const navigation = useNavigation<any>();
  const onboarded = useStore(s => s.onboarded);
  const quoteShownOn = useStore(s => s.quoteShownOn);
  const { width } = useWindowDimensions();
  // Don't route until the persisted store has rehydrated — a slow cold
  // start would otherwise read the default onboarded=false and dump a
  // returning user back into onboarding. Route the moment it has: this
  // screen mirrors the native launch screen, so the two read as ONE splash —
  // any dwell here reads as a second one.
  const [hydrated, setHydrated] = useState(() =>
    useStore.persist.hasHydrated(),
  );

  // Subscribe, THEN re-check: hydration can finish between the first
  // render's hasHydrated() read and this effect's subscription (a release
  // build on a fresh Android install does exactly that), and a callback
  // registered after the fact never fires — the splash would sit forever.
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    if (useStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    navigation.reset({
      index: 0,
      routes: [
        { name: routeAfterSplash(onboarded, quoteShownOn, todayKey()) },
      ],
    });
  }, [navigation, onboarded, quoteShownOn, hydrated]);

  const size = width * 0.32;
  return (
    <View style={styles.fill}>
      <Image
        source={mark}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The launch storyboard's exact ground; literal on purpose (no theme flip).
  fill: {
    flex: 1,
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SplashScreen;
