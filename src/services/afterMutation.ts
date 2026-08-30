/**
 * Post-write seam (eng OV #7): every non-UI mutation surface — notification
 * actions, quick-log, backup import, background rollover — calls this once
 * after writing, so App Lock, the shared widget payload, and the evening
 * recap can never drift from the store. The React tree's own effects cover
 * the in-app path; this covers everything else.
 */
import { applyAppLock } from './appLock';
import { scheduleRecap } from './recap';
import { pushStreakToWidget } from './widget';
import { useStore } from '../store/useStore';

export const afterMutation = async (): Promise<void> => {
  const s = useStore.getState();
  await applyAppLock(
    s.appLock,
    s.habits,
    s.completions,
    s.statuses,
    s.zen.until,
  );
  pushStreakToWidget({
    habits: s.habits,
    completions: s.completions,
    statuses: s.statuses,
    planner: s.planner,
    histories: s.histories,
    streak: s.streak,
    appLock: s.appLock,
  });
  await scheduleRecap();
};
