/**
 * @format
 *
 * health.ts keeps one contract over two native stores. Each test loads the
 * module fresh with Platform.OS forced, so the Android branch (Health
 * Connect) and the iOS branch (HealthKit) are exercised with only their own
 * library in play.
 */
const mockHealthConnect = {
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
    SDK_AVAILABLE: 3,
  },
  initialize: jest.fn(),
  getSdkStatus: jest.fn(),
  requestPermission: jest.fn(),
  getGrantedPermissions: jest.fn(),
  readRecords: jest.fn(),
  aggregateRecord: jest.fn(),
};
jest.mock('react-native-health-connect', () => mockHealthConnect);

const mockAppleHealthKit = {
  Constants: {
    Permissions: { StepCount: 'StepCount', SleepAnalysis: 'SleepAnalysis' },
  },
  initHealthKit: jest.fn(),
  getSleepSamples: jest.fn(),
  getStepCount: jest.fn(),
};
jest.mock('react-native-health', () => mockAppleHealthKit);

type Health = typeof import('../src/services/health');
type LinkingMock = { openURL: jest.Mock };

/**
 * The library is picked at module load, so every scenario needs its own
 * copy of health.ts. Platform is mutated on the same registry the module
 * will require from, and Linking is returned from that registry too so the
 * assertions see the instance the module calls.
 */
const loadHealth = (
  os: 'ios' | 'android',
): { health: Health; Linking: LinkingMock } => {
  jest.resetModules();
  const rn = require('react-native');
  rn.Platform.OS = os;
  const health: Health = require('../src/services/health');
  return { health, Linking: rn.Linking };
};

const STEPS = { accessType: 'read', recordType: 'Steps' };
const SLEEP = { accessType: 'read', recordType: 'SleepSession' };

const localIso = (
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
): string => new Date(y, m - 1, d, h, min).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('iOS keeps HealthKit', () => {
  test('names the store Apple Health and never loads Health Connect', async () => {
    const { health } = loadHealth('ios');
    expect(health.healthSourceName).toBe('Apple Health');
    expect(health.healthAvailable()).toBe(true);

    mockAppleHealthKit.initHealthKit.mockImplementation(
      (_p: unknown, cb: (err: unknown) => void) => cb(null),
    );
    await expect(health.connectHealth()).resolves.toBe(true);
    expect(mockAppleHealthKit.initHealthKit).toHaveBeenCalledWith(
      { permissions: { read: ['StepCount', 'SleepAnalysis'], write: [] } },
      expect.any(Function),
    );

    mockAppleHealthKit.getStepCount.mockImplementation(
      (_o: unknown, cb: (err: unknown, r: { value: number }) => void) =>
        cb(null, { value: 1234.4 }),
    );
    await expect(health.getTodaySteps()).resolves.toBe(1234);

    mockAppleHealthKit.getSleepSamples.mockImplementation(
      (_o: unknown, cb: (err: unknown, samples: unknown[]) => void) =>
        cb(null, [
          {
            startDate: localIso(2026, 9, 9, 23, 0),
            endDate: localIso(2026, 9, 10, 6, 30),
          },
        ]),
    );
    await expect(health.getLastNightSleep()).resolves.toEqual({
      minutes: 450,
      bedtime: new Date(2026, 8, 9, 23, 0),
      wake: new Date(2026, 8, 10, 6, 30),
    });

    expect(mockHealthConnect.getSdkStatus).not.toHaveBeenCalled();
    expect(mockHealthConnect.initialize).not.toHaveBeenCalled();
    expect(mockHealthConnect.requestPermission).not.toHaveBeenCalled();
    expect(mockHealthConnect.aggregateRecord).not.toHaveBeenCalled();
    expect(mockHealthConnect.readRecords).not.toHaveBeenCalled();
  });

  test('a HealthKit error reads as not connected / no data', async () => {
    const { health } = loadHealth('ios');
    mockAppleHealthKit.initHealthKit.mockImplementation(
      (_p: unknown, cb: (err: unknown) => void) => cb(new Error('denied')),
    );
    await expect(health.connectHealth()).resolves.toBe(false);
    mockAppleHealthKit.getStepCount.mockImplementation(
      (_o: unknown, cb: (err: unknown) => void) => cb(new Error('no auth')),
    );
    await expect(health.getTodaySteps()).resolves.toBeNull();
    mockAppleHealthKit.getSleepSamples.mockImplementation(
      (_o: unknown, cb: (err: unknown, samples: unknown[]) => void) =>
        cb(null, []),
    );
    await expect(health.getLastNightSleep()).resolves.toBeNull();
  });
});

describe('Android uses Health Connect', () => {
  const sdkAvailable = () => {
    mockHealthConnect.getSdkStatus.mockResolvedValue(
      mockHealthConnect.SdkAvailabilityStatus.SDK_AVAILABLE,
    );
    mockHealthConnect.initialize.mockResolvedValue(true);
  };

  test('names the store Health Connect and reports it available', () => {
    const { health } = loadHealth('android');
    expect(health.healthSourceName).toBe('Health Connect');
    expect(health.healthAvailable()).toBe(true);
    expect(mockAppleHealthKit.initHealthKit).not.toHaveBeenCalled();
  });

  test('connect: both read permissions granted resolves true', async () => {
    const { health, Linking } = loadHealth('android');
    sdkAvailable();
    mockHealthConnect.requestPermission.mockResolvedValue([STEPS, SLEEP]);

    await expect(health.connectHealth()).resolves.toBe(true);
    expect(mockHealthConnect.requestPermission).toHaveBeenCalledWith([
      STEPS,
      SLEEP,
    ]);
    expect(mockHealthConnect.getGrantedPermissions).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(mockAppleHealthKit.initHealthKit).not.toHaveBeenCalled();
  });

  test('connect: the dialog denying everything resolves false', async () => {
    const { health } = loadHealth('android');
    sdkAvailable();
    mockHealthConnect.requestPermission.mockResolvedValue([]);
    mockHealthConnect.getGrantedPermissions.mockResolvedValue([]);
    await expect(health.connectHealth()).resolves.toBe(false);
  });

  test('connect: steps alone is not enough', async () => {
    const { health } = loadHealth('android');
    sdkAvailable();
    mockHealthConnect.requestPermission.mockResolvedValue([STEPS]);
    mockHealthConnect.getGrantedPermissions.mockResolvedValue([STEPS]);
    await expect(health.connectHealth()).resolves.toBe(false);
  });

  test('connect: a skipped dialog still counts when access already exists', async () => {
    const { health } = loadHealth('android');
    sdkAvailable();
    mockHealthConnect.requestPermission.mockResolvedValue([]);
    mockHealthConnect.getGrantedPermissions.mockResolvedValue([SLEEP, STEPS]);
    await expect(health.connectHealth()).resolves.toBe(true);
  });

  test('connect: provider missing resolves false without prompting', async () => {
    const { health, Linking } = loadHealth('android');
    mockHealthConnect.getSdkStatus.mockResolvedValue(
      mockHealthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE,
    );
    await expect(health.connectHealth()).resolves.toBe(false);
    expect(mockHealthConnect.initialize).not.toHaveBeenCalled();
    expect(mockHealthConnect.requestPermission).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  test('connect: provider update required opens the Play Store page and resolves false', async () => {
    const { health, Linking } = loadHealth('android');
    mockHealthConnect.getSdkStatus.mockResolvedValue(
      mockHealthConnect.SdkAvailabilityStatus
        .SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED,
    );
    Linking.openURL.mockResolvedValue(undefined);

    await expect(health.connectHealth()).resolves.toBe(false);
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining(
        'market://details?id=com.google.android.apps.healthdata',
      ),
    );
    expect(mockHealthConnect.initialize).not.toHaveBeenCalled();
    expect(mockHealthConnect.requestPermission).not.toHaveBeenCalled();
  });

  test('connect: falls back to the web Play listing when market:// has no handler', async () => {
    const { health, Linking } = loadHealth('android');
    mockHealthConnect.getSdkStatus.mockResolvedValue(
      mockHealthConnect.SdkAvailabilityStatus
        .SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED,
    );
    Linking.openURL
      .mockRejectedValueOnce(new Error('Could not open URL'))
      .mockResolvedValueOnce(undefined);

    await expect(health.connectHealth()).resolves.toBe(false);
    expect(Linking.openURL).toHaveBeenCalledTimes(2);
    expect(Linking.openURL).toHaveBeenLastCalledWith(
      'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata',
    );
  });

  test('connect: a rejected permission request resolves false instead of throwing', async () => {
    const { health } = loadHealth('android');
    sdkAvailable();
    mockHealthConnect.requestPermission.mockRejectedValue(
      new Error('lateinit property requestPermission has not been initialized'),
    );
    await expect(health.connectHealth()).resolves.toBe(false);
  });

  test('steps: aggregates COUNT_TOTAL from local midnight to now', async () => {
    const { health } = loadHealth('android');
    mockHealthConnect.aggregateRecord.mockResolvedValue({
      COUNT_TOTAL: 4321,
      dataOrigins: ['com.example.pedometer'],
    });
    const before = Date.now();
    await expect(health.getTodaySteps()).resolves.toBe(4321);

    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const [request] = mockHealthConnect.aggregateRecord.mock.calls[0];
    expect(request.recordType).toBe('Steps');
    expect(request.timeRangeFilter.operator).toBe('between');
    expect(request.timeRangeFilter.startTime).toBe(midnight.toISOString());
    const end = new Date(request.timeRangeFilter.endTime).getTime();
    expect(end).toBeGreaterThanOrEqual(before);
    expect(end).toBeLessThanOrEqual(Date.now());
    expect(mockAppleHealthKit.getStepCount).not.toHaveBeenCalled();
  });

  test('steps: a failed aggregate (e.g. permission revoked) is null', async () => {
    const { health } = loadHealth('android');
    mockHealthConnect.aggregateRecord.mockRejectedValue(
      new Error('SecurityException'),
    );
    await expect(health.getTodaySteps()).resolves.toBeNull();
  });

  test('sleep: reads SleepSession from 18:00 yesterday and summarizes it', async () => {
    const { health } = loadHealth('android');
    mockHealthConnect.readRecords.mockResolvedValue({
      records: [
        // Out of order on purpose: the store does not promise a sort.
        {
          recordType: 'SleepSession',
          startTime: localIso(2026, 9, 10, 2, 30),
          endTime: localIso(2026, 9, 10, 6, 45),
        },
        {
          recordType: 'SleepSession',
          startTime: localIso(2026, 9, 9, 23, 10),
          endTime: localIso(2026, 9, 10, 2, 0),
        },
      ],
    });

    await expect(health.getLastNightSleep()).resolves.toEqual({
      minutes: 170 + 255,
      bedtime: new Date(2026, 8, 9, 23, 10),
      wake: new Date(2026, 8, 10, 6, 45),
    });

    const expectedStart = new Date();
    expectedStart.setDate(expectedStart.getDate() - 1);
    expectedStart.setHours(18, 0, 0, 0);
    const [recordType, options] = mockHealthConnect.readRecords.mock.calls[0];
    expect(recordType).toBe('SleepSession');
    expect(options.timeRangeFilter.operator).toBe('between');
    expect(options.timeRangeFilter.startTime).toBe(
      expectedStart.toISOString(),
    );
    expect(mockAppleHealthKit.getSleepSamples).not.toHaveBeenCalled();
  });

  test('sleep: no sessions or a failed read is null', async () => {
    const { health } = loadHealth('android');
    mockHealthConnect.readRecords.mockResolvedValue({ records: [] });
    await expect(health.getLastNightSleep()).resolves.toBeNull();
    mockHealthConnect.readRecords.mockRejectedValue(new Error('offline'));
    await expect(health.getLastNightSleep()).resolves.toBeNull();
  });
});

describe('summarizeSleep', () => {
  test('earliest start, latest end, durations summed across a gap', () => {
    const { health } = loadHealth('android');
    const summary = health.summarizeSleep([
      { start: localIso(2026, 9, 10, 3, 0), end: localIso(2026, 9, 10, 7, 0) },
      { start: localIso(2026, 9, 9, 23, 0), end: localIso(2026, 9, 10, 2, 0) },
    ]);
    expect(summary).toEqual({
      minutes: 180 + 240,
      bedtime: new Date(2026, 8, 9, 23, 0),
      wake: new Date(2026, 8, 10, 7, 0),
    });
  });

  test('wake is the latest end even when a later-starting session ends first', () => {
    const { health } = loadHealth('android');
    const summary = health.summarizeSleep([
      { start: localIso(2026, 9, 9, 22, 0), end: localIso(2026, 9, 10, 6, 0) },
      { start: localIso(2026, 9, 9, 23, 0), end: localIso(2026, 9, 10, 1, 0) },
    ]);
    expect(summary?.wake).toEqual(new Date(2026, 8, 10, 6, 0));
    expect(summary?.bedtime).toEqual(new Date(2026, 8, 9, 22, 0));
    expect(summary?.minutes).toBe(480 + 120);
  });

  test('nothing usable is null', () => {
    const { health } = loadHealth('android');
    expect(health.summarizeSleep([])).toBeNull();
    expect(health.summarizeSleep([{ start: 'nope', end: 'nope' }])).toBeNull();
  });
});
