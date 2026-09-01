import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { StoreRow, formatEur } from '../../services/grocery';
import { chartSteps, colors, spacing } from '../../theme/theme';
import AppText from '../AppText';
import { Card } from '../common';

type Props = {
  rows: StoreRow[];
  emptyLabel: string;
};

/**
 * Money per shop, ranked. The bar length is the share of spend — the same
 * quantity as the euro figure beside it, never the trip count.
 */
function StoreBars({ rows, emptyLabel }: Props) {
  const dark = useColorScheme() === 'dark';
  const step = dark ? chartSteps.dark : chartSteps.light;
  const top = rows[0]?.spend ?? 0;

  if (rows.length === 0) {
    return (
      <AppText variant="body" color={colors.ink60}>
        {emptyLabel}
      </AppText>
    );
  }

  return (
    <>
      {rows.map((row, i) => (
        <Card key={row.storeId} accessible={false}>
          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={`${row.name}: ${formatEur(row.spend)} over ${
              row.trips
            } ${row.trips === 1 ? 'shop' : 'shops'}, ${Math.round(
              row.share * 100,
            )} percent of the total`}
            style={styles.row}
          >
            <View style={styles.top}>
              <AppText variant="bodyMedium" style={styles.flex}>
                {row.name}
              </AppText>
              <AppText variant="bodyMedium">{formatEur(row.spend)}</AppText>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${top === 0 ? 0 : (row.spend / top) * 100}%`,
                    backgroundColor: i === 0 ? step.on : step.off,
                  },
                ]}
              />
            </View>
            <AppText variant="alt" color={colors.ink60}>
              {row.trips} {row.trips === 1 ? 'shop' : 'shops'} ·{' '}
              {Math.round(row.share * 100)}% of the total
            </AppText>
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { gap: spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink10,
    overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: 4 },
});

export default StoreBars;
