/**
 * First-launch restore offer (Android): when a fresh install has nothing to
 * show — hydrated, not onboarded, zero habits — and the Google account that
 * silently signs in has a Slay backup in Drive, offer to pull it in. Asked
 * at most once per install (DRIVE_PROMPTED_KEY); a "Not now" is final.
 *
 * Android Auto Backup usually restores the store before this ever runs, in
 * which case `onboarded` is already true and the prompt stays silent. This
 * covers the cases Auto Backup can't: backup opted out on the device, a
 * different phone without device-transfer, or a sideloaded build.
 *
 * The integrator mounts useDriveRestorePrompt() in App.tsx and calls
 * maybeAutoDriveBackup() next to mirrorBackup() on AppState 'background'.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { afterMutation } from '../services/afterMutation';
import {
  DRIVE_PROMPTED_KEY,
  driveBackupConfigured,
  getAccount,
  getRemoteBackupInfo,
  restoreLatest,
} from '../services/driveBackup';
import { useStore, whenHydrated } from '../store/useStore';

export { maybeAutoDriveBackup } from '../services/driveBackup';

export function useDriveRestorePrompt(): void {
  const onboarded = useStore(s => s.onboarded);
  const habitCount = useStore(s => s.habits.length);
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  const asked = useRef(false);

  useEffect(() => {
    let alive = true;
    whenHydrated().then(() => {
      if (alive) {
        setHydrated(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (
      Platform.OS !== 'android' ||
      !driveBackupConfigured() ||
      !hydrated ||
      onboarded ||
      habitCount > 0 ||
      asked.current
    ) {
      return;
    }
    asked.current = true;
    let alive = true;
    (async () => {
      if (await AsyncStorage.getItem(DRIVE_PROMPTED_KEY)) {
        return;
      }
      const account = await getAccount();
      if (!account) {
        // Not signed in on this install: nothing to offer; try again on a
        // later launch (asked stays true only for this mount).
        return;
      }
      const remote = await getRemoteBackupInfo();
      if (!remote || !alive) {
        return;
      }
      // Recorded before the Alert so a crash or kill mid-dialog counts as asked.
      await AsyncStorage.setItem(DRIVE_PROMPTED_KEY, new Date().toISOString());
      const when = remote.modifiedTime
        ? new Date(remote.modifiedTime).toLocaleString()
        : 'earlier';
      Alert.alert(
        'Restore your backup from Google Drive?',
        `${account} has a Slay backup from ${when}. Restore it to pick up where you left off.`,
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Restore',
            onPress: async () => {
              const result = await restoreLatest();
              if (result.ok) {
                await afterMutation();
                Alert.alert(
                  'Restore complete',
                  `Your data was restored from Google Drive (${result.habits} habits).`,
                );
              } else if (!result.cancelled) {
                Alert.alert('Restore failed', result.error);
              }
            },
          },
        ],
      );
    })().catch(e => {
      console.warn('[driveBackup] restore prompt skipped:', e);
    });
    return () => {
      alive = false;
    };
  }, [hydrated, onboarded, habitCount]);
}
