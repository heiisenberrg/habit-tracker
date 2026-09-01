import React from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import {
  MonthPoint,
  formatEur,
  formatEurCompact,
  monthLabel,
  monthTick,
} from '../../services/grocery';
import { chartSteps, colors, radius, spacing } from '../../theme/theme';
import AppText from '../AppText';

type Props = {
  series: MonthPoint[];
  selected: string;
  onSelect: (monthKey: string) => void;
};

const PLOT_HEIGHT = 96;
/** A zero month still needs a visible foot, or the column disappears. */
const ZERO_STUB = 3;

/**
 * Month-over-month spend. One measure, so one hue in two steps: the selected
 * month is the darker step, the rest the lighter one. Every column carries its
 * own value (the contrast relief the chart palette owes) and the whole column
 * is the tap target, not just the bar.
 */
function SpendBars({ series, selected, onSelect }: Props) {
  const dark = useColorScheme() === 'dark';
  const step = dark ? chartSteps.dark : chartSteps.light;
  const max = Math.max(...series.map(p => p.spend), 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.plot}>
        {series.map(point => {
          const on = point.monthKey === selected;
          const height =
            max === 0 || point.spend === 0
              ? ZERO_STUB
              : Math.max(ZERO_STUB, (point.spend / max) * PLOT_HEIGHT);
          return (
            <Pressable
              key={point.monthKey}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${monthLabel(point.monthKey)}: ${
                point.spend === 0 ? 'no shops' : formatEur(point.spend)
              }`}
              onPress={() => onSelect(point.monthKey)}
              style={styles.column}
            >
              <AppText
                variant="alt"
                center
                color={on ? colors.ink : colors.ink60}
                numberOfLines={1}
                style={styles.value}
              >
                {point.spend === 0 ? '—' : formatEurCompact(point.spend)}
              </AppText>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor:
                      point.spend === 0
                        ? colors.ink20
                        : on
                        ? step.on
                        : step.off,
                  },
                ]}
              />
              <AppText
                variant="chip"
                center
                color={on ? colors.ink : colors.ink60}
              >
                {monthTick(point.monthKey)}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.baseline} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    minHeight: PLOT_HEIGHT + 44,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  value: { fontSize: 10, lineHeight: 14 },
  bar: {
    alignSelf: 'stretch',
    marginHorizontal: spacing.xs,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  baseline: {
    height: 1,
    backgroundColor: colors.ink10,
    borderRadius: radius.sm,
  },
});

export default SpendBars;
