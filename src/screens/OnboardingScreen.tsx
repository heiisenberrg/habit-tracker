import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import AppText from '../components/AppText';
import { colors, gradients, radius, spacing } from '../theme/theme';

type Page = { image: ImageSourcePropType; title: string; body: string };

const PAGES: Page[] = [
  {
    image: require('../assets/Illustration-1.png'),
    title: 'Create\nGood Habits',
    body: 'Change your life by slowly adding new healthy habits and sticking to them.',
  },
  {
    image: require('../assets/Illustration-2.png'),
    title: 'Track\nYour Progress',
    body: 'Everyday you become one step closer to your goal. Don’t give up!',
  },
  {
    image: require('../assets/Illustration-3.png'),
    title: 'Stay Consistent\nand Strong',
    body: 'Take on challenges, protect your streak, and build routines that stick.',
  },
];

function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<Page>>(null);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const illustrationHeight = height * 0.44;

  return (
    <LinearGradient
      colors={gradients.blue}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      {/* faint concentric circles backdrop */}
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Circle
          cx={width / 2}
          cy={height * 0.42}
          r={70}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={1.5}
          fill="none"
        />
        <Circle
          cx={width / 2}
          cy={height * 0.42}
          r={130}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1.5}
          fill="none"
        />
        <Circle
          cx={width / 2}
          cy={height * 0.42}
          r={195}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1.5}
          fill="none"
        />
      </Svg>

      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={p => p.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScrollToIndexFailed={info => {
          listRef.current?.scrollToOffset({
            offset: info.index * width,
            animated: true,
          });
        }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.page,
              { width, paddingTop: insets.top + spacing.sm },
            ]}
          >
            <Image
              source={item.image}
              style={{ width: width * 0.92, height: illustrationHeight }}
              resizeMode="contain"
            />
            <View style={styles.textBlock}>
              <AppText style={styles.title} color={colors.white}>
                {item.title}
              </AppText>
              <AppText
                variant="body"
                color="rgba(255,255,255,0.82)"
                style={styles.body}
              >
                {item.body}
              </AppText>
            </View>
          </View>
        )}
      />

      {/* dots */}
      <View style={styles.dots}>
        {PAGES.map((p, i) => (
          <Pressable
            key={p.title}
            onPress={() =>
              listRef.current?.scrollToIndex({ index: i, animated: true })
            }
            hitSlop={8}
            style={[styles.dot, i === page ? styles.dotActive : styles.dotIdle]}
          />
        ))}
      </View>

      {/* bottom actions */}
      <View
        style={[
          styles.actions,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <Pressable
          onPress={() => navigation.navigate('EmailAuth')}
          style={({ pressed }) => [
            styles.emailButton,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.arrowChip}>
            <AppText variant="alt" color={colors.white}>
              →
            </AppText>
          </View>
          <AppText variant="bodyMedium">Continue with E-mail</AppText>
        </Pressable>
        <AppText variant="alt" color="rgba(255,255,255,0.65)" center>
          Your habits and profile stay on this device
        </AppText>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { alignItems: 'center' },
  textBlock: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  body: { fontSize: 15, lineHeight: 22 },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: colors.surface },
  dotIdle: { backgroundColor: 'rgba(255,255,255,0.35)' },
  actions: { paddingHorizontal: spacing.xl, gap: spacing.md },
  emailButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  arrowChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
});

export default OnboardingScreen;
