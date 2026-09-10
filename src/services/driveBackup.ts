/**
 * Google Drive backup & restore (Android):
 *
 *   store ──exportPayload()──▶ slay-backup.json ──▶ Drive appDataFolder
 *     (the very JSON the Export row shares — one file in the app-private
 *      Drive folder, created once and then updated in place)
 *
 *   restore: list ▸ download ▸ parseBackup ▸ [caller confirms] ▸ applyBackup
 *            (same validate → "Replace your data?" → replace semantics as
 *             the iOS paste import; the caller owns the Alert)
 *
 * Auth is the free @react-native-google-signin/google-signin v16 API with a
 * webClientId and the drive.appdata scope; access tokens come from
 * GoogleSignin.getTokens() and a 401 re-establishes the session silently
 * once before retrying. The native module is required lazily so an
 * unconfigured build (GOOGLE_WEB_CLIENT_ID empty) and jest never load it.
 *
 * Its settings live under their own AsyncStorage keys, never in the store:
 * a restore must not overwrite them and they must not ride along in exports.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID } from '../config/google';
import { applyBackup, exportPayload, parseBackup } from './backup';

type GoogleSigninModule =
  typeof import('@react-native-google-signin/google-signin');

export const DRIVE_META_KEY = 'driveBackup:meta';
export const DRIVE_AUTO_KEY = 'driveBackup:auto';
export const DRIVE_PROMPTED_KEY = 'driveBackup:promptedRestore';
export const DRIVE_FILE_NAME = 'slay-backup.json';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
/** Auto-backup throttle: at most one upload per 20 h, so "daily" survives clock drift. */
export const AUTO_BACKUP_INTERVAL_MS = 20 * 60 * 60 * 1000;

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const BOUNDARY = 'slay_backup_boundary';
const NOT_CONFIGURED =
  'Google Drive backup is not configured (see docs/android-google-drive-setup.md).';

export type DriveBackupMeta = {
  lastBackupAt: string;
  bytes: number;
  account: string;
};

export type RemoteBackupInfo = {
  id: string;
  modifiedTime: string;
  bytes: number;
};

export type SignInResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: 'cancelled' | 'playServices' | 'error';
      error: string;
    };

export type RestoreSummary = { version: number; habits: number };

export type RestoreResult =
  | { ok: true; habits: number; version: number }
  | { ok: false; error: string; cancelled?: boolean };

/* ----------------------------- sign-in ------------------------------ */

let signinModule: GoogleSigninModule | null = null;
const google = (): GoogleSigninModule => {
  if (!signinModule) {
    // Lazy on purpose: unconfigured builds never touch the native module.
    signinModule = require('@react-native-google-signin/google-signin');
  }
  return signinModule as GoogleSigninModule;
};
const gsi = () => google().GoogleSignin;

/** True once a Web client ID is pasted into src/config/google.ts. */
export const driveBackupConfigured = (): boolean =>
  GOOGLE_WEB_CLIENT_ID.trim().length > 0;

let configured = false;
/** Idempotent; returns false (and does nothing) while unconfigured. */
export const configureGoogle = (): boolean => {
  if (!driveBackupConfigured()) {
    return false;
  }
  if (!configured) {
    gsi().configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      scopes: [DRIVE_SCOPE],
      offlineAccess: false,
    });
    configured = true;
  }
  return true;
};

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : String(e);

const PLAY_SERVICES_ERROR =
  'Google Play Services are not available on this device, so Google Drive backup can’t be used.';

/** The classic misconfiguration rejection: SHA-1 / package / client ID mismatch. */
const describeSignInError = (e: unknown): string => {
  const msg = errorMessage(e);
  if (/DEVELOPER_ERROR|\b10\b/.test(msg)) {
    return (
      'Sign-in was refused (DEVELOPER_ERROR). The Firebase Android app needs this build’s ' +
      'package name and SHA-1, and src/config/google.ts needs the Web client ID — ' +
      'see docs/android-google-drive-setup.md.'
    );
  }
  return msg;
};

/** Interactive sign-in; Play Services missing and user cancellation are outcomes, not throws. */
export const signIn = async (): Promise<SignInResult> => {
  if (!configureGoogle()) {
    return { ok: false, reason: 'error', error: NOT_CONFIGURED };
  }
  const { GoogleSignin, statusCodes, isErrorWithCode } = google();
  try {
    // Offers the "update Play Services" dialog itself; rejects when unusable.
    const ok = await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
    if (!ok) {
      return { ok: false, reason: 'playServices', error: PLAY_SERVICES_ERROR };
    }
  } catch {
    return { ok: false, reason: 'playServices', error: PLAY_SERVICES_ERROR };
  }
  try {
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') {
      return {
        ok: false,
        reason: 'cancelled',
        error: 'Sign-in was cancelled.',
      };
    }
    return { ok: true, email: res.data.user.email };
  } catch (e) {
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        return {
          ok: false,
          reason: 'cancelled',
          error: 'Sign-in was cancelled.',
        };
      }
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          ok: false,
          reason: 'playServices',
          error: PLAY_SERVICES_ERROR,
        };
      }
    }
    return { ok: false, reason: 'error', error: describeSignInError(e) };
  }
};

/** Signs out locally; the Drive file stays in the account. Drops the local backup meta. */
export const signOut = async (): Promise<void> => {
  if (!configureGoogle()) {
    return;
  }
  try {
    await gsi().signOut();
  } catch (e) {
    console.warn('[driveBackup] signOut failed:', e);
  }
  await AsyncStorage.removeItem(DRIVE_META_KEY);
};

/**
 * The signed-in email or null. Tries a silent sign-in, which also succeeds on
 * a fresh install when the account already granted Slay — that is what lets
 * the restore prompt find a backup right after a reinstall.
 */
export const getAccount = async (): Promise<string | null> => {
  if (!configureGoogle()) {
    return null;
  }
  const GoogleSignin = gsi();
  const current = GoogleSignin.getCurrentUser();
  if (current) {
    return current.user.email;
  }
  try {
    const res = await GoogleSignin.signInSilently();
    return res.type === 'success' ? res.data.user.email : null;
  } catch {
    return null;
  }
};

/* ------------------------------ Drive ------------------------------- */

const getAccessToken = async (): Promise<string> => {
  const { accessToken } = await gsi().getTokens();
  return accessToken;
};

/** A 401 means the cached token expired or was revoked: drop it, re-establish the session, retry once. */
const refreshSession = async (staleToken: string): Promise<void> => {
  const GoogleSignin = gsi();
  try {
    await GoogleSignin.clearCachedAccessToken(staleToken);
  } catch {
    // best effort — a fresh silent sign-in mints a new token anyway
  }
  const res = await GoogleSignin.signInSilently();
  if (res.type !== 'success') {
    throw new Error('Your Google session expired — sign in again.');
  }
};

const describeHttpError = async (res: Response): Promise<string> => {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body?.error?.message ?? '';
  } catch {
    // non-JSON error body
  }
  return `Google Drive error ${res.status}${detail ? `: ${detail}` : ''}`;
};

const driveFetch = async (
  url: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> => {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401 && retry) {
    await refreshSession(token);
    return driveFetch(url, init, false);
  }
  if (!res.ok) {
    throw new Error(await describeHttpError(res));
  }
  return res;
};

const requireAccount = async (): Promise<string> => {
  if (!driveBackupConfigured()) {
    throw new Error(NOT_CONFIGURED);
  }
  const account = await getAccount();
  if (!account) {
    throw new Error('Sign in with Google first.');
  }
  return account;
};

/** The remote slay-backup.json, or null when the account has none yet. */
export const getRemoteBackupInfo =
  async (): Promise<RemoteBackupInfo | null> => {
    if (!driveBackupConfigured()) {
      return null;
    }
    const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}'`);
    const res = await driveFetch(
      `${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime,size)`,
    );
    const body = (await res.json()) as {
      files?: Array<{ id: string; modifiedTime?: string; size?: string }>;
    };
    const files = body.files ?? [];
    if (files.length === 0) {
      return null;
    }
    // Two devices racing their first upload can leave two files: take the freshest.
    const newest = files.reduce((a, b) =>
      (b.modifiedTime ?? '') > (a.modifiedTime ?? '') ? b : a,
    );
    return {
      id: newest.id,
      modifiedTime: newest.modifiedTime ?? '',
      bytes: Number(newest.size ?? 0),
    };
  };

/** UTF-8 size of the upload — what Drive will report, without TextEncoder. */
const utf8Bytes = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) {
      n += 1;
    } else if (c < 0x800) {
      n += 2;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4; // surrogate pair = one 4-byte code point
      i++;
    } else {
      n += 3;
    }
  }
  return n;
};

const multipartBody = (json: string): string =>
  `--${BOUNDARY}\r\n` +
  'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
  JSON.stringify({ name: DRIVE_FILE_NAME, parents: ['appDataFolder'] }) +
  `\r\n--${BOUNDARY}\r\n` +
  'Content-Type: application/json\r\n\r\n' +
  json +
  `\r\n--${BOUNDARY}--`;

/** Upload the current export: create the file the first time, update it in place after. */
export const backupNow = async (): Promise<DriveBackupMeta> => {
  const account = await requireAccount();
  const json = JSON.stringify(exportPayload());
  const existing = await getRemoteBackupInfo();
  if (existing) {
    await driveFetch(`${UPLOAD}/files/${existing.id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: json,
    });
  } else {
    await driveFetch(`${UPLOAD}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${BOUNDARY}` },
      body: multipartBody(json),
    });
  }
  const meta: DriveBackupMeta = {
    lastBackupAt: new Date().toISOString(),
    bytes: utf8Bytes(json),
    account,
  };
  await AsyncStorage.setItem(DRIVE_META_KEY, JSON.stringify(meta));
  return meta;
};

/** What the last successful upload looked like, or null. */
export const getBackupMeta = async (): Promise<DriveBackupMeta | null> => {
  try {
    const raw = await AsyncStorage.getItem(DRIVE_META_KEY);
    return raw ? (JSON.parse(raw) as DriveBackupMeta) : null;
  } catch {
    return null;
  }
};

/** Default ON: a signed-in user expects backups to simply happen. */
export const getAutoBackupEnabled = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(DRIVE_AUTO_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
};

export const setAutoBackupEnabled = async (on: boolean): Promise<void> => {
  await AsyncStorage.setItem(DRIVE_AUTO_KEY, on ? 'true' : 'false');
};

/**
 * Download → validate → (confirm) → replace. `confirm` runs after the file
 * has been parsed, with the same summary the iOS import shows, so the
 * caller can put up "Replace your data?" and cancel without side effects.
 */
export const restoreLatest = async (
  opts: { confirm?: (summary: RestoreSummary) => Promise<boolean> } = {},
): Promise<RestoreResult> => {
  try {
    await requireAccount();
    const remote = await getRemoteBackupInfo();
    if (!remote) {
      return { ok: false, error: 'No backup on Google Drive yet.' };
    }
    const res = await driveFetch(`${API}/files/${remote.id}?alt=media`);
    const parsed = parseBackup(await res.text());
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }
    const habits = Array.isArray(parsed.state.habits)
      ? (parsed.state.habits as unknown[]).length
      : 0;
    if (opts.confirm) {
      const go = await opts.confirm({ version: parsed.version, habits });
      if (!go) {
        return { ok: false, error: 'Restore cancelled.', cancelled: true };
      }
    }
    await applyBackup(parsed.state);
    return { ok: true, habits, version: parsed.version };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
};

/** Pure throttle rule: no meta yet, or the last upload is 20 h+ old. */
export const isBackupDue = (
  meta: DriveBackupMeta | null,
  now: number = Date.now(),
): boolean => {
  if (!meta) {
    return true;
  }
  const last = Date.parse(meta.lastBackupAt);
  return Number.isNaN(last) || now - last >= AUTO_BACKUP_INTERVAL_MS;
};

/**
 * Background hook (the integrator calls it next to mirrorBackup on AppState
 * 'background'): upload when signed in, auto-backup is on and the last one
 * is 20 h+ old. Never throws — a failed backup must not break leaving the app.
 * Resolves true only when an upload actually happened.
 */
export const maybeAutoDriveBackup = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== 'android' || !driveBackupConfigured()) {
      return false;
    }
    if (!(await getAutoBackupEnabled())) {
      return false;
    }
    if (!isBackupDue(await getBackupMeta())) {
      return false;
    }
    configureGoogle();
    // Only installs where the user signed in (or Auto Backup restored that
    // state) ever go to the network from the background path.
    if (!gsi().hasPreviousSignIn()) {
      return false;
    }
    if (!(await getAccount())) {
      return false;
    }
    await backupNow();
    return true;
  } catch (e) {
    console.warn('[driveBackup] auto backup skipped:', errorMessage(e));
    return false;
  }
};
