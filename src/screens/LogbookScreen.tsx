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
import { Card, IconButton, PrimaryButton } from '../components/common';
import { TRACKER_EMOJIS } from '../data/logbook';
import { normalizeDateKey } from '../services/grocery';
import {
  entriesFor,
  rhythmLabel,
  sinceLabel,
  trackerRows,
} from '../services/logbook';
import { todayKey, useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Logbook: "when did I last do X?" — named things done now and then (a
 * haircut, the AC filter), each with one-tap logging, backdating, and the
 * personal rhythm ("about every 45 days"). Deliberately not a habit: no
 * streaks, no daily windows, nothing to break.
 */
function LogbookScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const logbook = useStore(s => s.logbook);
  const addTracker = useStore(s => s.addTracker);
  const removeTracker = useStore(s => s.removeTracker);
  const logTrackerEntry = useStore(s => s.logTrackerEntry);
  const removeTrackerEntry = useStore(s => s.removeTrackerEntry);

  const today = todayKey();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📌');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [d, setD] = useState('');
  const [m, setM] = useState('');
  const [y, setY] = useState('');

  const rows = trackerRows(logbook, today);

  const add = () => {
    Keyboard.dismiss();
    if (!name.trim()) {
      return;
    }
    addTracker(name, emoji);
    setName('');
    setEmoji('📌');
  };

  const expand = (id: string) => {
    const [ty, tm, td] = today.split('-');
    setExpandedId(prev => (prev === id ? null : id));
    setD(td);
    setM(tm);
    setY(ty);
  };

  const logOn = (trackerId: string) => {
    Keyboard.dismiss();
    const key = normalizeDateKey(
      `${y.padStart(4, '0')}-${pad(Number(m))}-${pad(Number(d))}`,
    );
    if (!key) {
      Alert.alert('Check the date', 'That doesn’t look like a real day.');
      return;
    }
    if (key > today) {
      Alert.alert('Not yet', 'You can’t log something you haven’t done.');
      return;
    }
    logTrackerEntry(trackerId, key);
  };

  const removeOne = (id: string, label: string) =>
    Alert.alert('Delete this tracker?', `“${label}” and its history go away.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeTracker(id);
          setExpandedId(null);
        },
      },
    ]);

  const fmtDay = (key: string) => {
    const [yy, mm, dd] = key.split('-').map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
          <AppText variant="h6">Logbook</AppText>
          <AppText variant="alt" color={colors.ink60}>
            {rows.length === 0
              ? 'When did I last do that?'
              : `${rows.length} thing${rows.length === 1 ? '' : 's'} tracked`}
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
        <Card style={styles.form} accessible={false}>
          <View style={styles.addRow}>
            <TextInput
              testID="tracker-name"
              value={name}
              onChangeText={setName}
              placeholder="Track a thing, e.g. Haircut"
              placeholderTextColor={colors.ink40}
              accessibilityLabel="Thing to track"
              returnKeyType="done"
              onSubmitEditing={add}
              style={[styles.input, styles.flex]}
            />
          </View>
          <View style={styles.chipRow}>
            {TRACKER_EMOJIS.map(e => (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={`Emoji ${e}`}
                accessibilityState={{ selected: emoji === e }}
                onPress={() => {
                  Keyboard.dismiss();
                  setEmoji(e);
                }}
                style={[styles.chip, emoji === e && styles.chipOn]}
              >
                <AppText variant="body">{e}</AppText>
              </Pressable>
            ))}
          </View>
          <PrimaryButton label="Add tracker" onPress={add} />
        </Card>

        {rows.length === 0 && (
          <AppText variant="body" color={colors.ink60}>
            Track the irregular stuff — a haircut, the AC filter, an oil
            change. Log it when it happens and Slay remembers when, and
            how often you tend to.
          </AppText>
        )}

        {rows.map(row => {
          const t = row.tracker;
          const open = expandedId === t.id;
          const history = entriesFor(logbook.entries, t.id);
          return (
            <Card key={t.id} style={styles.rowCard} accessible={false}>
              <View style={styles.rowTop}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Shows the history"
                  onPress={() => expand(t.id)}
                  style={styles.rowBody}
                >
                  <View style={styles.iconChip}>
                    <AppText variant="body">{t.emoji}</AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyMedium">{t.name}</AppText>
                    <AppText variant="alt" color={colors.ink60}>
                      {sinceLabel(row.daysSince)} · {rhythmLabel(row)}
                    </AppText>
                  </View>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${t.name} today`}
                  onPress={() => logTrackerEntry(t.id, today)}
                  style={styles.logBtn}
                >
                  <AppText variant="alt" color={colors.white}>
                    Log today
                  </AppText>
                </Pressable>
              </View>

              {open && (
                <View style={styles.detail}>
                  <View style={styles.backdateRow}>
                    <TextInput
                      testID={`log-day-${t.id}`}
                      value={d}
                      onChangeText={v => setD(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={2}
                      accessibilityLabel="Day"
                      style={[styles.input, styles.dateInput]}
                    />
                    <TextInput
                      testID={`log-month-${t.id}`}
                      value={m}
                      onChangeText={v => setM(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={2}
                      accessibilityLabel="Month"
                      style={[styles.input, styles.dateInput]}
                    />
                    <TextInput
                      testID={`log-year-${t.id}`}
                      value={y}
                      onChangeText={v => setY(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={4}
                      accessibilityLabel="Year"
                      style={[styles.input, styles.yearInput]}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Log ${t.name} on that date`}
                      onPress={() => logOn(t.id)}
                      style={styles.chip}
                    >
                      <AppText variant="alt" color={colors.ink60}>
                        Log date
                      </AppText>
                    </Pressable>
                  </View>
                  {history.map(e => (
                    <View key={e.id} style={styles.entryRow}>
                      <AppText
                        variant="body"
                        color={colors.ink60}
                        style={styles.flex}
                      >
                        {fmtDay(e.date)}
                      </AppText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete entry ${fmtDay(e.date)}`}
                        onPress={() => removeTrackerEntry(e.id)}
                        hitSlop={8}
                      >
                        <AppText variant="body" color={colors.ink40}>
                          ✕
                        </AppText>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete tracker ${t.name}`}
                    onPress={() => removeOne(t.id, t.name)}
                    style={styles.chip}
                  >
                    <AppText variant="alt" color={colors.red}>
                      Delete tracker
                    </AppText>
                  </Pressable>
                </View>
              )}
            </Card>
          );
        })}
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
  form: { gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  chipOn: { backgroundColor: colors.blue10, borderColor: colors.blue },
  rowCard: { gap: spacing.md, padding: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logBtn: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: { gap: spacing.sm },
  backdateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateInput: { width: 56, height: 36, paddingVertical: 0 },
  yearInput: { width: 72, height: 36, paddingVertical: 0 },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LogbookScreen;
