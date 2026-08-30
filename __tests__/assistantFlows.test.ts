/**
 * @format
 */
import { advance, FLOWS } from '../src/data/assistantFlows';

test('habit flow walks every step and branches on reminder=yes', () => {
  const flow = FLOWS.habit;
  let state: {
    answers: Record<string, string>;
    nextStep: { id: string } | null;
  } = { answers: {}, nextStep: flow.steps[flow.start] };

  state = advance(flow, 'name', 'Meditate every morning x2', state.answers);
  expect(state.nextStep?.id).toBe('emoji');
  state = advance(flow, 'emoji', '🧘', state.answers);
  expect(state.nextStep?.id).toBe('goal');
  state = advance(flow, 'goal', '2', state.answers);
  expect(state.nextStep?.id).toBe('kind');
  state = advance(flow, 'kind', 'build', state.answers);
  expect(state.nextStep?.id).toBe('remind');
  state = advance(flow, 'remind', 'yes', state.answers);
  expect(state.nextStep?.id).toBe('time');
  state = advance(flow, 'time', '09:00', state.answers);
  expect(state.nextStep).toBeNull();

  expect(state.answers).toMatchObject({
    name: 'Meditate every morning x2',
    emoji: '🧘',
    goal: '2',
    kind: 'build',
    remind: 'yes',
    time: '09:00',
  });
  expect(flow.summary(state.answers)).toContain('09:00');
});

test('habit flow ends immediately when reminder is declined', () => {
  const flow = FLOWS.habit;
  const answers: Record<string, string> = {
    name: 'Read',
    emoji: '📖',
    goal: '1',
    kind: 'build',
  };
  const state = advance(flow, 'remind', 'no', answers);
  expect(state.nextStep).toBeNull();
  expect(flow.summary(state.answers)).not.toContain('reminder');
});

test('task flow only asks for a window when blocking time', () => {
  const flow = FLOWS.task;
  let state = advance(flow, 'title', 'Mock interview', {});
  expect(state.nextStep?.id).toBe('when');
  state = advance(flow, 'when', 'today', state.answers);
  expect(state.nextStep?.id).toBe('type');

  const asTask = advance(flow, 'type', 'task', state.answers);
  expect(asTask.nextStep).toBeNull();

  const asBlock = advance(flow, 'type', 'block', state.answers);
  expect(asBlock.nextStep?.id).toBe('time');
});
