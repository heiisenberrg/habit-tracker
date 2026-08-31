import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import ChatTranscript, {
  Message,
  ScrollHandle,
} from '../components/assistant/ChatTranscript';
import FlowInput, { ChipRow } from '../components/assistant/FlowInput';
import MenuCards from '../components/assistant/MenuCards';
import { IconButton } from '../components/common';
import {
  advance,
  AnswerMap,
  Flow,
  FlowStep,
  FLOWS,
  parseQuickLog,
  ROOT_MENU,
} from '../data/assistantFlows';
import { RootStackParamList } from '../navigation/RootNavigator';
import { afterMutation } from '../services/afterMutation';
import { scheduleDailyReminder } from '../services/notifications';
import {
  addDays,
  parseQuickAdd,
  toDateKey,
  todayKey,
  useStore,
} from '../store/useStore';
import { colors, screenPadding, spacing } from '../theme/theme';

const logo = require('../assets/logo.png');

type ChatState = {
  flow: Flow | null;
  step: FlowStep | null;
  answers: AnswerMap;
  /**
   * 'menu'      → root action cards
   * 'input'     → current flow step input
   * 'end'       → wrap-up chips
   * 'qlog'      → quick-log free text
   * 'qlogPick'  → quick-log ambiguity chips
   * 'qlogNone'  → quick-log no-match chips
   */
  mode: 'menu' | 'input' | 'end' | 'qlog' | 'qlogPick' | 'qlogNone';
};

let msgId = 0;
const nextId = () => `m${++msgId}`;

const QLOG_INPUT = {
  kind: 'text',
  placeholder: 'e.g. done meditate · 500 ml',
} as const;

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
  const [qlog, setQlog] = useState<{
    amount: number | null;
    candidates: string[];
  } | null>(null);
  const scrollRef = useRef<ScrollHandle | null>(null);

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

  /* ------------------------------ quick log ------------------------------ */

  const startQuickLog = () => {
    pushMe('💬 Quick log');
    setChat({ flow: null, step: null, answers: {}, mode: 'qlog' });
    pushBot('What did you do? Try “done meditate” or “500 ml”.');
  };

  const applyQuickLog = async (habitId: string, amount: number | null) => {
    const s = useStore.getState();
    const habit = s.habits.find(h => h.id === habitId);
    if (!habit) {
      setChat(c => ({ ...c, mode: 'end' }));
      pushBot('Hmm, that habit vanished — try again?');
      return;
    }
    const current = s.completions[habitId]?.[todayKey()] ?? 0;
    const next =
      amount != null
        ? Math.min(habit.goal.amount, current + amount)
        : habit.goal.amount;
    s.setCompletion(habitId, next);
    s.setStatus(habitId, null);
    await afterMutation();
    const done = next >= habit.goal.amount;
    const remaining = habit.goal.amount - next;
    setChat(c => ({ ...c, mode: 'end' }));
    pushBot(
      done
        ? `✅ “${habit.name}” complete — streak safe 🔥`
        : `Logged! “${habit.name}” at ${next}/${habit.goal.amount} ${habit.goal.unit} — ${remaining} to go 💪`,
    );
  };

  const handleQuickLogLine = (text: string) => {
    pushMe(text);
    const habits = useStore.getState().habits;
    const result = parseQuickLog(text, habits);
    if (result.kind === 'match') {
      applyQuickLog(result.habitId, result.amount);
      return;
    }
    if (result.kind === 'ambiguous') {
      setQlog({ amount: result.amount, candidates: result.candidates });
      setChat(c => ({ ...c, mode: 'qlogPick' }));
      pushBot('Which one did you mean?');
      return;
    }
    setChat(c => ({ ...c, mode: 'qlogNone' }));
    pushBot('I couldn’t match that to one of your habits.');
  };

  /* ------------------------------- flows -------------------------------- */

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
    let result = answers;
    if (flow.id === 'habit' || flow.id === 'quick') {
      const raw = flow.id === 'habit' ? answers.name : answers.line;
      const parsed = parseQuickAdd(raw ?? '');
      const name = parsed.name || 'New habit';
      const amount = parsed.goal ?? Number(answers.goal ?? '1');
      const kind = (answers.kind as 'build' | 'quit') ?? 'build';
      const withReminder = answers.remind === 'yes' && !!answers.time;
      const reminderOk = withReminder
        ? await scheduleDailyReminder(id, name, answers.time, {
            habitInfo: {
              tracking: amount > 1 ? 'count' : 'check',
              step: 1,
              unit: 'TIMES',
            },
          })
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
      result =
        withReminder && !reminderOk
          ? {
              ...answers,
              parsedName: name,
              remind: 'no',
              reminderFailed: 'yes',
            }
          : { ...answers, parsedName: name };
    } else if (flow.id === 'task') {
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
    } else {
      // reminder -> a check-habit with a scheduled daily notification
      const reminderOk = await scheduleDailyReminder(
        id,
        answers.what,
        answers.time,
        { habitInfo: { tracking: 'check', step: 1, unit: 'TIMES' } },
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
      result = reminderOk ? answers : { ...answers, reminderFailed: 'yes' };
    }
    // Creations shift App Lock conditions, the widget payload, and the
    // recap — run the shared post-write seam.
    await afterMutation();
    return result;
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
    if (chat.mode === 'qlog') {
      handleQuickLogLine(value);
      return;
    }
    answerStep(value);
  };

  const restart = () => {
    pushMe('Add another');
    setChat({ flow: null, step: null, answers: {}, mode: 'menu' });
    pushBot('On it — what’s next?');
  };

  /* ---------------------------- input routing ---------------------------- */

  const renderInput = () => {
    if (typing) {
      return null;
    }
    switch (chat.mode) {
      case 'menu':
        return (
          <MenuCards
            onPick={v =>
              v === 'log' ? startQuickLog() : startFlow(v as Flow['id'])
            }
          />
        );
      case 'end':
        return (
          <ChipRow
            options={[
              { label: '✨ Add another', value: 'again' },
              { label: 'Done', value: 'done' },
            ]}
            onPick={v => (v === 'again' ? restart() : navigation.goBack())}
          />
        );
      case 'qlog':
        return (
          <FlowInput
            input={QLOG_INPUT}
            customTime={false}
            draft={draft}
            onChangeDraft={setDraft}
            onSubmitDraft={submitDraft}
            onAnswer={() => {}}
            onCustomTime={() => {}}
          />
        );
      case 'qlogPick': {
        const habits = useStore.getState().habits;
        return (
          <ChipRow
            options={(qlog?.candidates ?? []).map(id => {
              const h = habits.find(x => x.id === id);
              return {
                label: `${h?.emoji ?? ''} ${h?.name ?? id}`,
                value: id,
              };
            })}
            onPick={id => {
              const h = habits.find(x => x.id === id);
              pushMe(h?.name ?? id);
              applyQuickLog(id, qlog?.amount ?? null);
            }}
          />
        );
      }
      case 'qlogNone':
        return (
          <ChipRow
            options={[
              { label: '🌱 Create it as a habit', value: 'create' },
              { label: '💬 Try again', value: 'retry' },
              { label: 'Done', value: 'done', ghost: true },
            ]}
            onPick={v => {
              if (v === 'create') {
                startFlow('habit');
              } else if (v === 'retry') {
                setChat(c => ({ ...c, mode: 'qlog' }));
                pushBot('Go ahead — name the habit or an amount with a unit.');
              } else {
                navigation.goBack();
              }
            }}
          />
        );
      case 'input': {
        if (!chat.step) {
          return null;
        }
        return (
          <FlowInput
            input={chat.step.input}
            customTime={customTime}
            draft={draft}
            onChangeDraft={setDraft}
            onSubmitDraft={submitDraft}
            onAnswer={(v, label) =>
              answerStep(v, chat.step?.echo?.(v) ?? label)
            }
            onCustomTime={() => setCustomTime(true)}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton
          size={40}
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
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

      <ChatTranscript
        messages={messages}
        typing={typing}
        scrollRef={scrollRef}
      />

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
  inputArea: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
});

export default AssistantScreen;
