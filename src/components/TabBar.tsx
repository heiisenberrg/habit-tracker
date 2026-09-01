import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/theme';
import { BasketIcon, HomeIcon, MedalIcon, ProfileIcon } from './icons';

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Home: HomeIcon,
  Grocery: BasketIcon,
  Activity: MedalIcon,
  Profile: ProfileIcon,
};

/** Floating pill tab bar (Home · Grocery · Activity · Profile). */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

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
              <View style={{ opacity: focused ? 1 : 0.45 }}>
                <Icon size={24} />
              </View>
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
