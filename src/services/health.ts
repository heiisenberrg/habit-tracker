/**
 * Steps and sleep from the phone's health store, behind one contract.
 * iOS: HealthKit via react-native-health. Android: Health Connect via
 * react-native-health-connect. Each library is required lazily inside its
 * own Platform branch so jest and the other platform never touch native
 * code; a missing library just reads as "unavailable" and callers fall back
 * to manual logging.
 */
import type { Permission } from 'react-native-health-connect';
import { Linking, Platform } from 'react-native';

/** What to call the store in labels and alerts. */
export const healthSourceName =
  Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';

type HealthConnectModule = typeof import('react-native-health-connect');

let AppleHealthKit: any = null;
let HealthConnect: HealthConnectModule | null = null;
if (Platform.OS === 'ios') {
  try {
    const mod = require('react-native-health');
    AppleHealthKit = mod.default ?? mod;
  } catch {
    AppleHealthKit = null;
  }
} else if (Platform.OS === 'android') {
  try {
    HealthConnect = require('react-native-health-connect');
  } catch {
    HealthConnect = null;
  }
}

export const healthAvailable = (): boolean =>
  Platform.OS === 'ios'
    ? typeof AppleHealthKit?.initHealthKit === 'function'
    : typeof HealthConnect?.initialize === 'function';

export type SleepSummary = {
  /** total minutes asleep/in bed last night */
  minutes: number;
  /** bedtime — your last put-down of the previous day */
  bedtime: Date;
  /** wake time — your first pick-up today */
  wake: Date;
};

/** One slept interval, whichever store it came from. */
type SleepInterval = { start: string; end: string };

/**
 * Bedtime = earliest start, wake = latest end, minutes = every interval's
 * length added up — so a stretch awake between two sessions is not counted
 * as sleep, whatever order the store hands the sessions back in.
 */
export const summarizeSleep = (
  intervals: SleepInterval[],
): SleepSummary | null => {
  let bedtime = Infinity;
  let wake = -Infinity;
  let ms = 0;
  for (const { start, end } of intervals) {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) {
      continue;
    }
    bedtime = Math.min(bedtime, s);
    wake = Math.max(wake, e);
    ms += Math.max(0, e - s);
  }
  if (!Number.isFinite(bedtime)) {
    return null;
  }
  return {
    minutes: Math.round(ms / 60000),
    bedtime: new Date(bedtime),
    wake: new Date(wake),
  };
};

/** 18:00 yesterday, local time: the earliest "last night" can start. */
const lastNightStart = (): Date => {
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  return start;
};

// ---------------------------------------------------------------- iOS ----

const connectHealthKit = (): Promise<boolean> =>
  new Promise(resolve => {
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

const healthKitSleep = (): Promise<SleepSummary | null> =>
  new Promise(resolve => {
    AppleHealthKit.getSleepSamples(
      {
        startDate: lastNightStart().toISOString(),
        endDate: new Date().toISOString(),
        limit: 50,
      },
      (err: unknown, samples: { startDate: string; endDate: string }[]) => {
        if (err || !samples?.length) {
          resolve(null);
          return;
        }
        resolve(
          summarizeSleep(
            samples.map(s => ({ start: s.startDate, end: s.endDate })),
          ),
        );
      },
    );
  });

const healthKitSteps = (): Promise<number | null> =>
  new Promise(resolve => {
    AppleHealthKit.getStepCount(
      { date: new Date().toISOString(), includeManuallyAdded: true },
      (err: unknown, result: { value?: number } | undefined) => {
        resolve(err ? null : Math.round(result?.value ?? 0));
      },
    );
  });

// ------------------------------------------------------------ Android ----

const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

const HEALTH_CONNECT_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'SleepSession' },
];

const hasAllPermissions = (
  granted: { accessType: string; recordType: string }[],
): boolean =>
  HEALTH_CONNECT_PERMISSIONS.every(need =>
    granted.some(
      p => p.accessType === need.accessType && p.recordType === need.recordType,
    ),
  );

/**
 * Health Connect is a separate app on Android 13 and below; when it is
 * missing or stale only the Play Store can fix it, so send the user there.
 * The onboarding deep link makes the Store open straight on Health Connect.
 */
const openHealthConnectStorePage = async (): Promise<void> => {
  const id = `id=${HEALTH_CONNECT_PACKAGE}`;
  try {
    await Linking.openURL(
      `market://details?${id}&url=healthconnect%3A%2F%2Fonboarding`,
    );
  } catch {
    // No Play Store app to take market:// — the web listing still works.
    await Linking.openURL(
      `https://play.google.com/store/apps/details?${id}`,
    ).catch(() => {});
  }
};

const connectHealthConnect = async (
  hc: HealthConnectModule,
): Promise<boolean> => {
  try {
    // Status before initialize(): the client refuses to be created on a
    // device without a usable provider, which would hide the
    // "update required" case behind a generic failure.
    const status = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      return false;
    }
    if (
      status ===
      hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
    ) {
      await openHealthConnectStorePage();
      return false;
    }
    if (!(await hc.initialize())) {
      return false;
    }
    // The dialog result is what the user just chose; the granted set also
    // covers a sheet the system skipped because access already existed.
    const fromDialog = await hc.requestPermission(HEALTH_CONNECT_PERMISSIONS);
    if (hasAllPermissions(fromDialog)) {
      return true;
    }
    return hasAllPermissions(await hc.getGrantedPermissions());
  } catch {
    // Also lands here when MainActivity has not registered the library's
    // permission delegate — better "not connected" than a red box.
    return false;
  }
};

const healthConnectSleep = async (
  hc: HealthConnectModule,
): Promise<SleepSummary | null> => {
  try {
    const { records } = await hc.readRecords('SleepSession', {
      timeRangeFilter: {
        operator: 'between',
        startTime: lastNightStart().toISOString(),
        endTime: new Date().toISOString(),
      },
    });
    return summarizeSleep(
      (records ?? []).map(r => ({ start: r.startTime, end: r.endTime })),
    );
  } catch {
    return null;
  }
};

const healthConnectSteps = async (
  hc: HealthConnectModule,
): Promise<number | null> => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  try {
    const result = await hc.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: new Date().toISOString(),
      },
    });
    return Math.round(result?.COUNT_TOTAL ?? 0);
  } catch {
    return null;
  }
};

// ------------------------------------------------------------- Public ----

/** Ask for read access to steps + sleep. Resolves true when granted. */
export const connectHealth = (): Promise<boolean> => {
  if (!healthAvailable()) {
    return Promise.resolve(false);
  }
  return HealthConnect
    ? connectHealthConnect(HealthConnect)
    : connectHealthKit();
};

/**
 * Last night's sleep (6pm yesterday → now). Bedtime ≈ last phone put-down
 * yesterday; wake ≈ first pickup today.
 */
export const getLastNightSleep = (): Promise<SleepSummary | null> => {
  if (!healthAvailable()) {
    return Promise.resolve(null);
  }
  return HealthConnect ? healthConnectSleep(HealthConnect) : healthKitSleep();
};

/** Today's step count, or null when unavailable/not authorized. */
export const getTodaySteps = (): Promise<number | null> => {
  if (!healthAvailable()) {
    return Promise.resolve(null);
  }
  return HealthConnect ? healthConnectSteps(HealthConnect) : healthKitSteps();
};
