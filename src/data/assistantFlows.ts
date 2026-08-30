/**
 * Routiner Assistant — scripted conversational flows. No LLM: every bot turn
 * is a predefined question; answers come from quick-reply chips or short text.
 * A pure state machine so the chat UI stays dumb and the logic stays testable.
 */

export type AnswerMap = Record<string, string>;

export type StepInput =
  | { kind: 'chips'; options: { label: string; value: string }[] }
  | { kind: 'text'; placeholder: string }
  | { kind: 'emoji'; options: string[] }
  | { kind: 'time'; options: string[] };

export type FlowStep = {
  id: string;
  /** What the assistant says for this step. */
  bot: (answers: AnswerMap) => string;
  input: StepInput;
  /** Next step id, or null when the flow is complete. */
  next: (answers: AnswerMap) => string | null;
  /** Optional echo override for the user bubble (defaults to raw answer). */
  echo?: (value: string) => string;
};

export type Flow = {
  id: 'habit' | 'task' | 'reminder' | 'quick';
  start: string;
  steps: Record<string, FlowStep>;
  /** Summary the assistant confirms with once complete. */
  summary: (answers: AnswerMap) => string;
};

export const EMOJI_OPTIONS = [
  '🏃🏻',
  '💧',
  '📖',
  '🧘',
  '💻',
  '📓',
  '🌱',
  '😴',
  '💊',
];
export const TIME_OPTIONS = ['07:00', '09:00', '12:30', '18:00', '21:00'];

const habitFlow: Flow = {
  id: 'habit',
  start: 'name',
  steps: {
    name: {
      id: 'name',
      bot: () =>
        'Love it — a new habit! What should we call it? Tip: you can type things like “Meditate every morning x2” and I’ll pick up the details.',
      input: { kind: 'text', placeholder: 'e.g. Meditate every morning x2' },
      next: () => 'emoji',
    },
    emoji: {
      id: 'emoji',
      bot: a => `“${a.name}” it is. Pick an icon for it:`,
      input: { kind: 'emoji', options: EMOJI_OPTIONS },
      next: () => 'goal',
    },
    goal: {
      id: 'goal',
      bot: () => 'How many times per day?',
      input: {
        kind: 'chips',
        options: [
          { label: 'Once a day', value: '1' },
          { label: '2 times', value: '2' },
          { label: '3 times', value: '3' },
          { label: '5 times', value: '5' },
        ],
      },
      echo: v => (v === '1' ? 'Once a day' : `${v} times a day`),
      next: () => 'kind',
    },
    kind: {
      id: 'kind',
      bot: () => 'Are we building this habit, or quitting a bad one?',
      input: {
        kind: 'chips',
        options: [
          { label: '🌱 Build it', value: 'build' },
          { label: '🛡 Quit it', value: 'quit' },
        ],
      },
      next: () => 'remind',
    },
    remind: {
      id: 'remind',
      bot: () => 'Want a daily reminder so the streak never slips?',
      input: {
        kind: 'chips',
        options: [
          { label: 'Yes, remind me', value: 'yes' },
          { label: 'No thanks', value: 'no' },
        ],
      },
      next: a => (a.remind === 'yes' ? 'time' : null),
    },
    time: {
      id: 'time',
      bot: () => 'What time should I nudge you?',
      input: { kind: 'time', options: TIME_OPTIONS },
      next: () => null,
    },
  },
  summary: a =>
    `Done! “${a.name}” is on your board — ${
      a.goal === '1' ? 'once a day' : `${a.goal}× a day`
    }${
      a.remind === 'yes' ? `, reminder at ${a.time}` : ''
    }. Let’s make it a streak 🔥`,
};

const taskFlow: Flow = {
  id: 'task',
  start: 'title',
  steps: {
    title: {
      id: 'title',
      bot: () => 'Sure — what needs doing?',
      input: { kind: 'text', placeholder: 'e.g. Update resume' },
      next: () => 'when',
    },
    when: {
      id: 'when',
      bot: a => `Got it: “${a.title}”. When is it for?`,
      input: {
        kind: 'chips',
        options: [
          { label: 'Today', value: 'today' },
          { label: 'Tomorrow', value: 'tomorrow' },
        ],
      },
      next: () => 'type',
    },
    type: {
      id: 'type',
      bot: () =>
        'Is this a task to tick off, or should I block the time in your day?',
      input: {
        kind: 'chips',
        options: [
          { label: '✅ Task', value: 'task' },
          { label: '🕐 Time block', value: 'block' },
        ],
      },
      next: a => (a.type === 'block' ? 'time' : null),
    },
    time: {
      id: 'time',
      bot: () =>
        'Which time window? (You can refine it later in the calendar.)',
      input: {
        kind: 'chips',
        options: [
          { label: '09:00–10:00', value: '09:00–10:00' },
          { label: '12:00–13:00', value: '12:00–13:00' },
          { label: '15:00–16:00', value: '15:00–16:00' },
          { label: '18:00–19:00', value: '18:00–19:00' },
        ],
      },
      next: () => null,
    },
  },
  summary: a =>
    a.type === 'block'
      ? `Blocked: “${a.title}” ${a.when} at ${a.time}. Nothing gets scheduled over it.`
      : `Added “${a.title}” to ${
          a.when === 'today' ? 'today’s' : 'tomorrow’s'
        } tasks. It counts toward your perfect day ⚡`,
};

const reminderFlow: Flow = {
  id: 'reminder',
  start: 'what',
  steps: {
    what: {
      id: 'what',
      bot: () =>
        'Happy to remind you. What is it? (e.g. “Take a vitamin pill”)',
      input: { kind: 'text', placeholder: 'e.g. Take a vitamin pill' },
      next: () => 'time',
    },
    time: {
      id: 'time',
      bot: a => `“${a.what}” — at what time every day?`,
      input: { kind: 'time', options: TIME_OPTIONS },
      next: () => null,
    },
  },
  summary: a =>
    `Set! I’ll ping you about “${a.what}” at ${a.time} every day, and we’ll track the streak on it 💪`,
};

const quickFlow: Flow = {
  id: 'quick',
  start: 'line',
  steps: {
    line: {
      id: 'line',
      bot: () =>
        'One-liner mode 🚀 Type it like you’d say it — “Read x2 every night”, and I’ll set the habit up from that.',
      input: { kind: 'text', placeholder: 'e.g. Read x2 every night' },
      next: () => null,
    },
  },
  summary: a =>
    `Boom — “${a.parsedName ?? a.line}” created from one line. Anything else?`,
};

export const FLOWS: Record<Flow['id'], Flow> = {
  habit: habitFlow,
  task: taskFlow,
  reminder: reminderFlow,
  quick: quickFlow,
};

export const ROOT_MENU = {
  bot: 'Hey! I’m your Routiner assistant ✨ Creating things by hand is boring — tell me what to set up:',
  options: [
    { label: '🌱 New habit', value: 'habit' },
    { label: '✅ Task / time block', value: 'task' },
    { label: '⏰ Daily reminder', value: 'reminder' },
    { label: '🚀 Quick add (one line)', value: 'quick' },
  ] as { label: string; value: Flow['id'] }[],
};

/**
 * Advance a flow: record the answer for the current step and return what the
 * chat should do next. Pure — no side effects.
 */
export const advance = (
  flow: Flow,
  stepId: string,
  value: string,
  answers: AnswerMap,
): { answers: AnswerMap; nextStep: FlowStep | null } => {
  const step = flow.steps[stepId];
  const nextAnswers = { ...answers, [step.id]: value };
  const nextId = step.next(nextAnswers);
  return {
    answers: nextAnswers,
    nextStep: nextId ? flow.steps[nextId] : null,
  };
};
