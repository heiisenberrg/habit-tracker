import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Alert,
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
  SecondaryButton,
} from '../components/common';
import { TimeCircleIcon } from '../components/icons';
import {
  connectCalendar,
  fetchBlocksForDate,
} from '../services/deviceCalendar';
import { addDays, toDateKey, todayKey, useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

const WDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Calendar planner: todos + time blocks, with device-calendar import. */
function CalendarScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {
    planner,
    addPlannerItem,
    togglePlannerItem,
    movePlannerItem,
    deletePlannerItem,
    importCalendarBlocks,
    calendarConnected,
    setIntegration,
  } = useStore();

  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState(() => todayKey());
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [kind, setKind] = useState<'task' | 'block'>('task');

  const monthLabel = month.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const lead = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();

  const cells: { key: string; day: number | null }[] = [
    ...Array.from({ length: lead }, (_, i) => ({
      key: `lead-${i}`,
      day: null,
    })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      key: toDateKey(new Date(month.getFullYear(), month.getMonth(), i + 1)),
      day: i + 1,
    })),
  ];

  const dayItems = planner
    .filter(t => t.date === selected)
    .sort((a, b) => ((a.time || '99') < (b.time || '99') ? -1 : 1));

  const selDate = new Date(`${selected}T00:00`);
  const selLabel =
    selected === todayKey()
      ? 'Today'
      : selDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });

  const addItem = () => {
    const t = title.trim();
    if (!t) {
      return;
    }
    addPlannerItem({
      date: selected,
      title: t,
      time: time.trim(),
      type: kind,
      done: false,
    });
    setTitle('');
    setTime('');
  };

  const importFromDevice = async () => {
    let connected = calendarConnected;
    if (!connected) {
      connected = await connectCalendar();
      setIntegration('calendarConnected', connected);
    }
    if (!connected) {
      Alert.alert(
        'Calendar access needed',
        'Allow calendar access in Settings to import your meetings as time blocks.',
      );
      return;
    }
    const blocks = await fetchBlocksForDate(selDate);
    importCalendarBlocks(selected, blocks);
    Alert.alert(
      'Calendar synced',
      blocks.length
        ? `${blocks.length} event${
            blocks.length === 1 ? '' : 's'
          } imported as time blocks.`
        : 'No events found for this day.',
    );
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton size={40} onPress={() => navigation.goBack()}>
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <AppText variant="h6" style={styles.flex}>
          Calendar
        </AppText>
        <IconButton
          size={32}
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <AppText variant="body" color={colors.ink60}>
            ‹
          </AppText>
        </IconButton>
        <AppText
          variant="alt"
          color={colors.ink60}
          style={styles.monthLabel}
          center
        >
          {monthLabel}
        </AppText>
        <IconButton
          size={32}
          onPress={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <AppText variant="body" color={colors.ink60}>
            ›
          </AppText>
        </IconButton>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* weekday header + month grid */}
        <View style={styles.grid}>
          {WDAYS.map((w, i) => (
            <View key={`w-${i}`} style={styles.cell}>
              <AppText variant="chip" color={colors.ink40} center>
                {w}
              </AppText>
            </View>
          ))}
          {cells.map(c => {
            if (c.day == null) {
              return <View key={c.key} style={styles.cell} />;
            }
            const isSel = c.key === selected;
            const isToday = c.key === todayKey();
            const hasTask = planner.some(
              t => t.date === c.key && t.type === 'task',
            );
            const hasBlock = planner.some(
              t => t.date === c.key && t.type === 'block',
            );
            return (
              <Pressable
                key={c.key}
                onPress={() => setSelected(c.key)}
                style={[
                  styles.cell,
                  styles.dayCell,
                  isToday && styles.todayCell,
                  isSel && styles.selCell,
                ]}
              >
                <AppText
                  variant="body"
                  color={
                    isSel ? colors.blue : isToday ? colors.blue : colors.ink
                  }
                  center
                >
                  {c.day}
                </AppText>
                <View style={styles.dotRow}>
                  {hasTask && <View style={[styles.dot, styles.dotTask]} />}
                  {hasBlock && <View style={[styles.dot, styles.dotBlock]} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* selected day */}
        <View style={styles.dayHeader}>
          <AppText variant="chip" color={colors.ink40}>
            {selLabel}
          </AppText>
          <AppText variant="chip" color={colors.ink20}>
            {dayItems.length ? `${dayItems.length} planned` : ''}
          </AppText>
        </View>

        {dayItems.length === 0 && (
          <AppText variant="alt" color={colors.ink40} center>
            Nothing planned — add a task or block time below
          </AppText>
        )}
        {dayItems.map(t => (
          <Card key={t.id} style={styles.itemCard}>
            {t.type === 'task' ? (
              <Pressable
                onPress={() => togglePlannerItem(t.id)}
                style={[styles.checkbox, t.done && styles.checkboxDone]}
              >
                {t.done && (
                  <AppText variant="chip" color={colors.white}>
                    ✓
                  </AppText>
                )}
              </Pressable>
            ) : (
              <TimeCircleIcon size={22} />
            )}
            <View style={styles.flex}>
              <AppText
                variant="bodyMedium"
                color={t.done ? colors.ink40 : colors.ink}
                style={t.done && styles.struck}
              >
                {t.title}
              </AppText>
              <View style={styles.metaRow}>
                <AppText variant="alt" color={colors.ink40}>
                  {t.time || (t.type === 'task' ? 'Any time' : '')}
                </AppText>
                {t.type === 'block' && (
                  <View style={styles.blockChip}>
                    <AppText variant="chip" color={colors.ink40}>
                      time block
                    </AppText>
                  </View>
                )}
              </View>
            </View>
            {t.type === 'task' && !t.done && (
              <Pressable
                onPress={() =>
                  movePlannerItem(
                    t.id,
                    toDateKey(addDays(new Date(`${t.date}T00:00`), 1)),
                  )
                }
                style={styles.postponeChip}
              >
                <AppText variant="chip" color={colors.blue}>
                  +1d
                </AppText>
              </Pressable>
            )}
            <Pressable hitSlop={8} onPress={() => deletePlannerItem(t.id)}>
              <AppText variant="body" color={colors.ink20}>
                ✕
              </AppText>
            </Pressable>
          </Card>
        ))}

        {/* add form */}
        <Card style={styles.form}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={
              kind === 'block' ? 'e.g. Work meeting' : 'e.g. Update resume'
            }
            placeholderTextColor={colors.ink20}
            style={styles.input}
          />
          <View style={styles.formRow}>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="09:30–10:30 (optional)"
              placeholderTextColor={colors.ink20}
              style={[styles.input, styles.flex]}
            />
            {(['task', 'block'] as const).map(k => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.kindChip, kind === k && styles.kindActive]}
              >
                <AppText
                  variant="alt"
                  color={kind === k ? colors.blue : colors.ink60}
                >
                  {k === 'task' ? 'Task' : 'Time block'}
                </AppText>
              </Pressable>
            ))}
          </View>
          <PrimaryButton
            label={kind === 'block' ? 'Block this time' : 'Add task'}
            disabled={title.trim().length === 0}
            onPress={addItem}
          />
        </Card>

        <SecondaryButton
          label="⤓ Import meetings from device calendar"
          onPress={importFromDevice}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthLabel: { minWidth: 96 },
  content: { padding: screenPadding, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  dayCell: {
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minHeight: 44,
  },
  todayCell: { borderColor: 'rgba(56,67,255,0.35)' },
  selCell: { borderColor: colors.blue, backgroundColor: colors.blue10 },
  dotRow: { flexDirection: 'row', gap: 2, height: 5 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotTask: { backgroundColor: colors.blue },
  dotBlock: { backgroundColor: colors.ink40 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.8,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.blue, borderColor: colors.blue },
  struck: { textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blockChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
  },
  postponeChip: {
    backgroundColor: colors.blue10,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  form: { gap: spacing.sm, alignSelf: 'stretch' },
  formRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.ink,
  },
  kindChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  kindActive: { borderColor: colors.blue, backgroundColor: colors.blue10 },
});

export default CalendarScreen;
