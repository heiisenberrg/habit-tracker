import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import SpendBars from '../components/grocery/SpendBars';
import {
  CATEGORIES,
  Expense,
  ExpenseCategory,
  RecurringExpense,
  categoryMeta,
} from '../data/expenses';
import {
  copyFromPreviousMonth,
  expenseMonthOverMonth,
  expenseMonthlySeries,
  expensesInMonth,
  monthTotal,
} from '../services/expenses';
import {
  deltaSentence,
  formatEur,
  monthKeyOf,
  monthLabel,
  monthSpend,
  monthTripCount,
  shiftMonthKey,
} from '../services/grocery';
import { requestNotificationPermission } from '../services/notifications';
import { cancelRecurringReminder } from '../services/recurringExpenses';
import { todayKey, useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

type Draft = {
  id: string | null;
  /** Set when editing a repeating rule rather than a ledger entry. */
  recurringId: string | null;
  category: ExpenseCategory;
  amount: string;
  note: string;
  repeats: boolean;
  /** Due day of the month, as typed. */
  repeatDay: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  recurringId: null,
  category: 'rent',
  amount: '',
  note: '',
  repeats: false,
  repeatDay: String(new Date().getDate()),
});

const draftFrom = (e: Expense): Draft => ({
  id: e.id,
  recurringId: null,
  category: e.category,
  amount: String(e.amount),
  note: e.note ?? '',
  repeats: false,
  repeatDay: '',
});

const draftFromRule = (r: RecurringExpense): Draft => ({
  id: null,
  recurringId: r.id,
  category: r.category,
  amount: String(r.amount),
  note: r.note ?? '',
  repeats: true,
  repeatDay: String(r.day),
});

function Chip({
  label,
  on,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: on }}
      // The decimal pad has no Done key: picking a chip is how the keyboard
      // goes away and the rest of the form comes back into view.
      onPress={() => {
        Keyboard.dismiss();
        onPress();
      }}
      style={[styles.chip, on && styles.chipOn]}
    >
      <AppText variant="alt" color={on ? colors.white : colors.ink60}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * Expense tracker: one month at a time — the Grocery tab's spend joins
 * automatically, every other bill (rent, electricity, wifi…) is added by
 * hand or copied over from the previous month.
 */
function ExpensesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const grocery = useStore(s => s.grocery);
  const expenses = useStore(s => s.expenses);
  const addExpense = useStore(s => s.addExpense);
  const updateExpense = useStore(s => s.updateExpense);
  const removeExpense = useStore(s => s.removeExpense);
  const copyLastMonthExpenses = useStore(s => s.copyLastMonthExpenses);
  const recurring = useStore(s => s.recurring);
  const addRecurring = useStore(s => s.addRecurring);
  const updateRecurring = useStore(s => s.updateRecurring);
  const removeRecurring = useStore(s => s.removeRecurring);

  const thisMonth = monthKeyOf(todayKey());
  const [monthKey, setMonthKey] = useState(thisMonth);
  const [draft, setDraft] = useState<Draft | null>(null);

  const rows = useMemo(
    () => expensesInMonth(expenses, monthKey),
    [expenses, monthKey],
  );
  const groceriesSpend = monthSpend(grocery.trips, monthKey);
  const shops = monthTripCount(grocery.trips, monthKey);
  const total = monthTotal(expenses, grocery.trips, monthKey);
  const delta = expenseMonthOverMonth(expenses, grocery.trips, monthKey);
  const copyable = copyFromPreviousMonth(expenses, monthKey);
  const series = useMemo(
    () => expenseMonthlySeries(expenses, grocery.trips, monthKey, 6),
    [expenses, grocery.trips, monthKey],
  );

  const save = async () => {
    if (!draft) {
      return;
    }
    Keyboard.dismiss();
    const amount = Number(draft.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Enter the amount', 'How much was it, in euros?');
      return;
    }
    const note = draft.note.trim() || undefined;
    if (draft.recurringId || draft.repeats) {
      const day = Number(draft.repeatDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        Alert.alert('Which day?', 'Pick a day of the month, 1–31.');
        return;
      }
      if (draft.recurringId) {
        updateRecurring(draft.recurringId, {
          category: draft.category,
          amount,
          note,
          day,
        });
      } else {
        // Creating a rule is the user-initiated path that may raise the OS
        // permission dialog; App.tsx materializes + arms triggers silently.
        const granted = await requestNotificationPermission();
        addRecurring({ category: draft.category, amount, note, day });
        if (!granted) {
          Alert.alert(
            'Notifications are off',
            'The bill will land in your expenses each month, but Slay ' +
              'can’t remind you until notifications are allowed in iOS ' +
              'Settings.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings().catch(() => {}),
              },
            ],
          );
        }
      }
    } else if (draft.id) {
      updateExpense(draft.id, { category: draft.category, amount, note });
    } else {
      addExpense({ monthKey, category: draft.category, amount, note });
    }
    setDraft(null);
  };

  const removeRule = (id: string, label: string) =>
    Alert.alert(
      'Delete this repeating bill?',
      `“${label}” stops repeating; months already added stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeRecurring(id);
            cancelRecurringReminder(id);
            setDraft(null);
          },
        },
      ],
    );

  const remove = (id: string, label: string) =>
    Alert.alert('Delete this expense?', `“${label}” will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeExpense(id);
          setDraft(null);
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.flex}>
          <AppText variant="title">Expenses</AppText>
          <AppText variant="body" color={colors.ink60}>
            {formatEur(total)} in {monthLabel(monthKey).split(' ')[0]}
          </AppText>
        </View>
        <IconButton
          size={32}
          accessibilityLabel="Debts"
          onPress={() => navigation.navigate('Debts')}
        >
          <AppText variant="body">🤝</AppText>
        </IconButton>
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
          { paddingBottom: 140 + insets.bottom },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.totalCard}>
          <AppText variant="chip" color={colors.ink60}>
            {monthLabel(monthKey)}
          </AppText>
          <AppText variant="h5">{formatEur(total)}</AppText>
          <AppText variant="alt" color={colors.ink60}>
            {deltaSentence(
              { deltaAbs: delta.deltaAbs, previous: delta.previous },
              monthKey,
            )}
          </AppText>
        </Card>

        <Card accessible={false}>
          <SpendBars
            series={series}
            selected={monthKey}
            onSelect={setMonthKey}
            emptyLabel="nothing logged"
          />
        </Card>

        {!draft && (
          <PrimaryButton
            label="Add an expense"
            onPress={() => setDraft(emptyDraft())}
          />
        )}

        {!draft && copyable.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy last month's bills, ${copyable.length}`}
            onPress={() => copyLastMonthExpenses(monthKey)}
            style={styles.copyBtn}
          >
            <AppText variant="bodyMedium" color={colors.blue}>
              ⟳ Copy last month’s bills ({copyable.length})
            </AppText>
          </Pressable>
        )}

        {draft && (
          <Card style={styles.form} accessible={false}>
            <AppText variant="chip" color={colors.ink60}>
              {draft.recurringId
                ? 'Edit repeating bill'
                : draft.id
                ? 'Edit expense'
                : 'New expense'}
            </AppText>
            <View style={styles.chipRow}>
              {CATEGORIES.map(c => (
                <Chip
                  key={c.category}
                  label={`${c.emoji} ${c.label}`}
                  accessibilityLabel={c.label}
                  on={draft.category === c.category}
                  onPress={() => setDraft({ ...draft, category: c.category })}
                />
              ))}
            </View>
            <View style={styles.dateRow}>
              <TextInput
                testID="expense-amount"
                value={draft.amount}
                onChangeText={amount =>
                  setDraft({
                    ...draft,
                    amount: amount.replace(/[^0-9.,]/g, ''),
                  })
                }
                placeholder="€ Amount"
                placeholderTextColor={colors.ink40}
                keyboardType="decimal-pad"
                accessibilityLabel="Amount in euros"
                style={[styles.input, styles.amountInput]}
              />
              <TextInput
                testID="expense-note"
                value={draft.note}
                onChangeText={note => setDraft({ ...draft, note })}
                placeholder="Note (optional)"
                placeholderTextColor={colors.ink40}
                accessibilityLabel="Note"
                returnKeyType="done"
                style={[styles.input, styles.flex]}
              />
            </View>
            {draft.id === null && (
              <>
                <AppText variant="chip" color={colors.ink60}>
                  Repeats
                </AppText>
                <View style={styles.chipRow}>
                  {!draft.recurringId && (
                    <Chip
                      label="One-off"
                      on={!draft.repeats}
                      onPress={() => setDraft({ ...draft, repeats: false })}
                    />
                  )}
                  <Chip
                    label="Every month"
                    on={draft.repeats}
                    onPress={() => setDraft({ ...draft, repeats: true })}
                  />
                  {draft.repeats && (
                    <TextInput
                      testID="recurring-day"
                      value={draft.repeatDay}
                      onChangeText={repeatDay =>
                        setDraft({
                          ...draft,
                          repeatDay: repeatDay.replace(/[^0-9]/g, ''),
                        })
                      }
                      placeholder="Day"
                      placeholderTextColor={colors.ink40}
                      keyboardType="number-pad"
                      maxLength={2}
                      accessibilityLabel="Due day of the month"
                      style={[styles.input, styles.dayInput]}
                    />
                  )}
                </View>
                {draft.repeats && (
                  <AppText variant="alt" color={colors.ink60}>
                    Lands in your expenses and pings you on that day, every
                    month.
                  </AppText>
                )}
              </>
            )}
            <View style={styles.actions}>
              {(draft.id || draft.recurringId) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete this expense"
                  onPress={() =>
                    draft.recurringId
                      ? removeRule(
                          draft.recurringId,
                          categoryMeta(draft.category).label,
                        )
                      : remove(
                          draft.id as string,
                          categoryMeta(draft.category).label,
                        )
                  }
                  style={styles.chip}
                >
                  <AppText variant="alt" color={colors.red}>
                    Delete
                  </AppText>
                </Pressable>
              )}
              <View style={styles.flex} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={() => setDraft(null)}
                style={styles.chip}
              >
                <AppText variant="alt" color={colors.ink60}>
                  Cancel
                </AppText>
              </Pressable>
            </View>
            <PrimaryButton label="Save expense" onPress={save} />
          </Card>
        )}

        <Card
          style={styles.rowCard}
          onPress={() => navigation.navigate('GroceryInsights')}
        >
          <View style={styles.iconChip}>
            <AppText variant="body">🧺</AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyMedium">Groceries</AppText>
            <AppText variant="alt" color={colors.ink60}>
              {shops === 0
                ? 'No shops this month — from the Grocery tab'
                : `${shops} shop${shops === 1 ? '' : 's'} · from the Grocery tab`}
            </AppText>
          </View>
          <AppText variant="bodyMedium">{formatEur(groceriesSpend)}</AppText>
          <AppText variant="body" color={colors.ink40}>
            ›
          </AppText>
        </Card>

        {rows.map(e => {
          const meta = categoryMeta(e.category);
          return (
            <Card
              key={e.id}
              style={styles.rowCard}
              onPress={() => setDraft(draftFrom(e))}
            >
              <View style={styles.iconChip}>
                <AppText variant="body">{meta.emoji}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyMedium">{meta.label}</AppText>
                {e.note ? (
                  <AppText variant="alt" color={colors.ink60}>
                    {e.note}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="bodyMedium">{formatEur(e.amount)}</AppText>
            </Card>
          );
        })}

        {recurring.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Repeating bills" />
            {recurring.map(r => {
              const meta = categoryMeta(r.category);
              return (
                <Card key={r.id} style={styles.rowCard} accessible={false}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Opens the editor"
                    onPress={() => setDraft(draftFromRule(r))}
                    style={styles.rowBody}
                  >
                    <View style={styles.iconChip}>
                      <AppText variant="body">{meta.emoji}</AppText>
                    </View>
                    <View style={styles.flex}>
                      <AppText variant="bodyMedium">{meta.label}</AppText>
                      <AppText variant="alt" color={colors.ink60}>
                        {formatEur(r.amount)} · monthly on day {r.day}
                        {r.note ? ` · ${r.note}` : ''}
                      </AppText>
                    </View>
                  </Pressable>
                  <Switch
                    testID={`switch-recurring-${r.id}`}
                    accessibilityLabel={`Repeat ${meta.label} monthly`}
                    value={r.enabled}
                    onValueChange={v => updateRecurring(r.id, { enabled: v })}
                    trackColor={{ true: colors.green, false: colors.ink10 }}
                  />
                </Card>
              );
            })}
          </View>
        )}

        {rows.length === 0 && !draft && (
          <AppText variant="body" color={colors.ink60}>
            No bills logged for {monthLabel(monthKey).split(' ')[0]} yet. Add
            rent, electricity, wifi and the rest — groceries come across from
            the Grocery tab by themselves.
          </AppText>
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
  body: { paddingHorizontal: screenPadding, gap: spacing.md },
  totalCard: { gap: spacing.xs },
  form: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.ink,
  },
  amountInput: { width: 120 },
  dayInput: { width: 72, height: 34, paddingVertical: 0 },
  section: { gap: spacing.sm },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copyBtn: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.blue40,
    backgroundColor: colors.blue10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ExpensesScreen;
