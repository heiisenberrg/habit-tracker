import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import {
  Card,
  IconButton,
  PrimaryButton,
  SectionHeader,
} from '../components/common';
import MonthSummary from '../components/grocery/MonthSummary';
import StorePickerModal from '../components/grocery/StorePickerModal';
import {
  expiringSoonNamed,
  expiryLabel,
  formatDayLabel,
  formatEur,
  monthKeyOf,
  storeName,
  tripTotal,
} from '../services/grocery';
import { todayKey, useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

/**
 * Grocery hub: what you still need to buy, what this month cost, what is
 * about to go off, and the way into a shop.
 */
function GroceryScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const grocery = useStore(s => s.grocery);
  const addListItem = useStore(s => s.addListItem);
  const toggleListItem = useStore(s => s.toggleListItem);
  const removeListItem = useStore(s => s.removeListItem);
  const clearBoughtFromList = useStore(s => s.clearBoughtFromList);
  const startTrip = useStore(s => s.startTrip);

  const [draft, setDraft] = useState('');
  const [picking, setPicking] = useState(false);

  const today = todayKey();
  const monthKey = monthKeyOf(today);
  const openTrip = grocery.trips.find(t => t.status === 'open');
  const toBuy = grocery.list.filter(i => !i.done);
  const bought = grocery.list.filter(i => i.done);
  const expiring = expiringSoonNamed(grocery, today, 5).slice(0, 3);
  const recent = grocery.trips.slice(0, 3);

  const add = () => {
    if (!draft.trim()) {
      return;
    }
    addListItem({ name: draft });
    setDraft('');
  };

  const beginShop = (storeId: string) => {
    setPicking(false);
    const id = startTrip(storeId);
    navigation.navigate('ShopTrip', { tripId: id });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.flex}>
          <AppText variant="title">Grocery</AppText>
          <AppText variant="body" color={colors.ink60}>
            {toBuy.length === 0
              ? 'Nothing on the list'
              : `${toBuy.length} to buy`}
          </AppText>
        </View>
        <IconButton
          size={40}
          accessibilityLabel="Manage stores"
          onPress={() => navigation.navigate('Stores')}
        >
          <AppText variant="body">🏪</AppText>
        </IconButton>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: 140 + insets.bottom },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <MonthSummary
          trips={grocery.trips}
          monthKey={monthKey}
          onPress={() => navigation.navigate('GroceryInsights')}
        />

        {openTrip ? (
          <PrimaryButton
            label={`Continue at ${storeName(grocery.stores, openTrip.storeId)}`}
            onPress={() =>
              navigation.navigate('ShopTrip', { tripId: openTrip.id })
            }
          />
        ) : (
          <PrimaryButton
            label="Start a shop"
            onPress={() => setPicking(true)}
          />
        )}

        {expiring.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Expiring soon" />
            {expiring.map(e => (
              <Card key={e.item.id} style={styles.rowCard}>
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">{e.item.name}</AppText>
                  <AppText variant="alt" color={colors.ink60}>
                    {expiryLabel(e.daysLeft)} · {e.storeName}
                  </AppText>
                </View>
                {e.daysLeft < 0 && (
                  <AppText variant="chip" color={colors.red}>
                    Past
                  </AppText>
                )}
              </Card>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="Shopping list" />
          <View style={styles.addRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add something to buy"
              placeholderTextColor={colors.ink40}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={add}
              accessibilityLabel="Add something to buy"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add to list"
              onPress={add}
              style={({ pressed }) => [
                styles.addBtn,
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="bodyMedium" color={colors.white}>
                Add
              </AppText>
            </Pressable>
          </View>

          {grocery.list.length === 0 && (
            <AppText variant="body" color={colors.ink60}>
              Write what you need before you leave — in the shop you tick each
              line and type what it cost.
            </AppText>
          )}

          {[...toBuy, ...bought].map(line => (
            <Card key={line.id} style={styles.rowCard} accessible={false}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: line.done }}
                accessibilityLabel={line.name}
                testID={`list-item-${line.id}`}
                onPress={() => toggleListItem(line.id)}
                style={styles.checkRow}
              >
                <View style={[styles.check, line.done && styles.checkOn]}>
                  {line.done && (
                    <AppText variant="alt" color={colors.white}>
                      ✓
                    </AppText>
                  )}
                </View>
                <View style={styles.flex}>
                  <AppText
                    variant="bodyMedium"
                    color={line.done ? colors.ink40 : colors.ink}
                    style={line.done && styles.struck}
                  >
                    {line.name}
                  </AppText>
                  {(line.note || line.qty) && (
                    <AppText variant="alt" color={colors.ink60}>
                      {[line.qty && `${line.qty}${line.unit ?? ''}`, line.note]
                        .filter(Boolean)
                        .join(' · ')}
                    </AppText>
                  )}
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${line.name}`}
                hitSlop={8}
                onPress={() => removeListItem(line.id)}
              >
                <AppText variant="body" color={colors.ink40}>
                  ✕
                </AppText>
              </Pressable>
            </Card>
          ))}

          {bought.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear bought items"
              onPress={clearBoughtFromList}
              hitSlop={8}
            >
              <AppText variant="bodyMedium" color={colors.blue}>
                Clear {bought.length} bought
              </AppText>
            </Pressable>
          )}
        </View>

        {recent.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="Recent shops"
              onViewAll={() => navigation.navigate('GroceryInsights')}
            />
            {recent.map(t => (
              <Card
                key={t.id}
                style={styles.rowCard}
                onPress={() =>
                  navigation.navigate('TripDetail', { tripId: t.id })
                }
              >
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">
                    {storeName(grocery.stores, t.storeId)}
                  </AppText>
                  <AppText variant="alt" color={colors.ink60}>
                    {formatDayLabel(t.date)} ·{' '}
                    {t.items.length === 0
                      ? 'no items'
                      : `${t.items.length} ${
                          t.items.length === 1 ? 'item' : 'items'
                        }`}
                    {t.status === 'open' ? ' · open' : ''}
                  </AppText>
                </View>
                <AppText variant="bodyMedium">
                  {formatEur(tripTotal(t))}
                </AppText>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <StorePickerModal
        visible={picking}
        title="Where are you shopping?"
        stores={grocery.stores}
        onSelect={beginShop}
        onClose={() => setPicking(false)}
        onManage={() => {
          setPicking(false);
          navigation.navigate('Stores');
        }}
      />
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
    gap: spacing.md,
  },
  body: { paddingHorizontal: screenPadding, gap: spacing.lg },
  section: { gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.ink,
  },
  addBtn: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  checkRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 32,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  struck: { textDecorationLine: 'line-through' },
  pressed: { opacity: 0.75 },
});

export default GroceryScreen;
