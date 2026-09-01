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
import {
  DEFAULT_REMIND_TIME,
  DateKind,
  DateRepeat,
  KINDS,
  MONTHS,
  MONTHS_SHORT,
  REMIND_TIMES,
  RememberedDate,
  RemindWhen,
  kindMeta,
} from '../data/dates';
import { cancelDateReminders } from '../services/dateReminders';
import {
  UpcomingRow,
  countdownLabel,
  formatDateLabel,
  remindLabel,
  upcoming,
  validateDateParts,
} from '../services/dates';
import { requestNotificationPermission } from '../services/notifications';
import { useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

type Draft = {
  id: string | null;
  title: string;
  kind: DateKind;
  day: string;
  month: number; // 1..12
  year: string;
  repeat: DateRepeat;
  remind: RemindWhen;
  time: string;
  enabled: boolean;
};

const emptyDraft = (): Draft => ({
  id: null,
  title: '',
  kind: 'birthday',
  day: '',
  month: new Date().getMonth() + 1,
  year: '',
  repeat: 'yearly',
  remind: 'dayBefore',
  time: DEFAULT_REMIND_TIME,
  enabled: true,
});

const draftFrom = (d: RememberedDate): Draft => ({
  id: d.id,
  title: d.title,
  kind: d.kind,
  day: String(d.day),
  month: d.month,
  year: d.year != null ? String(d.year) : '',
  repeat: d.repeat,
  remind: d.remind,
  time: d.time,
  enabled: d.enabled,
});

const REMIND_OPTIONS: { value: RemindWhen; label: string }[] = [
  { value: 'on', label: 'On the day' },
  { value: 'dayBefore', label: '1 day before' },
  { value: 'both', label: 'Both' },
];

const REPEAT_OPTIONS: { value: DateRepeat; label: string }[] = [
  { value: 'yearly', label: 'Every year' },
  { value: 'once', label: 'Just once' },
];

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
      // The number pad has no Done key: picking a chip is how the keyboard
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

const notificationsOffAlert = (body: string) =>
  Alert.alert('Notifications are off', body, [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Open Settings',
      onPress: () => Linking.openSettings().catch(() => {}),
    },
  ]);

/**
 * Remember dates: birthdays, anniversaries, remembrance days, deadlines —
 * each with its own "on the day / day before" reminder, every year or once.
 */
function RememberDatesScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const dates = useStore(s => s.dates);
  const addDate = useStore(s => s.addDate);
  const updateDate = useStore(s => s.updateDate);
  const removeDate = useStore(s => s.removeDate);

  const [draft, setDraft] = useState<Draft | null>(null);

  const rows = useMemo(() => upcoming(dates), [dates]);
  const ahead = rows.filter(r => r.days != null);
  const past = rows.filter(r => r.days == null);

  const save = async () => {
    if (!draft) {
      return;
    }
    Keyboard.dismiss();
    const title = draft.title.trim();
    if (!title) {
      Alert.alert('Give it a name', kindMeta(draft.kind).hint);
      return;
    }
    const day = Number(draft.day);
    const year = draft.year.trim() === '' ? undefined : Number(draft.year);
    const error = validateDateParts({
      day,
      month: draft.month,
      year,
      repeat: draft.repeat,
    });
    if (error) {
      Alert.alert('Check the date', error);
      return;
    }
    // Saving with the reminder on is the user-initiated path that may raise
    // the OS permission dialog; App.tsx then arms the triggers silently.
    let enabled = draft.enabled;
    if (enabled && !(await requestNotificationPermission())) {
      enabled = false;
      notificationsOffAlert(
        'The date is saved, but Routiner can’t remind you until notifications are allowed in iOS Settings.',
      );
    }
    const fields = {
      title,
      kind: draft.kind,
      day,
      month: draft.month,
      year,
      repeat: draft.repeat,
      remind: draft.remind,
      time: draft.time,
      enabled,
    };
    if (draft.id) {
      updateDate(draft.id, fields);
    } else {
      addDate(fields);
    }
    setDraft(null);
  };

  const toggle = async (d: RememberedDate, on: boolean) => {
    if (on && !(await requestNotificationPermission())) {
      notificationsOffAlert(
        'Allow notifications for Routiner in iOS Settings to get this reminder.',
      );
      return;
    }
    updateDate(d.id, { enabled: on });
  };

  const remove = (id: string, title: string) =>
    Alert.alert('Delete this date?', `“${title}” will be forgotten.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeDate(id);
          cancelDateReminders(id);
          setDraft(null);
        },
      },
    ]);

  const renderRow = (row: UpcomingRow) => {
    const d = row.entry;
    return (
      <Card key={d.id} style={styles.rowCard} accessible={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens the editor"
          onPress={() => setDraft(draftFrom(d))}
          style={styles.rowBody}
        >
          <View style={styles.iconChip}>
            <AppText variant="body">{kindMeta(d.kind).emoji}</AppText>
          </View>
          <View style={styles.flex}>
            <AppText
              variant="bodyMedium"
              color={row.days == null ? colors.ink60 : colors.ink}
            >
              {d.title}
            </AppText>
            <AppText variant="alt" color={colors.ink60}>
              {formatDateLabel(d)} · {countdownLabel(row.days)}
              {row.years ? ` · ${row.years}` : ''}
            </AppText>
            <AppText variant="alt" color={colors.ink60}>
              🔔 {remindLabel(d)} ·{' '}
              {d.repeat === 'once' ? 'once' : 'every year'}
            </AppText>
          </View>
        </Pressable>
        {row.days != null && (
          <Switch
            testID={`switch-date-${d.id}`}
            accessibilityLabel={`Remind me about ${d.title}`}
            value={d.enabled}
            onValueChange={v => toggle(d, v)}
            trackColor={{ true: colors.green, false: colors.ink10 }}
          />
        )}
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
          <AppText variant="h6">Remember dates</AppText>
          <AppText variant="alt" color={colors.ink60}>
            {dates.length === 0
              ? 'Birthdays, anniversaries, deadlines'
              : `${dates.length} date${dates.length === 1 ? '' : 's'} · ${
                  ahead.length
                } coming up`}
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
          <PrimaryButton
            label="Add a date"
            onPress={() => setDraft(emptyDraft())}
          />
        )}

        {draft && (
          <Card style={styles.form} accessible={false}>
            <AppText variant="chip" color={colors.ink60}>
              {draft.id ? 'Edit date' : 'New date'}
            </AppText>
            <View style={styles.chipRow}>
              {KINDS.map(k => (
                <Chip
                  key={k.kind}
                  label={`${k.emoji} ${k.label}`}
                  accessibilityLabel={k.label}
                  on={draft.kind === k.kind}
                  onPress={() =>
                    setDraft({
                      ...draft,
                      kind: k.kind,
                      // A new entry follows the kind's usual cadence; an
                      // edited one keeps what the user chose.
                      repeat: draft.id ? draft.repeat : k.defaultRepeat,
                    })
                  }
                />
              ))}
            </View>
            <TextInput
              testID="date-title"
              value={draft.title}
              onChangeText={title => setDraft({ ...draft, title })}
              placeholder={kindMeta(draft.kind).hint}
              placeholderTextColor={colors.ink40}
              accessibilityLabel="Title"
              style={styles.input}
              returnKeyType="done"
            />

            <AppText variant="chip" color={colors.ink60}>
              Date
            </AppText>
            <View style={styles.dateRow}>
              <TextInput
                testID="date-day"
                value={draft.day}
                onChangeText={day =>
                  setDraft({ ...draft, day: day.replace(/[^0-9]/g, '') })
                }
                placeholder="Day"
                placeholderTextColor={colors.ink40}
                keyboardType="number-pad"
                maxLength={2}
                accessibilityLabel="Day"
                style={[styles.input, styles.dayInput]}
              />
              <TextInput
                testID="date-year"
                value={draft.year}
                onChangeText={year =>
                  setDraft({ ...draft, year: year.replace(/[^0-9]/g, '') })
                }
                placeholder={
                  draft.repeat === 'once' ? 'Year' : 'Year (optional)'
                }
                placeholderTextColor={colors.ink40}
                keyboardType="number-pad"
                maxLength={4}
                accessibilityLabel="Year"
                style={[styles.input, styles.flex]}
              />
            </View>
            <View style={styles.chipRow}>
              {MONTHS_SHORT.map((m, i) => (
                <Chip
                  key={m}
                  label={m}
                  accessibilityLabel={MONTHS[i]}
                  on={draft.month === i + 1}
                  onPress={() => setDraft({ ...draft, month: i + 1 })}
                />
              ))}
            </View>

            <AppText variant="chip" color={colors.ink60}>
              Repeats
            </AppText>
            <View style={styles.chipRow}>
              {REPEAT_OPTIONS.map(o => (
                <Chip
                  key={o.value}
                  label={o.label}
                  on={draft.repeat === o.value}
                  onPress={() => setDraft({ ...draft, repeat: o.value })}
                />
              ))}
            </View>

            <AppText variant="chip" color={colors.ink60}>
              Remind me
            </AppText>
            <View style={styles.chipRow}>
              {REMIND_OPTIONS.map(o => (
                <Chip
                  key={o.value}
                  label={o.label}
                  on={draft.remind === o.value}
                  onPress={() => setDraft({ ...draft, remind: o.value })}
                />
              ))}
            </View>

            <AppText variant="chip" color={colors.ink60}>
              At
            </AppText>
            <View style={styles.chipRow}>
              {REMIND_TIMES.map(t => (
                <Chip
                  key={t}
                  label={t}
                  accessibilityLabel={`At ${t}`}
                  on={draft.time === t}
                  onPress={() => setDraft({ ...draft, time: t })}
                />
              ))}
            </View>

            <View style={styles.actions}>
              {draft.id && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete this date"
                  onPress={() => remove(draft.id as string, draft.title)}
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
            <PrimaryButton label="Save date" onPress={save} />
          </Card>
        )}

        {dates.length === 0 && !draft && (
          <AppText variant="body" color={colors.ink60}>
            Nothing remembered yet. Add a birthday, an anniversary or a
            deadline and Routiner will nudge you on the day, the day before,
            or both — every year.
          </AppText>
        )}

        {ahead.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Coming up" />
            {ahead.map(renderRow)}
          </View>
        )}

        {past.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Past" />
            {past.map(renderRow)}
            <AppText variant="alt" color={colors.ink60}>
              One-off dates that already happened. Tap one to delete it.
            </AppText>
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
  dayInput: { width: 88 },
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

export default RememberDatesScreen;
