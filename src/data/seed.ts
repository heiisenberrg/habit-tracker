/** Seed content mirroring the Routiner Figma designs + Ember v3 feature set. */

export type HabitGoalUnit =
  | 'ML'
  | 'STEPS'
  | 'TIMES'
  | 'MIN'
  | 'PAGES'
  | 'KM'
  | 'SESSIONS';

export type Habit = {
  id: string;
  name: string;
  emoji: string;
  type: 'good' | 'bad';
  goal: { amount: number; unit: HabitGoalUnit };
  /** step added per tap of the + button */
  step: number;
  friendIds: string[];
  /** Ember: 'check' = single daily check-in, 'count' = n per day. Default 'count'. */
  tracking?: 'check' | 'count';
  /** Ember: build a good habit or quit a bad one. Default 'build'. */
  kind?: 'build' | 'quit';
  /** Deterministic seed for the synthesized 83-day history. */
  historySeed?: number;
  /** Historic completion rate 0..1 used to synthesize history. */
  historyRate?: number;
  /** Daily local-notification reminder, e.g. "take a vitamin pill" at 09:00. */
  reminder?: { time: string; enabled: boolean };
  /** Accent color chosen in the habit creator. */
  color?: string;
};

export type PlannerItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  /** "09:30–10:30" or '' for any time */
  time: string;
  type: 'task' | 'block';
  done: boolean;
};

export type Challenge = {
  id: string;
  title: string;
  emoji: string;
  endsAt: string; // ISO datetime
  /** Legacy field kept for persisted stores; no longer rendered. */
  friendsJoined: number;
  /** Legacy pre-join progress kept for persisted stores; no longer rendered. */
  progress: number; // 0..1
  description: string;
  /** Days to complete once joined; drives the member's own progress. */
  durationDays: number;
  /** What the challenge actually asks of you. Optional because stores
   *  persisted before this field existed rehydrate without it. */
  tasks?: string[];
};

export const MOOD_FACES = ['😡', '🙁', '😐', '🙂', '😍'] as const;

export const seedHabits: Habit[] = [
  {
    id: 'water',
    name: 'Drink the water',
    emoji: '💧',
    type: 'good',
    goal: { amount: 2000, unit: 'ML' },
    step: 500,
    friendIds: [],
    tracking: 'count',
    historySeed: 7,
    historyRate: 0.9,
  },
  {
    id: 'walk',
    name: 'Walk',
    emoji: '🚶‍♂️',
    type: 'good',
    goal: { amount: 10000, unit: 'STEPS' },
    step: 2500,
    friendIds: [],
    tracking: 'count',
    historySeed: 11,
    historyRate: 0.68,
  },
  {
    id: 'plants',
    name: 'Water Plants',
    emoji: '🌿',
    type: 'good',
    goal: { amount: 1, unit: 'TIMES' },
    step: 1,
    friendIds: [],
    tracking: 'check',
    historySeed: 5,
    historyRate: 0.55,
  },
  {
    id: 'meditate',
    name: 'Meditate',
    emoji: '🧘🏻‍♂️',
    type: 'good',
    goal: { amount: 30, unit: 'MIN' },
    step: 10,
    friendIds: [],
    tracking: 'count',
    historySeed: 9,
    historyRate: 0.82,
  },
];

export const seedChallenges: Challenge[] = [
  {
    id: 'runners',
    title: 'Best Runners! 🏃🏻',
    emoji: '🏃🏻',
    endsAt: new Date(Date.now() + (5 * 24 + 13) * 3600 * 1000).toISOString(),
    friendsJoined: 0,
    progress: 0,
    description:
      'Run every day this week. Distance counts, consistency wins — beat your own best.',
    durationDays: 7,
    tasks: [
      'Run at least 2 km every day',
      'Log your run before midnight',
      'Beat your own weekly distance',
    ],
  },
  {
    id: 'bikers',
    title: 'Best Bikers! 🚴',
    emoji: '🚴',
    endsAt: new Date(Date.now() + (2 * 24 + 11) * 3600 * 1000).toISOString(),
    friendsJoined: 0,
    progress: 0,
    description:
      'Ride every day this week — distance counts, consistency wins.',
    durationDays: 7,
    tasks: [
      'Ride every day this week',
      'At least 5 km per ride',
      'End the week at 35 km total',
    ],
  },
];

/** Popular habit suggestions shown in the New Good Habit sheet / Explore. */
export const popularHabits = [
  { name: 'Walk', emoji: '🚶🏻', detail: '10km', tint: '#FCDDEC' },
  { name: 'Swim', emoji: '🏊🏻', detail: '30 min', tint: '#DDF2FC' },
  { name: 'Read', emoji: '📚', detail: '10 min', tint: '#FCEED4' },
] as const;

export const clubs = [
  { emoji: '🧑‍💻', name: 'Code Daily' },
  { emoji: '🏃', name: 'Runners' },
  { emoji: '😻', name: 'Cat Lovers' },
  { emoji: '🌃', name: 'Night Owls' },
] as const;

export const learningArticles = [
  {
    emoji: '💧',
    title: 'Why should we drink water often?',
    body:
      'Your body loses water all day through breathing, sweating and digestion, ' +
      'and even mild dehydration shows up as fatigue, headaches and poor focus. ' +
      'Sipping regularly beats gulping occasionally: small, frequent amounts are ' +
      'easier to absorb and keep your energy steady. A simple habit — a glass ' +
      'when you wake up, one with every meal, and one mid-afternoon — covers ' +
      'most of your daily needs without any counting.',
  },
  {
    emoji: '🚶',
    title: 'Benefits of regular walking',
    body:
      'Walking is the most underrated workout there is. A brisk 30-minute walk ' +
      'improves cardiovascular fitness, steadies blood sugar and lifts your mood ' +
      'through gentle, repeatable effort. Because it is low impact, you can do ' +
      'it every single day — and consistency, not intensity, is what builds a ' +
      'habit. Start with a short loop after one daily anchor (lunch works well) ' +
      'and let the distance grow on its own.',
  },
] as const;

/**
 * Deterministic 83-day completion history (1 = habit fully done that day),
 * index 0 = 83 days ago, index 82 = yesterday. Same LCG as the Ember prototype
 * so charts/streaks look alive without a backend.
 */
export function generateHistory(seed: number, rate: number): number[] {
  const h: number[] = [];
  let x = seed * 7919 + 13;
  for (let i = 0; i < 83; i++) {
    x = (x * 9301 + 49297) % 233280;
    h.push(x / 233280 < rate ? 1 : 0);
  }
  return h;
}

export const seedPlanner = (
  todayKey: string,
  tomorrowKey: string,
): PlannerItem[] => [
  {
    id: 't1',
    date: todayKey,
    title: 'Team standup',
    time: '09:30–10:00',
    type: 'block',
    done: false,
  },
  {
    id: 't2',
    date: todayKey,
    title: 'Review PR feedback',
    time: '',
    type: 'task',
    done: false,
  },
  {
    id: 't3',
    date: tomorrowKey,
    title: 'Mock interview',
    time: '18:00–19:00',
    type: 'block',
    done: false,
  },
  {
    id: 't4',
    date: tomorrowKey,
    title: 'Update resume',
    time: '',
    type: 'task',
    done: false,
  },
];
