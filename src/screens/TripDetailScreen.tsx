import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton, SecondaryButton } from '../components/common';
import StorePickerModal from '../components/grocery/StorePickerModal';
import {
  expiryLabel,
  formatDayLabel,
  formatEur,
  storeName,
  tripTotal,
} from '../services/grocery';
import { addDays, toDateKey, todayKey, useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

const dayShift = (dateKey: string, by: number): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(addDays(new Date(y, m - 1, d), by));
};

const daysUntil = (from: string, to: string): number => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000,
  );
};

/** One past shop: what it cost, what came home, and when it goes off. */
function TripDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const tripId: string = route.params?.tripId;

  const grocery = useStore(s => s.grocery);
  const updateTrip = useStore(s => s.updateTrip);
  const removeTripItem = useStore(s => s.removeTripItem);
  const deleteTrip = useStore(s => s.deleteTrip);
  const [picking, setPicking] = useState(false);

  const trip = grocery.trips.find(t => t.id === tripId);
  if (!trip) {
    return (
      <View style={[styles.screen, styles.center]}>
        <AppText variant="body" color={colors.ink60}>
          This shop is gone.
        </AppText>
      </View>
    );
  }

  const today = todayKey();

  const confirmDelete = () =>
    Alert.alert('Delete this shop?', 'Its items and total go with it.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTrip(trip.id);
          navigation.goBack();
        },
      },
    ]);

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
          {storeName(grocery.stores, trip.storeId)}
        </AppText>
        <IconButton
          size={40}
          accessibilityLabel="Delete this shop"
          onPress={confirmDelete}
        >
          <AppText variant="body" color={colors.red}>
            🗑
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
        <Card accessible={false}>
          <AppText variant="chip" color={colors.ink60}>
            Total
          </AppText>
          <AppText variant="h5">{formatEur(tripTotal(trip))}</AppText>
          <AppText variant="alt" color={colors.ink60}>
            {trip.manualTotal != null
              ? 'Receipt total (overrides the items)'
              : `${trip.items.length} ${
                  trip.items.length === 1 ? 'item' : 'items'
                } added up`}
          </AppText>
        </Card>

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink60}>
            Shop
          </AppText>
          <Card style={styles.rowCard} onPress={() => setPicking(true)}>
            <AppText variant="bodyMedium" style={styles.flex}>
              {storeName(grocery.stores, trip.storeId)}
            </AppText>
            <AppText variant="alt" color={colors.blue}>
              Change
            </AppText>
          </Card>
          <Card style={styles.rowCard} accessible={false}>
            <AppText variant="bodyMedium" style={styles.flex}>
              {formatDayLabel(trip.date)}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous day"
              onPress={() =>
                updateTrip(trip.id, { date: dayShift(trip.date, -1) })
              }
              style={styles.stepper}
            >
              <AppText variant="bodyMedium" color={colors.ink60}>
                ‹
              </AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next day"
              onPress={() =>
                updateTrip(trip.id, { date: dayShift(trip.date, 1) })
              }
              style={styles.stepper}
            >
              <AppText variant="bodyMedium" color={colors.ink60}>
                ›
              </AppText>
            </Pressable>
          </Card>
        </View>

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink60}>
            Items
          </AppText>
          {trip.items.length === 0 && (
            <AppText variant="body" color={colors.ink60}>
              Logged as a total, with no items itemised.
            </AppText>
          )}
          {trip.items.map(item => (
            <Card key={item.id} style={styles.rowCard} accessible={false}>
              <View style={styles.flex}>
                <AppText variant="bodyMedium">{item.name}</AppText>
                <AppText variant="alt" color={colors.ink60}>
                  {[
                    `${item.qty}${item.unit}`,
                    item.note,
                    item.expiresOn &&
                      expiryLabel(daysUntil(today, item.expiresOn)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <AppText variant="bodyMedium">{formatEur(item.price)}</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
                hitSlop={8}
                onPress={() => removeTripItem(trip.id, item.id)}
              >
                <AppText variant="body" color={colors.ink40}>
                  ✕
                </AppText>
              </Pressable>
            </Card>
          ))}
        </View>

        <SecondaryButton
          label="Add more to this shop"
          onPress={() => {
            updateTrip(trip.id, { status: 'open' });
            navigation.navigate('ShopTrip', { tripId: trip.id });
          }}
        />
      </ScrollView>

      <StorePickerModal
        visible={picking}
        title="Change store"
        stores={grocery.stores}
        selectedId={trip.storeId}
        onSelect={storeId => {
          updateTrip(trip.id, { storeId });
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: { paddingHorizontal: screenPadding, gap: spacing.lg },
  section: { gap: spacing.sm },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  stepper: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TripDetailScreen;
