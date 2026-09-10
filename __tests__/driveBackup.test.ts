/**
 * @format
 *
 * Google Drive backup (Android): the JSON export lands in the Drive
 * appDataFolder — created on the first upload, updated in place after —
 * restore runs through parseBackup/applyBackup with the caller's confirm,
 * a 401 refreshes the session once, auto-backup is throttled to 20 h, and
 * an unconfigured build never touches Google or the network.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  AUTO_BACKUP_INTERVAL_MS,
  backupNow,
  configureGoogle,
  DRIVE_AUTO_KEY,
  DRIVE_META_KEY,
  driveBackupConfigured,
  getAccount,
  getRemoteBackupInfo,
  isBackupDue,
  maybeAutoDriveBackup,
  restoreLatest,
  signIn,
} from '../src/services/driveBackup';
import { exportPayload } from '../src/services/backup';
import { useStore } from '../src/store/useStore';

jest.mock('../src/config/google', () => ({
  GOOGLE_WEB_CLIENT_ID: 'test-web-client-id.apps.googleusercontent.com',
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signInSilently: jest.fn(),
    signOut: jest.fn().mockResolvedValue(null),
    hasPreviousSignIn: jest.fn().mockReturnValue(true),
    getCurrentUser: jest.fn().mockReturnValue(null),
    getTokens: jest.fn(),
    clearCachedAccessToken: jest.fn().mockResolvedValue(null),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
  isErrorWithCode: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e,
}));

const config = jest.requireMock('../src/config/google') as {
  GOOGLE_WEB_CLIENT_ID: string;
};
const gsi = (
  jest.requireMock('@react-native-google-signin/google-signin') as {
    GoogleSignin: Record<string, jest.Mock>;
  }
).GoogleSignin;

const ACCOUNT = {
  type: 'success',
  data: { user: { email: 'me@example.com' }, scopes: [], idToken: null },
};

/* ------------------------- a tiny fake Drive -------------------------- */

type Call = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};
type DriveFile = { id: string; modifiedTime: string; content: string };
const drive = {
  files: [] as DriveFile[],
  calls: [] as Call[],
  reject401Once: false,
};

const reply = (status: number, payload: unknown, text?: string) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
  text: async () => text ?? JSON.stringify(payload),
});

const fetchMock = jest.fn(async (url: string, init: RequestInit = {}) => {
  const method = init.method ?? 'GET';
  const headers = (init.headers ?? {}) as Record<string, string>;
  drive.calls.push({ method, url, headers, body: init.body as string });
  if (drive.reject401Once) {
    drive.reject401Once = false;
    return reply(401, { error: { message: 'Invalid Credentials' } });
  }
  if (method === 'GET' && url.includes('/drive/v3/files?')) {
    return reply(200, {
      files: drive.files.map(f => ({
        id: f.id,
        modifiedTime: f.modifiedTime,
        size: String(f.content.length),
      })),
    });
  }
  if (method === 'POST' && url.includes('uploadType=multipart')) {
    const parts = (init.body as string).split(/--slay_backup_boundary(?:--)?/);
    const content = parts[2].split('\r\n\r\n')[1].trim();
    const file = {
      id: `file-${drive.files.length + 1}`,
      modifiedTime: new Date().toISOString(),
      content,
    };
    drive.files.push(file);
    return reply(200, { id: file.id });
  }
  const patch = url.match(
    /\/upload\/drive\/v3\/files\/([^?]+)\?uploadType=media/,
  );
  if (method === 'PATCH' && patch) {
    const file = drive.files.find(f => f.id === patch[1]);
    if (!file) {
      return reply(404, { error: { message: 'File not found' } });
    }
    file.content = init.body as string;
    file.modifiedTime = new Date().toISOString();
    return reply(200, { id: file.id });
  }
  const download = url.match(/\/drive\/v3\/files\/([^?]+)\?alt=media/);
  if (method === 'GET' && download) {
    const file = drive.files.find(f => f.id === download[1]);
    return file
      ? reply(200, null, file.content)
      : reply(404, { error: { message: 'File not found' } });
  }
  return reply(500, { error: { message: `unexpected ${method} ${url}` } });
});

const seedHabit = (id: string) =>
  useStore.getState().addHabit({
    id,
    name: `Habit ${id}`,
    emoji: '☁️',
    type: 'good',
    goal: { amount: 1, unit: 'TIMES' },
    step: 1,
    friendIds: [],
    tracking: 'count',
    kind: 'build',
  });

beforeAll(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});

beforeEach(async () => {
  drive.files = [];
  drive.calls = [];
  drive.reject401Once = false;
  fetchMock.mockClear();
  Object.values(gsi).forEach(fn => fn.mockClear());
  gsi.getCurrentUser.mockReturnValue(null);
  gsi.signInSilently.mockResolvedValue(ACCOUNT);
  gsi.hasPreviousSignIn.mockReturnValue(true);
  gsi.getTokens.mockResolvedValue({ accessToken: 'tok-1', idToken: 'id' });
  await AsyncStorage.clear();
  useStore.getState().reset();
});

test('first upload creates slay-backup.json in appDataFolder, later ones update it', async () => {
  seedHabit('a');
  const meta = await backupNow();

  const create = drive.calls.find(c => c.method === 'POST');
  expect(create?.url).toContain('/upload/drive/v3/files?uploadType=multipart');
  expect(create?.headers['Content-Type']).toMatch(
    /^multipart\/related; boundary=/,
  );
  expect(create?.headers.Authorization).toBe('Bearer tok-1');
  expect(create?.body).toContain(
    JSON.stringify({ name: 'slay-backup.json', parents: ['appDataFolder'] }),
  );
  expect(drive.calls[0].url).toContain('spaces=appDataFolder');
  expect(drive.calls[0].url).toContain(
    encodeURIComponent("name='slay-backup.json'"),
  );
  expect(drive.files).toHaveLength(1);
  expect(JSON.parse(drive.files[0].content).state.habits).toHaveLength(1);

  expect(meta).toEqual({
    lastBackupAt: expect.any(String),
    // the ☁️ habit makes the payload non-ASCII: bytes must be UTF-8, not chars
    bytes: Buffer.byteLength(drive.files[0].content, 'utf8'),
    account: 'me@example.com',
  });
  expect(
    JSON.parse((await AsyncStorage.getItem(DRIVE_META_KEY)) ?? ''),
  ).toEqual(meta);
  expect(gsi.configure).toHaveBeenCalledWith(
    expect.objectContaining({
      webClientId: config.GOOGLE_WEB_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/drive.appdata'],
      offlineAccess: false,
    }),
  );

  // second backup: same file, PATCHed in place
  seedHabit('b');
  drive.calls = [];
  await backupNow();
  expect(drive.calls.some(c => c.method === 'POST')).toBe(false);
  const update = drive.calls.find(c => c.method === 'PATCH');
  expect(update?.url).toBe(
    'https://www.googleapis.com/upload/drive/v3/files/file-1?uploadType=media',
  );
  expect(drive.files).toHaveLength(1);
  expect(JSON.parse(drive.files[0].content).state.habits).toHaveLength(2);

  const info = await getRemoteBackupInfo();
  expect(info).toEqual({
    id: 'file-1',
    modifiedTime: drive.files[0].modifiedTime,
    bytes: drive.files[0].content.length,
  });
});

test('restoreLatest downloads, validates, asks, then replaces the store', async () => {
  seedHabit('keep-me');
  useStore.getState().setZen({ until: '2026-09-10T21:30:00.000Z' });
  const before = exportPayload();
  await backupNow();

  useStore.getState().reset();
  expect(useStore.getState().habits).toHaveLength(0);

  // declined confirm: nothing changes
  const confirmNo = jest.fn().mockResolvedValue(false);
  await expect(restoreLatest({ confirm: confirmNo })).resolves.toEqual({
    ok: false,
    error: 'Restore cancelled.',
    cancelled: true,
  });
  expect(confirmNo).toHaveBeenCalledWith({ version: 3, habits: 1 });
  expect(useStore.getState().habits).toHaveLength(0);

  const confirmYes = jest.fn().mockResolvedValue(true);
  await expect(restoreLatest({ confirm: confirmYes })).resolves.toEqual({
    ok: true,
    habits: 1,
    version: 3,
  });
  const download = drive.calls.find(c => c.url.includes('alt=media'));
  expect(download?.url).toBe(
    'https://www.googleapis.com/drive/v3/files/file-1?alt=media',
  );
  const after = exportPayload();
  expect(after.state.habits).toEqual(before.state.habits);
  expect(after.state.zen).toEqual(before.state.zen);
});

test('restore reports a missing or corrupt remote backup without touching the store', async () => {
  seedHabit('local');
  await expect(restoreLatest()).resolves.toEqual({
    ok: false,
    error: 'No backup on Google Drive yet.',
  });

  drive.files.push({ id: 'file-x', modifiedTime: 'now', content: 'not json' });
  await expect(restoreLatest()).resolves.toEqual({
    ok: false,
    error: 'Not valid JSON.',
  });
  expect(useStore.getState().habits).toHaveLength(1);
});

test('a 401 refreshes the session once and retries with the new token', async () => {
  drive.reject401Once = true;
  gsi.getTokens
    .mockResolvedValueOnce({ accessToken: 'stale', idToken: 'id' })
    .mockResolvedValue({ accessToken: 'fresh', idToken: 'id' });

  await backupNow();

  expect(gsi.clearCachedAccessToken).toHaveBeenCalledWith('stale');
  expect(gsi.signInSilently).toHaveBeenCalled();
  const listCalls = drive.calls.filter(
    c => c.method === 'GET' && c.url.includes('/drive/v3/files?'),
  );
  expect(listCalls.map(c => c.headers.Authorization)).toEqual([
    'Bearer stale',
    'Bearer fresh',
  ]);
  expect(drive.files).toHaveLength(1);
});

test('a persistent 401 surfaces as a readable error, not a loop', async () => {
  gsi.signInSilently.mockResolvedValueOnce(ACCOUNT).mockResolvedValue({
    type: 'noSavedCredentialFound',
    data: null,
  });
  drive.reject401Once = true;
  await expect(backupNow()).rejects.toThrow(/session expired/);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('auto-backup runs only when signed in, switched on and 20 h+ stale', async () => {
  seedHabit('x');
  const now = Date.now();
  const fresh = {
    lastBackupAt: new Date(now - 60_000).toISOString(),
    bytes: 1,
    account: 'a',
  };
  const stale = {
    lastBackupAt: new Date(now - AUTO_BACKUP_INTERVAL_MS - 1000).toISOString(),
    bytes: 1,
    account: 'a',
  };
  expect(isBackupDue(null, now)).toBe(true);
  expect(isBackupDue(fresh, now)).toBe(false);
  expect(isBackupDue(stale, now)).toBe(true);

  // fresh meta → throttled, no network
  await AsyncStorage.setItem(DRIVE_META_KEY, JSON.stringify(fresh));
  await expect(maybeAutoDriveBackup()).resolves.toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();

  // stale meta → uploads and re-stamps
  await AsyncStorage.setItem(DRIVE_META_KEY, JSON.stringify(stale));
  await expect(maybeAutoDriveBackup()).resolves.toBe(true);
  expect(drive.files).toHaveLength(1);
  const stamped = JSON.parse(
    (await AsyncStorage.getItem(DRIVE_META_KEY)) ?? '',
  );
  expect(Date.parse(stamped.lastBackupAt)).toBeGreaterThanOrEqual(now);

  // switch off → nothing, even when stale
  await AsyncStorage.setItem(DRIVE_META_KEY, JSON.stringify(stale));
  await AsyncStorage.setItem(DRIVE_AUTO_KEY, 'false');
  fetchMock.mockClear();
  await expect(maybeAutoDriveBackup()).resolves.toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();

  // never signed in on this install → nothing
  await AsyncStorage.setItem(DRIVE_AUTO_KEY, 'true');
  gsi.hasPreviousSignIn.mockReturnValue(false);
  await expect(maybeAutoDriveBackup()).resolves.toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();

  // upload failure is swallowed
  gsi.hasPreviousSignIn.mockReturnValue(true);
  gsi.getTokens.mockRejectedValue(
    new Error('getTokens requires a user to be signed in'),
  );
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await expect(maybeAutoDriveBackup()).resolves.toBe(false);
  warn.mockRestore();
});

test('sign-in maps Play Services and cancellation to outcomes', async () => {
  gsi.signIn.mockResolvedValue(ACCOUNT);
  await expect(signIn()).resolves.toEqual({
    ok: true,
    email: 'me@example.com',
  });

  gsi.signIn.mockResolvedValue({ type: 'cancelled', data: null });
  await expect(signIn()).resolves.toMatchObject({
    ok: false,
    reason: 'cancelled',
  });

  gsi.hasPlayServices.mockRejectedValueOnce(
    Object.assign(new Error('nope'), { code: 'PLAY_SERVICES_NOT_AVAILABLE' }),
  );
  await expect(signIn()).resolves.toMatchObject({
    ok: false,
    reason: 'playServices',
  });

  gsi.signIn.mockRejectedValue(
    Object.assign(new Error('DEVELOPER_ERROR'), { code: '10' }),
  );
  const dev = await signIn();
  expect(dev).toMatchObject({ ok: false, reason: 'error' });
  expect(dev.ok ? '' : dev.error).toContain('SHA-1');
});

test('an unconfigured build never touches Google or the network', async () => {
  const id = config.GOOGLE_WEB_CLIENT_ID;
  config.GOOGLE_WEB_CLIENT_ID = '';
  try {
    expect(driveBackupConfigured()).toBe(false);
    expect(configureGoogle()).toBe(false);
    await expect(getAccount()).resolves.toBeNull();
    await expect(getRemoteBackupInfo()).resolves.toBeNull();
    await expect(maybeAutoDriveBackup()).resolves.toBe(false);
    await expect(backupNow()).rejects.toThrow(/not configured/);
    await expect(restoreLatest()).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/not configured/),
    });
    await expect(signIn()).resolves.toMatchObject({
      ok: false,
      reason: 'error',
    });
    expect(gsi.configure).not.toHaveBeenCalled();
    expect(gsi.signInSilently).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  } finally {
    config.GOOGLE_WEB_CLIENT_ID = id;
  }
});
