import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useStore } from '../store/useStore';
import { gradients } from '../theme/theme';

const splashArt = require('../assets/splash-art.png');

function SplashScreen() {
  const navigation = useNavigation<any>();
  const onboarded = useStore(s => s.onboarded);
  const { width, height } = useWindowDimensions();
  // Don't route until the persisted store has rehydrated — a slow cold
  // start would otherwise read the default onboarded=false and dump a
  // returning user back into onboarding.
  const [hydrated, setHydrated] = useState(() =>
    useStore.persist.hasHydrated(),
  );

  useEffect(
    () => useStore.persist.onFinishHydration(() => setHydrated(true)),
    [],
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const t = setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: onboarded ? 'Main' : 'Onboarding' }],
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [navigation, onboarded, hydrated]);

  return (
    <LinearGradient
      colors={gradients.blue}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <View style={styles.fill}>
        <Image
          source={splashArt}
          style={{ width, height }}
          resizeMode="cover"
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export default SplashScreen;
