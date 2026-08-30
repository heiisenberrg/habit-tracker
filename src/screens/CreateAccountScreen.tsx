import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import {
  IconButton,
  PrimaryButton,
  SecondaryButton,
} from '../components/common';
import { HabitGoalUnit } from '../data/seed';
import { useStore } from '../store/useStore';
import {
  cardShadow,
  colors,
  radius,
  screenPadding,
  spacing,
} from '../theme/theme';

type FirstHabit = {
  id: string;
  name: string;
  emoji: string;
  goal: { amount: number; unit: HabitGoalUnit };
  step: number;
};

const FIRST_HABITS: FirstHabit[] = [
  {
    id: 'fh-water',
    name: 'Drink water',
    emoji: '💧',
    goal: { amount: 2000, unit: 'ML' },
    step: 500,
  },
  {
    id: 'fh-run',
    name: 'Run',
    emoji: '🏃🏻‍♀️',
    goal: { amount: 5, unit: 'KM' },
    step: 1,
  },
  {
    id: 'fh-read',
    name: 'Read books',
    emoji: '📖',
    goal: { amount: 20, unit: 'PAGES' },
    step: 5,
  },
  {
    id: 'fh-meditate',
    name: 'Meditate',
    emoji: '🧘🏻‍♀️',
    goal: { amount: 30, unit: 'MIN' },
    step: 10,
  },
  {
    id: 'fh-study',
    name: 'Study',
    emoji: '👨🏻‍💻',
    goal: { amount: 60, unit: 'MIN' },
    step: 15,
  },
  {
    id: 'fh-journal',
    name: 'Journal',
    emoji: '📕',
    goal: { amount: 1, unit: 'TIMES' },
    step: 1,
  },
  {
    id: 'fh-plants',
    name: 'Plant care',
    emoji: '🌿',
    goal: { amount: 1, unit: 'TIMES' },
    step: 1,
  },
  {
    id: 'fh-sleep',
    name: 'Sleep early',
    emoji: '😴',
    goal: { amount: 1, unit: 'TIMES' },
    step: 1,
  },
];

function UnderlineField({
  label,
  value,
  onChangeText,
  placeholder,
  showClear,
  keyboardType,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  showClear?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;
  return (
    <View style={styles.field}>
      <AppText variant="chip" color={colors.ink40}>
        {label}
      </AppText>
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink20}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            styles.input,
            focused && styles.inputFocused,
            filled && styles.inputFilled,
            error != null && styles.inputError,
          ]}
        />
        {showClear && filled && (
          <Pressable
            onPress={() => onChangeText('')}
            style={styles.clearChip}
            hitSlop={8}
          >
            <AppText variant="chip" color={colors.ink60}>
              ✕
            </AppText>
          </Pressable>
        )}
      </View>
      {error != null && (
        <AppText variant="alt" color={colors.red}>
          {error}
        </AppText>
      )}
    </View>
  );
}

const BIRTHDATE_RE = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;

/** Format AND calendar-real: rejects 02/31/2020, year < 1900, future dates. */
const isRealBirthdate = (s: string): boolean => {
  if (!BIRTHDATE_RE.test(s)) {
    return false;
  }
  const [mm, dd, yyyy] = s.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return (
    d.getFullYear() === yyyy &&
    d.getMonth() === mm - 1 &&
    d.getDate() === dd &&
    yyyy >= 1900 &&
    d.getTime() <= Date.now()
  );
};

/** Normalized habit name so "Drink water" matches seeded "Drink the water". */
const normHabit = (n: string) =>
  n
    .toLowerCase()
    .replace(/\bthe\b/g, ' ')
    .replace(/[^a-z]/g, '');

/** Keep only digits and auto-insert the mm/dd/yyyy slashes. */
function formatBirthdate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4, 8),
  ].filter(p => p.length > 0);
  return parts.join('/');
}

/** 3-step Create Account wizard per the Figma "Create Account 01-03" screens. */
function CreateAccountScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, setUser, completeOnboarding, habits, addHabit } = useStore();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(user.name);
  const [surname, setSurname] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const ownedNames = new Set(habits.map(h => normHabit(h.name)));
  const firstChoices = FIRST_HABITS.filter(
    fh => !ownedNames.has(normHabit(fh.name)),
  );
  const [selected, setSelected] = useState<string[]>(
    firstChoices[0] ? [firstChoices[0].id] : [],
  );

  const back = () => (step > 0 ? setStep(step - 1) : navigation.goBack());

  // Hardware back / swipe-back step the wizard instead of silently
  // dropping the half-entered profile.
  useEffect(() => {
    navigation.setOptions?.({ gestureEnabled: step === 0 });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        setStep(s => s - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, navigation]);

  const birthdateValid = birthdate.length === 0 || isRealBirthdate(birthdate);

  const finish = () => {
    setUser({
      name: name.trim() || user.name,
      surname: surname.trim() || user.surname,
      ...(gender ? { gender } : null),
      ...(birthdate.length > 0 ? { birthdate } : null),
    });
    firstChoices
      .filter(fh => selected.includes(fh.id))
      .forEach(fh =>
        addHabit({
          id: `${fh.id}-${Date.now()}`,
          name: fh.name,
          emoji: fh.emoji,
          type: 'good',
          goal: fh.goal,
          step: fh.step,
          friendIds: [],
          tracking: fh.goal.amount > 1 ? 'count' : 'check',
          kind: 'build',
        }),
      );
    completeOnboarding();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const next = () => (step < 2 ? setStep(step + 1) : finish());
  const nextDisabled =
    (step === 0 && (name.trim().length === 0 || !birthdateValid)) ||
    (step === 1 && gender === null) ||
    (step === 2 && firstChoices.length > 0 && selected.length === 0);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton size={40} onPress={back}>
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <View>
          <AppText variant="h6">Create Account</AppText>
          {user.email.length > 0 && (
            <AppText variant="chip" color={colors.ink40}>
              {user.email}
            </AppText>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <View style={styles.form}>
            <UnderlineField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              showClear
            />
            <UnderlineField
              label="Surname"
              value={surname}
              onChangeText={setSurname}
              placeholder="Enter your surname"
            />
            <UnderlineField
              label="Birthdate (optional)"
              value={birthdate}
              onChangeText={t => setBirthdate(formatBirthdate(t))}
              placeholder="mm/dd/yyyy"
              keyboardType="number-pad"
              error={
                birthdateValid ? undefined : 'Enter a valid mm/dd/yyyy date'
              }
            />
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepBlock}>
            <AppText variant="title">Choose your gender</AppText>
            <View style={styles.genderRow}>
              {(
                [
                  { key: 'male', label: 'Male', emoji: '🤷🏻‍♂️' },
                  { key: 'female', label: 'Female', emoji: '💁🏻‍♀️' },
                ] as const
              ).map(g => (
                <Pressable
                  key={g.key}
                  onPress={() => setGender(g.key)}
                  style={[
                    styles.genderCard,
                    gender === g.key && styles.cardSelected,
                  ]}
                >
                  <AppText style={styles.genderEmoji}>{g.emoji}</AppText>
                  <AppText variant="bodyMedium" center>
                    {g.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepBlock}>
            <View>
              <AppText variant="title">Choose your first habits</AppText>
              <AppText variant="body" color={colors.ink40}>
                You may add more habits later
              </AppText>
            </View>
            {firstChoices.length === 0 && (
              <AppText variant="body" color={colors.ink40}>
                You already have all the starter habits — tap Finish to
                continue.
              </AppText>
            )}
            <View style={styles.habitGrid}>
              {firstChoices.map(fh => {
                const active = selected.includes(fh.id);
                return (
                  <Pressable
                    key={fh.id}
                    onPress={() =>
                      setSelected(s =>
                        active ? s.filter(x => x !== fh.id) : [...s, fh.id],
                      )
                    }
                    style={[styles.habitCard, active && styles.cardSelected]}
                  >
                    <AppText style={styles.habitEmoji}>{fh.emoji}</AppText>
                    <AppText variant="bodyMedium" center>
                      {fh.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        {step === 1 && gender === null && (
          <SecondaryButton label="Skip this step" onPress={() => setStep(2)} />
        )}
        <PrimaryButton
          label={step === 2 ? 'Finish' : 'Next'}
          disabled={nextDisabled}
          onPress={next}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  body: { flex: 1 },
  bodyContent: { padding: screenPadding, gap: spacing.xl },
  form: { gap: spacing.xl },
  field: { gap: spacing.xs },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocused: { borderBottomColor: colors.blue },
  inputFilled: { borderBottomColor: colors.green },
  inputError: { borderBottomColor: colors.red },
  clearChip: {
    position: 'absolute',
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBlock: { gap: spacing.lg },
  genderRow: { flexDirection: 'row', gap: spacing.lg },
  genderCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    ...cardShadow,
  },
  genderEmoji: { fontSize: 40, lineHeight: 48 },
  habitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  habitCard: {
    width: '46%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    ...cardShadow,
  },
  habitEmoji: { fontSize: 36, lineHeight: 44 },
  cardSelected: { borderColor: colors.blue },
  footer: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});

export default CreateAccountScreen;
