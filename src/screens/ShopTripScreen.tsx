import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton, PrimaryButton } from '../components/common';
import StorePickerModal from '../components/grocery/StorePickerModal';
import { UNITS, Unit } from '../data/grocery';
import {
  formatDayLabel,
  formatEur,
  storeName,
  tripTotal,
} from '../services/grocery';
import { addDays, toDateKey, useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

type Draft = {
  /** Set when the draft came from a to-buy line; blank for a loose item. */
  listItemId?: string;
  name: string;
  qty: string;
  unit: Unit;
  price: string;
  expiresOn: string;
};

const emptyDraft = (): Draft => ({
  name: '',
  qty: '1',
  unit: 'pc',
  price: '',
  expiresOn: '',
});

/** "1,15" and "1.15" both mean the same thing at a checkout. */
const parseMoney = (raw: string): number => {
  const n = Number(raw.replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** The live shop: tick the list, type prices, watch the total climb. */
function ShopTripScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const tripId: string = route.params?.tripId;

  const grocery = useStore(s => s.grocery);
  const buyListItem = useStore(s => s.buyListItem);
  const addTripItem = useStore(s => s.addTripItem);
  const removeTripItem = useStore(s => s.removeTripItem);
  const updateTrip = useStore(s => s.updateTrip);
  const closeTrip = useStore(s => s.closeTrip);
  const deleteTrip = useStore(s => s.deleteTrip);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [lump, setLump] = useState('');
  const [showLump, setShowLump] = useState(false);

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

  const toBuy = grocery.list.filter(i => !i.done);
  const total = tripTotal(trip);

  const commitDraft = () => {
    if (!draft || !draft.name.trim()) {
      return;
    }
    const input = {
      qty: Number(draft.qty.replace(',', '.')) || 1,
      unit: draft.unit,
      price: parseMoney(draft.price),
      expiresOn: draft.expiresOn.trim() || undefined,
    };
    if (draft.listItemId) {
      buyListItem(trip.id, draft.listItemId, input);
    } else {
      addTripItem(trip.id, { name: draft.name.trim(), ...input });
    }
    setDraft(null);
  };

  const finish = () => {
    closeTrip(trip.id);
    navigation.goBack();
  };

  const cancel = () => {
    // An empty shop started by mistake should not become a data point.
    if (trip.items.length === 0 && trip.manualTotal == null) {
      deleteTrip(trip.id);
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton size={40} accessibilityLabel="Back" onPress={cancel}>
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Store: ${storeName(
            grocery.stores,
            trip.storeId,
          )}. Change store`}
          onPress={() => setPicking(true)}
          style={styles.flex}
        >
          <AppText variant="h6">
            {storeName(grocery.stores, trip.storeId)} ⌄
          </AppText>
          <AppText variant="alt" color={colors.ink60}>
            {formatDayLabel(trip.date)}
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {draft && (
          <Card style={styles.draft} accessible={false}>
            <TextInput
              value={draft.name}
              onChangeText={name => setDraft({ ...draft, name })}
              placeholder="What is it?"
              placeholderTextColor={colors.ink40}
              editable={!draft.listItemId}
              style={styles.input}
              accessibilityLabel="Item name"
            />
            <View style={styles.row}>
              <TextInput
                value={draft.qty}
                onChangeText={qty => setDraft({ ...draft, qty })}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.ink40}
                style={[styles.input, styles.qty]}
                accessibilityLabel="Quantity"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.row}>
                  {UNITS.map(u => (
                    <Pressable
                      key={u}
                      accessibilityRole="button"
                      accessibilityLabel={`Unit ${u}`}
                      accessibilityState={{ selected: draft.unit === u }}
                      onPress={() => setDraft({ ...draft, unit: u })}
                      style={[styles.chip, draft.unit === u && styles.chipOn]}
                    >
                      <AppText
                        variant="alt"
                        color={draft.unit === u ? colors.white : colors.ink60}
                      >
                        {u}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={styles.row}>
              <TextInput
                value={draft.price}
                onChangeText={price => setDraft({ ...draft, price })}
                keyboardType="decimal-pad"
                placeholder="€ price"
                placeholderTextColor={colors.ink40}
                style={[styles.input, styles.flex]}
                accessibilityLabel="Price in euros"
                testID="draft-price"
              />
              <TextInput
                value={draft.expiresOn}
                onChangeText={expiresOn => setDraft({ ...draft, expiresOn })}
                placeholder="Expires (optional)"
                placeholderTextColor={colors.ink40}
                style={[styles.input, styles.flex]}
                accessibilityLabel="Expiry date, YYYY-MM-DD"
              />
            </View>
            <View style={styles.row}>
              {[3, 7, 30].map(d => (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={`Expires in ${d} days`}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      expiresOn: toDateKey(addDays(new Date(), d)),
                    })
                  }
                  style={styles.chip}
                >
                  <AppText variant="alt" color={colors.ink60}>
                    +{d}d
                  </AppText>
                </Pressable>
              ))}
              <View style={styles.flex} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Discard this item"
                onPress={() => setDraft(null)}
                style={styles.chip}
              >
                <AppText variant="alt" color={colors.ink60}>
                  Cancel
                </AppText>
              </Pressable>
            </View>
            <PrimaryButton label="Add to basket" onPress={commitDraft} />
          </Card>
        )}

        {toBuy.length > 0 && (
          <View style={styles.section}>
            <AppText variant="chip" color={colors.ink60}>
              On your list
            </AppText>
            {toBuy.map(line => (
              <Card
                key={line.id}
                style={styles.rowCard}
                onPress={() =>
                  setDraft({
                    ...emptyDraft(),
                    listItemId: line.id,
                    name: line.name,
                    qty: line.qty ? String(line.qty) : '1',
                    unit: line.unit ?? 'pc',
                  })
                }
              >
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">{line.name}</AppText>
                  {line.note && (
                    <AppText variant="alt" color={colors.ink60}>
                      {line.note}
                    </AppText>
                  )}
                </View>
                <AppText variant="alt" color={colors.blue}>
                  Add price
                </AppText>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink60}>
            In the basket
          </AppText>
          {trip.items.length === 0 && (
            <AppText variant="body" color={colors.ink60}>
              Nothing yet. Tap a line above, or add something you picked up on
              the way.
            </AppText>
          )}
          {trip.items.map(item => (
            <Card key={item.id} style={styles.rowCard} accessible={false}>
              <View style={styles.flex}>
                <AppText variant="bodyMedium">{item.name}</AppText>
                <AppText variant="alt" color={colors.ink60}>
                  {item.qty}
                  {item.unit}
                  {item.expiresOn ? ` · expires ${item.expiresOn}` : ''}
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
          {!draft && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add an item not on the list"
              onPress={() => setDraft(emptyDraft())}
              style={({ pressed }) => [
                styles.addLoose,
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="bodyMedium" color={colors.blue}>
                + Something not on the list
              </AppText>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          {showLump ? (
            <Card style={styles.draft} accessible={false}>
              <AppText variant="bodyMedium">Log the receipt total</AppText>
              <AppText variant="alt" color={colors.ink60}>
                Overrides the item sum. Clear it to go back to adding up items.
              </AppText>
              <TextInput
                value={lump}
                onChangeText={setLump}
                keyboardType="decimal-pad"
                placeholder="€ total"
                placeholderTextColor={colors.ink40}
                style={styles.input}
                accessibilityLabel="Receipt total in euros"
                testID="lump-total"
              />
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save receipt total"
                  onPress={() => {
                    updateTrip(trip.id, { manualTotal: parseMoney(lump) });
                    setShowLump(false);
                  }}
                  style={styles.chip}
                >
                  <AppText variant="alt" color={colors.blue}>
                    Save
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear receipt total"
                  onPress={() => {
                    updateTrip(trip.id, { manualTotal: null });
                    setLump('');
                    setShowLump(false);
                  }}
                  style={styles.chip}
                >
                  <AppText variant="alt" color={colors.ink60}>
                    Clear
                  </AppText>
                </Pressable>
              </View>
            </Card>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Log a receipt total instead"
              onPress={() => {
                setLump(
                  trip.manualTotal != null ? String(trip.manualTotal) : '',
                );
                setShowLump(true);
              }}
              hitSlop={8}
            >
              <AppText variant="alt" color={colors.ink60}>
                {trip.manualTotal != null
                  ? `Receipt total set to ${formatEur(trip.manualTotal)} · edit`
                  : 'Or just log the receipt total'}
              </AppText>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <View style={styles.flex}>
          <AppText variant="chip" color={colors.ink60}>
            Running total
          </AppText>
          <AppText variant="h6" testID="trip-total">
            {formatEur(total)}
          </AppText>
        </View>
        <PrimaryButton
          label="Finish shopping"
          onPress={finish}
          style={styles.finish}
        />
      </View>

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
    </KeyboardAvoidingView>
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
  body: {
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: { gap: spacing.sm },
  draft: { gap: spacing.sm, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qty: { width: 72 },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.ink,
  },
  chip: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  addLoose: { paddingVertical: spacing.md },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  finish: { flex: 1.2 },
  pressed: { opacity: 0.75 },
});

export default ShopTripScreen;
