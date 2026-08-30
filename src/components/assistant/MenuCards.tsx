import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import AppText from '../AppText';
import { ROOT_MENU } from '../../data/assistantFlows';
import { colors, radius, spacing } from '../../theme/theme';

/** One-line captions for the root menu action cards. */
const MENU_CAPTIONS: Record<string, string> = {
  habit: 'Build a routine with a goal and reminder',
  task: 'Plan something for today or tomorrow',
  reminder: 'A daily nudge at the right time',
  quick: 'One line — the rest is parsed for you',
  log: 'Say “done meditate” or “500 ml” to log it',
};

type Props = { onPick: (value: string) => void };

/** The assistant's root menu as a grid of action cards. */
function MenuCards({ onPick }: Props) {
  return (
    <View style={styles.menuGrid}>
      {ROOT_MENU.options.map(o => {
        const [emoji, ...rest] = o.label.split(' ');
        return (
          <Pressable
            key={o.value}
            onPress={() => onPick(o.value)}
            style={({ pressed }) => [
              styles.menuCard,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="h6">{emoji}</AppText>
            <AppText variant="bodyMedium">{rest.join(' ')}</AppText>
            <AppText variant="alt" color={colors.ink40}>
              {MENU_CAPTIONS[o.value] ?? ''}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  menuCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  pressed: { opacity: 0.7 },
});

export default MenuCards;
