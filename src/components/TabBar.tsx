import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { chartSteps, colors, radius, spacing } from '../theme/theme';
import { IconProps } from './icons';
import {
  BasketIcon,
  HomeIcon,
  MedalIcon,
  ProfileIcon,
  WalletIcon,
} from './icons';

const ICONS: Record<string, React.ComponentType<IconProps>> = {
  Home: HomeIcon,
  Grocery: BasketIcon,
  Expenses: WalletIcon,
  Activity: MedalIcon,
  Profile: ProfileIcon,
};

/**
 * Tab tints must be LITERAL hexes (they are injected into SVG xml, where
 * DynamicColorIOS cannot resolve). Active reuses the theme's per-scheme
 * brand-blue pair; inactive is ink60's value for each scheme — solid, so
 * every icon is plainly visible on the pill.
 */
const INACTIVE_TINT = { light: '#737373', dark: '#B3B3B3' } as const;

/** Floating pill tab bar (Home · Grocery · Expenses · Activity · Profile). */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name];
          if (!Icon) {
            return null;
          }
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={route.name}
              accessibilityState={{ selected: focused }}
              onPress={() => navigation.navigate(route.name)}
              style={styles.tab}
            >
              <Icon
                size={24}
                color={
                  focused ? chartSteps[scheme].on : INACTIVE_TINT[scheme]
                }
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: 20,
    shadowColor: '#232C5D',
    shadowOpacity: 0.06,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  tab: { alignItems: 'center', justifyContent: 'center', flex: 1 },
});

export default TabBar;
