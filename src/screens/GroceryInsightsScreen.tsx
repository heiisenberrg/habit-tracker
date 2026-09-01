import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton, SegmentControl } from '../components/common';
import MonthSummary from '../components/grocery/MonthSummary';
import SpendBars from '../components/grocery/SpendBars';
import StoreBars from '../components/grocery/StoreBars';
import {
  formatDayLabel,
  formatEur,
  monthKeyOf,
  monthLabel,
  monthlySeries,
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

  /** 0 = the selected month, 1 = every shop ever logged. */
  const [storeScope, setStoreScope] = useState(0);

  const series = monthlySeries(grocery.trips, monthKey, 6);
  const rows = storeBreakdown(
    grocery.trips,
    grocery.stores,
    storeScope === 0 ? monthKey : null,
  );
  const items = topItems(grocery.trips, monthKey, 5);
  const trips = tripsInMonth(grocery.trips, monthKey);
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
            Spend by month
          </AppText>
          <Card accessible={false}>
            <SpendBars
              series={series}
              selected={monthKey}
              onSelect={setMonthKey}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink60}>
            Spend by shop
          </AppText>
          <SegmentControl
            tabs={[monthLabel(monthKey).split(' ')[0], 'All time']}
            active={storeScope}
            onChange={setStoreScope}
          />
          <StoreBars
            rows={rows}
            emptyLabel={
              storeScope === 0
                ? `No shops logged in ${monthLabel(monthKey)}.`
                : 'No shops logged yet.'
            }
          />
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
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
});

export default GroceryInsightsScreen;
