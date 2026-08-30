/**
 * Backup & restore (4A revised by 8A):
 *
 *   store ──export()──▶ versioned JSON ──Share sheet──▶ off-device (the
 *     │                                                  real durability)
 *     └─on background──▶ BACKUP_MIRROR_KEY (second AsyncStorage key — guards
 *                        against corruption, not uninstall; single slot)
 *
 *   import: parse ▸ validate ▸ migrate (same v-steps as rehydrate) ▸
 *           pre-import snapshot ▸ importState (explicit field replace)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import { DATA_KEYS, migrateStore, useStore } from '../store/useStore';

export const BACKUP_MIRROR_KEY = 'routiner-backup-mirror';
export const PRE_IMPORT_KEY = 'routiner-preimport-snapshot';
const BACKUP_VERSION = 3;

export type BackupPayload = {
  version: number;
  exportedAt: string;
  state: Record<string, unknown>;
};

/** Snapshot the persisted DATA fields (never actions). */
export const exportPayload = (): BackupPayload => {
  const s = useStore.getState() as unknown as Record<string, unknown>;
  const state: Record<string, unknown> = {};
  for (const k of DATA_KEYS) {
    state[k] = s[k];
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
};

/** Mirror the full export into the single backup slot (app-background). */
export const mirrorBackup = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      BACKUP_MIRROR_KEY,
      JSON.stringify(exportPayload()),
    );
  } catch (e) {
    console.error('[backup] mirror write failed:', e);
  }
};

/** When the last mirror was written, or null if none exists. */
export const lastBackupAt = async (): Promise<string | null> => {
  try {
    const raw = await AsyncStorage.getItem(BACKUP_MIRROR_KEY);
    if (!raw) {
      return null;
    }
    return (JSON.parse(raw) as BackupPayload).exportedAt ?? null;
  } catch {
    return null;
  }
};

/** Hand the backup JSON to the share sheet — the off-device copy. */
export const shareExport = async (): Promise<boolean> => {
  try {
    await Share.share({ message: JSON.stringify(exportPayload()) });
    return true;
  } catch {
    return false;
  }
};

export type ParsedBackup =
  | { ok: true; state: Record<string, unknown>; version: number }
  | { ok: false; error: string };

/** Validate + migrate a pasted backup. Pure — apply separately. */
export const parseBackup = (json: string): ParsedBackup => {
  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    return { ok: false, error: 'Not valid JSON.' };
  }
  const p = payload as Partial<BackupPayload>;
  if (typeof p !== 'object' || p === null || typeof p.state !== 'object') {
    return { ok: false, error: 'Not a Routiner backup (missing state).' };
  }
  const version = typeof p.version === 'number' ? p.version : 0;
  if (version > BACKUP_VERSION) {
    return {
      ok: false,
      error: `Backup version ${version} is newer than this app supports.`,
    };
  }
  // Old backups run through the SAME migrate steps as rehydrate (plan C9).
  const state = migrateStore(p.state, version) as Record<string, unknown>;
  return { ok: true, state, version };
};

/** Apply a parsed backup: safety snapshot first, then explicit replace. */
export const applyBackup = async (
  state: Record<string, unknown>,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(PRE_IMPORT_KEY, JSON.stringify(exportPayload()));
  } catch (e) {
    console.error('[backup] pre-import snapshot failed:', e);
  }
  useStore.getState().importState(state);
};
