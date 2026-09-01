import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Trip } from '../../data/grocery';
import {
  avgPerTrip,
  deltaSentence,
  formatEur,
  monthLabel,
  monthOverMonth,
  monthSpend,
  monthTripCount,
} from '../../services/grocery';
import { colors, spacing } from '../../theme/theme';
import AppText from '../AppText';
import { Card } from '../common';

type Props = {
  trips: Trip[];
  monthKey: string;
  onPress?: () => void;
};

/** "September 2026 · €200.00 · 6 shops · €60 less than August". */
function MonthSummary({ trips, monthKey, onPress }: Props) {
  const spend = monthSpend(trips, monthKey);
  const count = monthTripCount(trips, monthKey);
  const delta = monthOverMonth(trips, monthKey);
  // Spending more than a month with no shops is not a regression, so a first
  // month reads neutral rather than red.
  const tone =
    delta.previous === 0
      ? colors.ink60
      : delta.deltaAbs < 0
      ? colors.green
      : delta.deltaAbs > 0
      ? colors.red
      : colors.ink60;

  return (
    <Card onPress={onPress} accessible={false}>
      <View
        accessible
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={`${monthLabel(monthKey)}: ${formatEur(
          spend,
        )} across ${count} shops. ${deltaSentence(delta, monthKey)}.`}
        style={styles.body}
      >
        <AppText variant="chip" color={colors.ink60}>
          {monthLabel(monthKey)}
        </AppText>
        <AppText variant="h5">{formatEur(spend)}</AppText>
        <AppText variant="body" color={colors.ink60}>
          {count === 0
            ? 'No shops logged yet'
            : `${count} ${count === 1 ? 'shop' : 'shops'} · ${formatEur(
                avgPerTrip(trips, monthKey),
              )} average`}
        </AppText>
        <AppText variant="bodyMedium" color={tone}>
          {deltaSentence(delta, monthKey)}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.xs },
});

export default MonthSummary;
