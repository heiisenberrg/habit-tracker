/**
 * @format
 *
 * D7 quick-log intent parser: fuzzy name match, unit fallback, ambiguity
 * surfaced (never guessed), hostile inputs → 'none'.
 */
import { parseQuickLog, QuickLogHabit } from '../src/data/assistantFlows';

const habits: QuickLogHabit[] = [
  { id: 'water', name: 'Drink the water', goal: { unit: 'ML' } },
  { id: 'walk', name: 'Walk', goal: { unit: 'STEPS' } },
  { id: 'meditate', name: 'Meditate', goal: { unit: 'MIN' } },
  { id: 'read', name: 'Read books', goal: { unit: 'MIN' } },
];

test('"done meditate" matches by name, no amount', () => {
  expect(parseQuickLog('done meditate', habits)).toEqual({
    kind: 'match',
    habitId: 'meditate',
    amount: null,
  });
});

test('"500 ml" matches the only ML habit via unit fallback', () => {
  expect(parseQuickLog('500 ml', habits)).toEqual({
    kind: 'match',
    habitId: 'water',
    amount: 500,
  });
});

test('"log 20 min reading" — name beats the ambiguous MIN unit', () => {
  expect(parseQuickLog('log 20 min reading', habits)).toEqual({
    kind: 'match',
    habitId: 'read',
    amount: 20,
  });
});

test('typed prefix matches a longer name token ("did 10 medit")', () => {
  expect(parseQuickLog('did 10 medit', habits)).toEqual({
    kind: 'match',
    habitId: 'meditate',
    amount: 10,
  });
});

test('inflected form matches a shorter name token ("walked")', () => {
  expect(parseQuickLog('walked', habits)).toEqual({
    kind: 'match',
    habitId: 'walk',
    amount: null,
  });
});

test('shared unit with no name is ambiguous — never guessed', () => {
  const r = parseQuickLog('15 min', habits);
  expect(r.kind).toBe('ambiguous');
  if (r.kind === 'ambiguous') {
    expect([...r.candidates].sort()).toEqual(['meditate', 'read']);
    expect(r.amount).toBe(15);
  }
});

test('hostile inputs return none', () => {
  expect(parseQuickLog('', habits).kind).toBe('none');
  expect(parseQuickLog('   ', habits).kind).toBe('none');
  expect(parseQuickLog('🔥🔥🔥', habits).kind).toBe('none');
  expect(parseQuickLog('x'.repeat(300), habits).kind).toBe('none');
  expect(parseQuickLog('done meditate', []).kind).toBe('none');
  expect(parseQuickLog('12345', habits).kind).toBe('none');
});

test('intent words never match habit names ("did the log")', () => {
  expect(parseQuickLog('did the log', habits).kind).toBe('none');
});

test('short stray tokens do not fuzzy-match (≥3 guard)', () => {
  // "ml" (2 chars) must not prefix-match anything by name; with no amount
  // there is no unit fallback either.
  expect(parseQuickLog('ml', habits).kind).toBe('none');
});
