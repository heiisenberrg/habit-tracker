import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton } from '../components/common';
import MonthSummary from '../components/grocery/MonthSummary';
import {
  formatDayLabel,
  formatEur,
  monthKeyOf,
  monthLabel,
  shiftMonthKey,
  storeBreakdown,
  storeName,
  topItems,
  tripTotal,
  tripsInMonth,
} from '../services/grocery';
import { todayKey, useStore } from '../store/useStore';
import { colors, screenPadding, spacing } from '../theme/theme';

/** Where the month went: total, per-store split, biggest items, every shop. */
function GroceryInsightsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const grocery = useStore(s => s.grocery);
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(todayKey()));

  const rows = storeBreakdown(grocery.trips, grocery.stores, monthKey);
  const items = topItems(grocery.trips, monthKey, 5);
  const trips = tripsInMonth(grocery.trips, monthKey);
  const maxTrips = Math.max(1, ...rows.map(r => r.trips));
  const thisMonth = monthKeyOf(todayKey());

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton
          size={40}
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <AppText variant="h6" style={styles.flex}>
          Grocery spend
        </AppText>
        <IconButton
          size={32}
          accessibilityLabel="Previous month"
          onPress={() => setMonthKey(shiftMonthKey(monthKey, -1))}
        >
          <AppText variant="body" color={colors.ink60}>
            ‹
          </AppText>
        </IconButton>
        <IconButton
          size={32}
          accessibilityLabel="Next month"
          onPress={() =>
            monthKey < thisMonth && setMonthKey(shiftMonthKey(monthKey, 1))
          }
        >
          <AppText
            variant="body"
            color={monthKey >= thisMonth ? colors.ink20 : colors.ink60}
          >
            ›
          </AppText>
        </IconButton>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <MonthSummary trips={grocery.trips} monthKey={monthKey} />

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink60}>
            Where you shopped
          </AppText>
          {rows.length === 0 && (
            <AppText variant="body" color={colors.ink60}>
              No shops logged in {monthLabel(monthKey)}.
            </AppText>
          )}
          {rows.map(row => (
            <Card key={row.storeId} accessible={false}>
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={`${row.name}: ${row.trips} ${
                  row.trips === 1 ? 'shop' : 'shops'
                }, ${formatEur(row.spend)}, ${Math.round(
                  row.share * 100,
                )} percent of the month`}
                style={styles.storeRow}
              >
                <View style={styles.rowTop}>
                  <AppText variant="bodyMedium" style={styles.flex}>
                    {row.name}
                  </AppText>
                  <AppText variant="bodyMedium">{formatEur(row.spend)}</AppText>
                </View>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.bar,
                      { width: `${(row.trips / maxTrips) * 100}%` },
                    ]}
                  />
                </View>
                <AppText variant="alt" color={colors.ink60}>
                  {row.trips} {row.trips === 1 ? 'shop' : 'shops'} ·{' '}
                  {Math.round(row.share * 100)}% of the month
                </AppText>
              </View>
            </Card>
          ))}
        </View>

        {items.length > 0 && (
          <View style={styles.section}>
            <AppText variant="chip" color={colors.ink60}>
              Biggest items
            </AppText>
            {items.map(item => (
              <Card key={item.name} style={styles.rowCard} accessible={false}>
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">{item.name}</AppText>
                  <AppText variant="alt" color={colors.ink60}>
                    bought {item.count}
                    {item.count === 1 ? ' time' : ' times'}
                  </AppText>
                </View>
                <AppText variant="bodyMedium">{formatEur(item.spend)}</AppText>
              </Card>
            ))}
          </View>
        )}

        {trips.length > 0 && (
          <View style={styles.section}>
            <AppText variant="chip" color={colors.ink60}>
              Every shop in {monthLabel(monthKey)}
            </AppText>
            {trips.map(trip => (
              <Card
                key={trip.id}
                style={styles.rowCard}
                onPress={() =>
                  navigation.navigate('TripDetail', { tripId: trip.id })
                }
              >
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">
                    {storeName(grocery.stores, trip.storeId)}
                  </AppText>
                  <AppText variant="alt" color={colors.ink60}>
                    {formatDayLabel(trip.date)}
                  </AppText>
                </View>
                <AppText variant="bodyMedium">
                  {formatEur(tripTotal(trip))}
                </AppText>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  body: { paddingHorizontal: screenPadding, gap: spacing.lg },
  section: { gap: spacing.sm },
  storeRow: { gap: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink10,
    overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.blue },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
});

export default GroceryInsightsScreen;
