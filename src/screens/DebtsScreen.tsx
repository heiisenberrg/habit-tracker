import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
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
import { Debt, DebtDirection } from '../data/expenses';
import { debtSentence, debtTotals } from '../services/expenses';
import { formatEur } from '../services/grocery';
import { useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

type Draft = {
  id: string | null;
  person: string;
  direction: DebtDirection;
  amount: string;
  note: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  person: '',
  direction: 'owedToMe',
  amount: '',
  note: '',
});

const draftFrom = (d: Debt): Draft => ({
  id: d.id,
  person: d.person,
  direction: d.direction,
  amount: String(d.amount),
  note: d.note ?? '',
});

const DIRECTIONS: { value: DebtDirection; label: string }[] = [
  { value: 'owedToMe', label: 'Owes me' },
  { value: 'iOwe', label: 'I owe' },
];

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
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
 * Debts: money in flight both ways — "Marco owes me €50", "I owe the
 * landlord €200". Open until settled; settled ones keep the history below.
 * Deliberately outside the month totals: a debt isn't an expense until it
 * is actually paid.
 */
function DebtsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const debts = useStore(s => s.debts);
  const addDebt = useStore(s => s.addDebt);
  const updateDebt = useStore(s => s.updateDebt);
  const removeDebt = useStore(s => s.removeDebt);

  const [draft, setDraft] = useState<Draft | null>(null);

  const open = debts.filter(d => !d.settled);
  const settled = debts.filter(d => d.settled);
  const totals = debtTotals(debts);

  const save = () => {
    if (!draft) {
      return;
    }
    Keyboard.dismiss();
    const person = draft.person.trim();
    if (!person) {
      Alert.alert('Who is it?', 'e.g. Marco, or Landlord');
      return;
    }
    const amount = Number(draft.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Enter the amount', 'How much, in euros?');
      return;
    }
    const note = draft.note.trim() || undefined;
    if (draft.id) {
      updateDebt(draft.id, {
        person,
        direction: draft.direction,
        amount,
        note,
      });
    } else {
      addDebt({ person, direction: draft.direction, amount, note });
    }
    setDraft(null);
  };

  const remove = (id: string, person: string) =>
    Alert.alert('Delete this debt?', `“${person}” will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeDebt(id);
          setDraft(null);
        },
      },
    ]);

  const renderRow = (d: Debt) => {
    const owed = d.direction === 'owedToMe';
    return (
      <Card key={d.id} style={styles.rowCard} accessible={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens the editor"
          onPress={() => setDraft(draftFrom(d))}
          style={styles.rowBody}
        >
          <View style={styles.iconChip}>
            <AppText variant="body">{owed ? '📥' : '📤'}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText
              variant="bodyMedium"
              color={d.settled ? colors.ink60 : colors.ink}
            >
              {d.person}
            </AppText>
            <AppText variant="alt" color={colors.ink60}>
              {owed ? 'owes you' : 'you owe'}
              {d.note ? ` · ${d.note}` : ''}
              {d.settled ? ' · settled' : ''}
            </AppText>
          </View>
          <AppText
            variant="bodyMedium"
            color={d.settled ? colors.ink60 : owed ? colors.green : colors.red}
          >
            {formatEur(d.amount)}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${d.settled ? 'Reopen' : 'Settle'} ${d.person}`}
          onPress={() => updateDebt(d.id, { settled: !d.settled })}
          style={styles.chip}
        >
          <AppText variant="alt" color={colors.ink60}>
            {d.settled ? 'Reopen' : 'Settle'}
          </AppText>
        </Pressable>
      </Card>
    );
  };

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
        <View style={styles.flex}>
          <AppText variant="h6">Debts</AppText>
          <AppText variant="alt" color={colors.ink60}>
            {debtSentence(totals)}
          </AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!draft && (
          <PrimaryButton label="Add a debt" onPress={() => setDraft(emptyDraft())} />
        )}

        {draft && (
          <Card style={styles.form} accessible={false}>
            <AppText variant="chip" color={colors.ink60}>
              {draft.id ? 'Edit debt' : 'New debt'}
            </AppText>
            <TextInput
              testID="debt-person"
              value={draft.person}
              onChangeText={person => setDraft({ ...draft, person })}
              placeholder="Who? e.g. Marco"
              placeholderTextColor={colors.ink40}
              accessibilityLabel="Person"
              returnKeyType="done"
              style={styles.input}
            />
            <View style={styles.chipRow}>
              {DIRECTIONS.map(o => (
                <Chip
                  key={o.value}
                  label={o.label}
                  on={draft.direction === o.value}
                  onPress={() => setDraft({ ...draft, direction: o.value })}
                />
              ))}
            </View>
            <View style={styles.inputRow}>
              <TextInput
                testID="debt-amount"
                value={draft.amount}
                onChangeText={amount =>
                  setDraft({ ...draft, amount: amount.replace(/[^0-9.,]/g, '') })
                }
                placeholder="€ Amount"
                placeholderTextColor={colors.ink40}
                keyboardType="decimal-pad"
                accessibilityLabel="Amount in euros"
                style={[styles.input, styles.amountInput]}
              />
              <TextInput
                testID="debt-note"
                value={draft.note}
                onChangeText={note => setDraft({ ...draft, note })}
                placeholder="Note (optional)"
                placeholderTextColor={colors.ink40}
                accessibilityLabel="Note"
                returnKeyType="done"
                style={[styles.input, styles.flex]}
              />
            </View>
            <View style={styles.actions}>
              {draft.id && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete this debt"
                  onPress={() => remove(draft.id as string, draft.person)}
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
            <PrimaryButton label="Save debt" onPress={save} />
          </Card>
        )}

        {debts.length === 0 && !draft && (
          <AppText variant="body" color={colors.ink60}>
            Nothing here yet. Add what a friend owes you — or what you owe —
            and settle it when the money moves. Debts stay out of the monthly
            totals until then.
          </AppText>
        )}

        {open.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Open" />
            {open.map(renderRow)}
          </View>
        )}

        {settled.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Settled" />
            {settled.map(renderRow)}
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
    gap: spacing.md,
  },
  body: { paddingHorizontal: screenPadding, gap: spacing.md },
  section: { gap: spacing.sm },
  form: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
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
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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

export default DebtsScreen;
