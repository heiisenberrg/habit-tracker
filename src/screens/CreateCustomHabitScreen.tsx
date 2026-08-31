import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton, PrimaryButton } from '../components/common';
import { RootStackParamList } from '../navigation/RootNavigator';
import { scheduleDailyReminder } from '../services/notifications';
import { useStore, parseQuickAdd } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

const EMOJIS = ['🚶🏻', '💧', '📖', '🧘', '💻', '📓', '🌱', '😴'];
const COLORS = ['#FF7A00', '#3843FF', '#3BA935', '#E3524F', '#B620E0'];

/** "Create Custom Habit" screen from the Figma Home & Add Habit section. */
function CreateCustomHabitScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'CreateCustomHabit'>>();
  const insets = useSafeAreaInsets();
  const addHabit = useStore(s => s.addHabit);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [goal, setGoal] = useState(1);
  const [reminder, setReminder] = useState(true);
  const [reminderTime, setReminderTime] = useState('09:00');
  const [kind, setKind] = useState<'build' | 'quit'>(
    route.params?.kind ?? 'build',
  );
  const [focused, setFocused] = useState(false);

  const parsed = parseQuickAdd(name);
  const parsedGoal = parsed.goal;

  // A typed "x3" seeds the goal state; the +/− steppers keep working from it.
  useEffect(() => {
    if (parsedGoal != null) {
      setGoal(parsedGoal);
    }
  }, [parsedGoal]);

  const submit = async () => {
    const label = parsed.name || 'New habit';
    if (reminder && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(reminderTime.trim())) {
      Alert.alert(
        'Invalid reminder time',
        'Use 24-hour HH:MM, e.g. 07:30 or 21:00.',
      );
      return;
    }
    const id = `custom-${Date.now()}`;
    const displayName = kind === 'quit' ? `${label} (quit)` : label;
    // Schedule first so the stored habit never claims a reminder that
    // the OS refused (permission denied / notifications unavailable).
    const reminderOk = reminder
      ? await scheduleDailyReminder(id, displayName, reminderTime)
      : false;
    addHabit({
      id,
      name: displayName,
      emoji,
      color,
      type: kind === 'quit' ? 'bad' : 'good',
      goal: { amount: goal, unit: 'TIMES' },
      step: 1,
      friendIds: [],
      tracking: goal > 1 ? 'count' : 'check',
      kind,
      reminder: reminder
        ? { time: reminderTime, enabled: reminderOk }
        : undefined,
    });
    if (reminder && !reminderOk) {
      Alert.alert(
        'Reminder not scheduled',
        'Notifications are off for Routiner, so the daily reminder could not be set. Enable notifications in Settings, then turn the reminder on from the app’s Settings screen.',
      );
    }
    navigation.replace('Success', { title: `${label} added to your habits!` });
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
        <AppText variant="h6">Create Custom Habit</AppText>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink40}>
            Name
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Try: Meditate x2"
            placeholderTextColor={colors.ink20}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[styles.input, focused && styles.inputFocused]}
          />
          {name.length > 0 && parsed.goal != null && (
            <View style={styles.chipRow}>
              <View style={styles.parseChip}>
                <AppText variant="alt" color={colors.blue}>
                  × {parsed.goal} per day
                </AppText>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink40}>
            Icon and Color
          </AppText>
          <View style={styles.pickRow}>
            {EMOJIS.map(e => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={[
                  styles.emojiCell,
                  e === emoji && [
                    styles.cellActive,
                    { borderColor: color, backgroundColor: `${color}1A` },
                  ],
                ]}
              >
                <AppText variant="title">{e}</AppText>
              </Pressable>
            ))}
          </View>
          <View style={styles.pickRow}>
            {COLORS.map(c => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[
                  styles.colorCell,
                  { backgroundColor: c },
                  c === color && styles.colorActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink40}>
            Goal
          </AppText>
          <Card style={styles.goalCard}>
            <Pressable
              onPress={() => setGoal(g => Math.max(1, g - 1))}
              style={styles.stepButton}
            >
              <AppText variant="h6">−</AppText>
            </Pressable>
            <View style={styles.goalText}>
              <AppText variant="bodyMedium" center>
                {goal} times
              </AppText>
              <AppText variant="alt" color={colors.ink40} center>
                or more per day · Daily · Every day
              </AppText>
            </View>
            <Pressable
              onPress={() => setGoal(g => g + 1)}
              style={styles.stepButton}
            >
              <AppText variant="h6">+</AppText>
            </Pressable>
          </Card>
        </View>

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink40}>
            Reminders
          </AppText>
          <Card style={styles.reminderCard}>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Remind me daily</AppText>
              <View style={styles.reminderTimeRow}>
                <AppText variant="alt" color={colors.ink40}>
                  🕐
                </AppText>
                <TextInput
                  value={reminderTime}
                  onChangeText={setReminderTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.ink20}
                  keyboardType="numbers-and-punctuation"
                  style={styles.reminderTimeInput}
                />
                <AppText variant="alt" color={colors.ink40}>
                  · Every day
                </AppText>
              </View>
            </View>
            <Switch
              accessibilityLabel="Daily reminder"
              value={reminder}
              onValueChange={setReminder}
              trackColor={{ true: colors.blue, false: colors.ink10 }}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <AppText variant="chip" color={colors.ink40}>
            Habit Type
          </AppText>
          <View style={styles.segment}>
            {(['build', 'quit'] as const).map(k => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.segmentTab, kind === k && styles.segmentActive]}
              >
                <AppText
                  variant="bodyMedium"
                  color={kind === k ? colors.blue : colors.ink60}
                  center
                >
                  {k === 'build' ? 'Build' : 'Quit'}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>

        <PrimaryButton
          label="Add Habit"
          disabled={parsed.name.length === 0}
          onPress={submit}
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
    gap: spacing.md,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
  },
  content: { paddingHorizontal: screenPadding, gap: spacing.xl },
  section: { gap: spacing.sm },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    fontSize: 17,
    fontWeight: '500',
    color: colors.ink,
  },
  inputFocused: { borderBottomColor: colors.blue },
  chipRow: { flexDirection: 'row', gap: spacing.xs },
  parseChip: {
    borderWidth: 1,
    borderColor: colors.blue40,
    backgroundColor: colors.blue10,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  emojiCell: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellActive: { borderColor: colors.blue, backgroundColor: colors.blue10 },
  colorCell: { width: 28, height: 28, borderRadius: 14 },
  colorActive: { borderWidth: 3, borderColor: colors.border },
  goalCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goalText: { flex: 1 },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  reminderTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reminderTimeInput: {
    fontSize: 12,
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 0,
    minWidth: 44,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.ink10,
    borderRadius: radius.md,
    padding: 2,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md - 2,
  },
  segmentActive: { backgroundColor: colors.surface },
});

export default CreateCustomHabitScreen;
