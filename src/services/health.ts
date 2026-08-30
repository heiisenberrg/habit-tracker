/**
 * Step-count integration. iOS: HealthKit via react-native-health.
 * Android: Google Fit hook-point (react-native-google-fit) — not wired yet;
 * getTodaySteps resolves null there so callers degrade gracefully.
 */
import { Platform } from 'react-native';

let AppleHealthKit: any = null;
if (Platform.OS === 'ios') {
  try {
    const mod = require('react-native-health');
    AppleHealthKit = mod.default ?? mod;
  } catch {
    AppleHealthKit = null;
  }
}

export const healthAvailable = (): boolean =>
  Platform.OS === 'ios' && typeof AppleHealthKit?.initHealthKit === 'function';

/** Ask for read access to step count. Resolves true when granted/initialized. */
export const connectHealth = (): Promise<boolean> =>
  new Promise(resolve => {
    if (!healthAvailable()) {
      resolve(false);
      return;
    }
    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.StepCount,
          AppleHealthKit.Constants.Permissions.SleepAnalysis,
        ],
        write: [],
      },
    };
    AppleHealthKit.initHealthKit(permissions, (err: unknown) => resolve(!err));
  });

export type SleepSummary = {
  /** total minutes asleep/in bed last night */
  minutes: number;
  /** bedtime — your last put-down of the previous day */
  bedtime: Date;
  /** wake time — your first pick-up today */
  wake: Date;
};

/**
 * Last night's sleep from HealthKit sleepAnalysis samples (6pm yesterday →
 * now). Bedtime ≈ last phone put-down yesterday; wake ≈ first pickup today.
 */
export const getLastNightSleep = (): Promise<SleepSummary | null> =>
  new Promise(resolve => {
    if (!healthAvailable()) {
      resolve(null);
      return;
    }
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
    AppleHealthKit.getSleepSamples(
      {
        startDate: start.toISOString(),
        endDate: new Date().toISOString(),
        limit: 50,
      },
      (err: unknown, samples: { startDate: string; endDate: string }[]) => {
        if (err || !samples?.length) {
          resolve(null);
          return;
        }
        const sorted = [...samples].sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
        );
        const bedtime = new Date(sorted[0].startDate);
        const wake = new Date(sorted[sorted.length - 1].endDate);
        const minutes = sorted.reduce(
          (a, sample) =>
            a +
            (new Date(sample.endDate).getTime() -
              new Date(sample.startDate).getTime()) /
              60000,
          0,
        );
        resolve({ minutes: Math.round(minutes), bedtime, wake });
      },
    );
  });

/** Today's step count, or null when unavailable/not authorized. */
export const getTodaySteps = (): Promise<number | null> =>
  new Promise(resolve => {
    if (!healthAvailable()) {
      resolve(null);
      return;
    }
    AppleHealthKit.getStepCount(
      { date: new Date().toISOString(), includeManuallyAdded: true },
      (err: unknown, result: { value?: number } | undefined) => {
        resolve(err ? null : Math.round(result?.value ?? 0));
      },
    );
  });
