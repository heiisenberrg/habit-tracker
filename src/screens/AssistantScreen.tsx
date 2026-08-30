import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { IconButton } from '../components/common';
import {
  advance,
  AnswerMap,
  Flow,
  FlowStep,
  FLOWS,
  ROOT_MENU,
  StepInput,
} from '../data/assistantFlows';
import { RootStackParamList } from '../navigation/RootNavigator';
import { scheduleDailyReminder } from '../services/notifications';
import {
  addDays,
  parseQuickAdd,
  toDateKey,
  todayKey,
  useStore,
} from '../store/useStore';
import {
  colors,
  gradients,
  radius,
  screenPadding,
  spacing,
} from '../theme/theme';

const logo = require('../assets/logo.png');

type Message = { id: string; from: 'bot' | 'me'; text: string };

type ChatState = {
  flow: Flow | null;
  step: FlowStep | null;
  answers: AnswerMap;
  /** 'menu' shows the root options; 'input' the step input; 'end' the wrap-up chips */
  mode: 'menu' | 'input' | 'end';
};

let msgId = 0;
const nextId = () => `m${++msgId}`;

/** One-line captions for the root menu action cards. */
const MENU_CAPTIONS: Record<string, string> = {
  habit: 'Build a routine with a goal and reminder',
  task: 'Plan something for today or tomorrow',
  reminder: 'A daily nudge at the right time',
  quick: 'One line — the rest is parsed for you',
};

/** Animated three-dot typing indicator. */
function TypingDots() {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(a, {
            toValue: 1,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.timing(a, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 140),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [anims]);
  return (
    <View style={styles.dotsRow}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: a.interpolate({
                inputRange: [0, 1],
                outputRange: [0.35, 1],
              }),
              transform: [
                {
                  translateY: a.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function AssistantScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Assistant'>>();
  const insets = useSafeAreaInsets();
  const { addHabit, addPlannerItem } = useStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [chat, setChat] = useState<ChatState>({
    flow: null,
    step: null,
    answers: {},
    mode: 'menu',
  });
  const [draft, setDraft] = useState('');
  const [customTime, setCustomTime] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const pushBot = useCallback((text: string, after?: () => void) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      // id minted outside the updater: React dev mode double-invokes
      // updaters, which would burn ids and can duplicate keys.
      const id = nextId();
      setMessages(m => [...m, { id, from: 'bot', text }]);
      after?.();
    }, 480);
  }, []);

  const pushMe = (text: string) => {
    const id = nextId();
    setMessages(m => [...m, { id, from: 'me', text }]);
  };

  // Greeting (or jump straight into a requested flow). The ref guard keeps
  // dev-mode double-mounted effects from greeting twice.
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current) {
      return;
    }
    greeted.current = true;
    const requested = route.params?.flow;
    if (requested && FLOWS[requested]) {
      startFlow(requested, false);
    } else {
      pushBot(ROOT_MENU.bot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => scrollRef.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(t);
  }, [messages, typing]);

  const startFlow = (id: Flow['id'], echo = true) => {
    const flow = FLOWS[id];
    if (echo) {
      const option = ROOT_MENU.options.find(o => o.value === id);
      pushMe(option?.label ?? id);
    }
    const step = flow.steps[flow.start];
    setChat({ flow, step, answers: {}, mode: 'input' });
    pushBot(step.bot({}));
  };

  /**
   * Create the real thing once a flow completes. Reminders are scheduled
   * first so the stored habit (and the summary) never claim a notification
   * the OS refused; a refusal is flagged via `reminderFailed`.
   */
  const completeFlow = async (
    flow: Flow,
    answers: AnswerMap,
  ): Promise<AnswerMap> => {
    const id = `assist-${Date.now()}`;
    if (flow.id === 'habit' || flow.id === 'quick') {
      const raw = flow.id === 'habit' ? answers.name : answers.line;
      const parsed = parseQuickAdd(raw ?? '');
      const name = parsed.name || 'New habit';
      const amount = parsed.goal ?? Number(answers.goal ?? '1');
      const kind = (answers.kind as 'build' | 'quit') ?? 'build';
      const withReminder = answers.remind === 'yes' && !!answers.time;
      const reminderOk = withReminder
        ? await scheduleDailyReminder(id, name, answers.time)
        : false;
      addHabit({
        id,
        name: kind === 'quit' ? `${name} (quit)` : name,
        emoji: answers.emoji ?? '🌱',
        type: kind === 'quit' ? 'bad' : 'good',
        goal: { amount, unit: 'TIMES' },
        step: 1,
        friendIds: [],
        tracking: amount > 1 ? 'count' : 'check',
        kind,
        reminder: withReminder
          ? { time: answers.time, enabled: reminderOk }
          : undefined,
      });
      return withReminder && !reminderOk
        ? { ...answers, parsedName: name, remind: 'no', reminderFailed: 'yes' }
        : { ...answers, parsedName: name };
    }
    if (flow.id === 'task') {
      const date =
        answers.when === 'tomorrow'
          ? toDateKey(addDays(new Date(), 1))
          : todayKey();
      addPlannerItem({
        date,
        title: answers.title,
        time: answers.type === 'block' ? answers.time ?? '' : '',
        type: (answers.type as 'task' | 'block') ?? 'task',
        done: false,
      });
      return answers;
    }
    // reminder -> a check-habit with a scheduled daily notification
    const reminderOk = await scheduleDailyReminder(
      id,
      answers.what,
      answers.time,
    );
    addHabit({
      id,
      name: answers.what,
      emoji: '💊',
      type: 'good',
      goal: { amount: 1, unit: 'TIMES' },
      step: 1,
      friendIds: [],
      tracking: 'check',
      kind: 'build',
      reminder: { time: answers.time, enabled: reminderOk },
    });
    return reminderOk ? answers : { ...answers, reminderFailed: 'yes' };
  };

  const answerStep = (value: string, echoText?: string) => {
    if (!chat.flow || !chat.step) {
      return;
    }
    pushMe(echoText ?? chat.step.echo?.(value) ?? value);
    const { answers, nextStep } = advance(
      chat.flow,
      chat.step.id,
      value,
      chat.answers,
    );
    setCustomTime(false);
    if (nextStep) {
      setChat({ ...chat, step: nextStep, answers });
      pushBot(nextStep.bot(answers));
    } else {
      const flow = chat.flow;
      completeFlow(flow, answers).then(finalAnswers => {
        setChat({ flow, step: null, answers: finalAnswers, mode: 'end' });
        if (finalAnswers.reminderFailed !== 'yes') {
          pushBot(flow.summary(finalAnswers));
        } else if (flow.id === 'reminder') {
          // The stock summary promises a ping the OS refused — stay honest.
          pushBot(
            `Saved “${finalAnswers.what}” as a daily habit, but I couldn’t schedule the notification — enable notifications for Routiner in Settings, then switch the reminder on there.`,
          );
        } else {
          pushBot(flow.summary(finalAnswers), () =>
            pushBot(
              'Heads up — I couldn’t schedule the reminder because notifications are off for Routiner. Enable them in Settings to get the daily nudge.',
            ),
          );
        }
      });
    }
  };

  const submitDraft = () => {
    const value = draft.trim();
    if (!value) {
      return;
    }
    setDraft('');
    answerStep(value);
  };

  const restart = () => {
    pushMe('Add another');
    setChat({ flow: null, step: null, answers: {}, mode: 'menu' });
    pushBot('On it — what’s next?');
  };

  /* ------------------------------ input area ------------------------------ */

  const renderChips = (
    options: { label: string; value: string }[],
    onPick: (value: string, label: string) => void,
  ) => (
    <View style={styles.chipsWrap}>
      {options.map(o => (
        <Pressable
          key={o.value}
          onPress={() => onPick(o.value, o.label)}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        >
          <AppText variant="bodyMedium" color={colors.blue}>
            {o.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );

  const renderInput = () => {
    if (typing) {
      return null;
    }
    if (chat.mode === 'menu') {
      return (
        <View style={styles.menuGrid}>
          {ROOT_MENU.options.map(o => {
            const [emoji, ...rest] = o.label.split(' ');
            return (
              <Pressable
                key={o.value}
                onPress={() => startFlow(o.value as Flow['id'])}
                style={({ pressed }) => [
                  styles.menuCard,
                  pressed && styles.pressed,
                ]}
              >
                <AppText variant="h6">{emoji}</AppText>
                <AppText variant="bodyMedium">{rest.join(' ')}</AppText>
                <AppText variant="alt" color={colors.ink40}>
                  {MENU_CAPTIONS[o.value] ?? ''}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      );
    }
    if (chat.mode === 'end') {
      return renderChips(
        [
          { label: '✨ Add another', value: 'again' },
          { label: 'Done', value: 'done' },
        ],
        v => (v === 'again' ? restart() : navigation.goBack()),
      );
    }
    const input: StepInput | undefined = chat.step?.input;
    if (!input) {
      return null;
    }
    if (input.kind === 'text' || customTime) {
      return (
        <View style={styles.textRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={
              customTime
                ? 'HH:MM'
                : input.kind === 'text'
                ? input.placeholder
                : ''
            }
            placeholderTextColor={colors.ink20}
            autoFocus
            onSubmitEditing={submitDraft}
            returnKeyType="send"
            style={styles.textInput}
          />
          <Pressable onPress={submitDraft} style={styles.sendButton}>
            <AppText variant="bodyMedium" color={colors.white}>
              ↑
            </AppText>
          </Pressable>
        </View>
      );
    }
    if (input.kind === 'emoji') {
      return (
        <View style={styles.chipsWrap}>
          {input.options.map(e => (
            <Pressable
              key={e}
              onPress={() => answerStep(e)}
              style={({ pressed }) => [
                styles.emojiChip,
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="title">{e}</AppText>
            </Pressable>
          ))}
        </View>
      );
    }
    if (input.kind === 'time') {
      return (
        <View style={styles.chipsWrap}>
          {input.options.map(t => (
            <Pressable
              key={t}
              onPress={() => answerStep(t)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <AppText variant="bodyMedium" color={colors.blue}>
                {t}
              </AppText>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setCustomTime(true)}
            style={({ pressed }) => [
              styles.chip,
              styles.chipGhost,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="bodyMedium" color={colors.ink60}>
              Custom…
            </AppText>
          </Pressable>
        </View>
      );
    }
    return renderChips(input.options, (v, label) =>
      answerStep(v, chat.step?.echo?.(v) ?? label),
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton size={40} onPress={() => navigation.goBack()}>
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <View style={styles.avatar}>
          <Image source={logo} style={styles.avatarImg} resizeMode="contain" />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyMedium">Routiner Assistant</AppText>
          <AppText variant="alt" color={colors.green}>
            ● Always ready
          </AppText>
        </View>
      </View>

      {/* Transcript */}
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.transcript}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map(m =>
          m.from === 'bot' ? (
            <View key={m.id} style={styles.botRow}>
              <View style={styles.botAvatar}>
                <Image
                  source={logo}
                  style={styles.botAvatarImg}
                  resizeMode="contain"
                />
              </View>
              <View style={[styles.bubble, styles.botBubble]}>
                <AppText variant="body">{m.text}</AppText>
              </View>
            </View>
          ) : (
            <View key={m.id} style={[styles.bubble, styles.meBubble]}>
              <LinearGradient
                colors={gradients.blue}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.meFill}
              />
              <AppText variant="body" color={colors.white}>
                {m.text}
              </AppText>
            </View>
          ),
        )}
        {typing && (
          <View style={styles.botRow}>
            <View style={styles.botAvatar}>
              <Image
                source={logo}
                style={styles.botAvatarImg}
                resizeMode="contain"
              />
            </View>
            <View style={[styles.bubble, styles.botBubble, styles.typing]}>
              <TypingDots />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View
        style={[
          styles.inputArea,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        {renderInput()}
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blue10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 26, height: 26 },
  transcript: {
    padding: screenPadding,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    overflow: 'hidden',
  },
  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  botAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.blue10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botAvatarImg: { width: 15, height: 15 },
  botBubble: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ink40,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  menuCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  meBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  meFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  typing: { paddingVertical: spacing.sm },
  inputArea: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.blue40,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipGhost: { borderColor: colors.border },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});

export default AssistantScreen;
