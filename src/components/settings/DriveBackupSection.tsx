import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import AppText from '../AppText';
import { afterMutation } from '../../services/afterMutation';
import {
  backupNow,
  driveBackupConfigured,
  getAccount,
  getAutoBackupEnabled,
  getBackupMeta,
  getRemoteBackupInfo,
  restoreLatest,
  setAutoBackupEnabled,
  signIn,
  signOut,
  type DriveBackupMeta,
  type RestoreSummary,
} from '../../services/driveBackup';
import { colors, spacing } from '../../theme/theme';
import { settingsStyles as s } from './rowStyles';

/**
 * Settings → Google Drive (Android only; iOS renders nothing — its
 * off-device copy is the Export share sheet). Sign in, back up now, the
 * auto-backup switch and restore, mirroring the iOS import's validate →
 * "Replace your data?" → replace flow. Unconfigured builds get one
 * explanatory row and never touch the sign-in module.
 */
function DriveBackupSection(): React.JSX.Element | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  return <AndroidDriveBackup />;
}

type Busy = 'signin' | 'backup' | 'restore' | null;
type RemoteSummary = { modifiedTime: string; bytes: number } | null;

const formatBytes = (n: number): string =>
  n >= 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

const formatWhen = (iso: string): string => new Date(iso).toLocaleString();

/** The iOS import's confirmation, as a promise so restoreLatest can await it. */
const confirmReplace = ({ version, habits }: RestoreSummary) =>
  new Promise<boolean>(resolve => {
    Alert.alert(
      'Replace your data?',
      `This backup (v${version}) holds ${habits} habits. ` +
        'Your current data will be replaced (a pre-import snapshot is kept).',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ],
      // Back-button dismissal must still settle the promise.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });

function LinkRow({
  icon,
  label,
  subtitle,
  onPress,
  disabled,
  isLast,
  action,
  testID,
}: {
  icon: string;
  label: string;
  subtitle: string;
  onPress?: () => void;
  disabled?: boolean;
  isLast?: boolean;
  /** Right-hand text instead of the chevron (e.g. "Sign out"). */
  action?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[s.row, !isLast && s.rowBorder, disabled && styles.dim]}
    >
      <View style={s.iconChip}>
        <AppText variant="body">{icon}</AppText>
      </View>
      <View style={s.flex}>
        <AppText variant="bodyMedium">{label}</AppText>
        <AppText variant="alt" color={colors.ink40}>
          {subtitle}
        </AppText>
      </View>
      <AppText variant={action ? 'alt' : 'body'} color={colors.ink40}>
        {action ?? '›'}
      </AppText>
    </Pressable>
  );
}

function AndroidDriveBackup() {
  const configured = driveBackupConfigured();
  // undefined = still checking, null = signed out.
  const [account, setAccount] = useState<string | null | undefined>(
    configured ? undefined : null,
  );
  const [meta, setMeta] = useState<DriveBackupMeta | null>(null);
  const [remote, setRemote] = useState<RemoteSummary | undefined>(undefined);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);

  const refreshRemote = useCallback(async (email: string | null) => {
    if (!email) {
      setRemote(null);
      return;
    }
    try {
      const info = await getRemoteBackupInfo();
      setRemote(
        info ? { modifiedTime: info.modifiedTime, bytes: info.bytes } : null,
      );
    } catch {
      // Offline or token trouble: leave the subtitle on "checking" rather
      // than claim there is no backup.
      setRemote(undefined);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      return;
    }
    let alive = true;
    (async () => {
      const [email, m, a] = await Promise.all([
        getAccount(),
        getBackupMeta(),
        getAutoBackupEnabled(),
      ]);
      if (!alive) {
        return;
      }
      setAccount(email);
      setMeta(m);
      setAuto(a);
      refreshRemote(email);
    })();
    return () => {
      alive = false;
    };
  }, [configured, refreshRemote]);

  const onSignIn = async () => {
    if (busy) {
      return;
    }
    setBusy('signin');
    const res = await signIn();
    setBusy(null);
    if (res.ok) {
      setAccount(res.email);
      refreshRemote(res.email);
      return;
    }
    if (res.reason === 'playServices') {
      Alert.alert('Google Play Services needed', res.error);
    } else if (res.reason !== 'cancelled') {
      Alert.alert('Sign-in failed', res.error);
    }
  };

  const onSignOut = () => {
    Alert.alert(
      'Sign out of Google?',
      'Your backup stays in your Google Drive; Slay just stops updating it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            setAccount(null);
            setMeta(null);
            setRemote(null);
          },
        },
      ],
    );
  };

  const onBackupNow = async () => {
    if (!account || busy) {
      return;
    }
    setBusy('backup');
    try {
      const m = await backupNow();
      setMeta(m);
      setRemote({ modifiedTime: m.lastBackupAt, bytes: m.bytes });
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onToggleAuto = (v: boolean) => {
    setAuto(v);
    setAutoBackupEnabled(v).catch(() => {});
  };

  const onRestore = async () => {
    if (!account || busy) {
      return;
    }
    setBusy('restore');
    const result = await restoreLatest({ confirm: confirmReplace });
    setBusy(null);
    if (result.ok) {
      await afterMutation();
      Alert.alert(
        'Restore complete',
        `Your data was restored from Google Drive (${result.habits} habits).`,
      );
    } else if (!result.cancelled) {
      Alert.alert('Restore failed', result.error);
    }
  };

  const header = (
    <AppText variant="chip" color={colors.ink40}>
      Google Drive
    </AppText>
  );

  if (!configured) {
    return (
      <>
        {header}
        <View style={s.group}>
          <View style={s.row}>
            <View style={s.iconChip}>
              <AppText variant="body">☁️</AppText>
            </View>
            <View style={s.flex}>
              <AppText variant="bodyMedium">Google Drive backup</AppText>
              <AppText variant="alt" color={colors.ink40}>
                Set up Google Sign-In to enable Drive backup ·
                docs/android-google-drive-setup.md
              </AppText>
            </View>
          </View>
        </View>
        <AppText variant="alt" color={colors.ink40} style={styles.caption}>
          Android also backs up Slay with your Google account automatically.
        </AppText>
      </>
    );
  }

  const signedIn = !!account;
  const accountSubtitle =
    account === undefined
      ? 'Checking Google account…'
      : busy === 'signin'
      ? 'Waiting for Google…'
      : account ?? 'Keeps a copy of your data in your Drive’s app folder';
  const backupSubtitle =
    busy === 'backup'
      ? 'Backing up…'
      : meta
      ? `Last backup: ${formatWhen(meta.lastBackupAt)} · ${formatBytes(
          meta.bytes,
        )}`
      : signedIn
      ? 'No Drive backup yet'
      : 'Sign in first';
  const restoreSubtitle =
    busy === 'restore'
      ? 'Restoring…'
      : !signedIn
      ? 'Sign in first'
      : remote === undefined
      ? 'Checking Drive…'
      : remote
      ? `Backup from ${formatWhen(remote.modifiedTime)} · ${formatBytes(
          remote.bytes,
        )}`
      : 'No backup yet';

  return (
    <>
      {header}
      <View style={s.group}>
        <LinkRow
          testID="drive-account"
          icon="👤"
          label={signedIn ? 'Google account' : 'Sign in with Google'}
          subtitle={accountSubtitle}
          onPress={signedIn ? onSignOut : onSignIn}
          disabled={account === undefined || busy === 'signin'}
          action={signedIn ? 'Sign out' : undefined}
        />
        <LinkRow
          testID="drive-backup-now"
          icon="☁️"
          label="Back up now"
          subtitle={backupSubtitle}
          onPress={onBackupNow}
          disabled={!signedIn || busy !== null}
        />
        <Pressable
          accessible={false}
          disabled
          style={[s.row, s.rowBorder, !signedIn && styles.dim]}
        >
          <View style={s.iconChip}>
            <AppText variant="body">🔁</AppText>
          </View>
          <View style={s.flex}>
            <AppText variant="bodyMedium">
              Auto-backup when you leave the app
            </AppText>
            <AppText variant="alt" color={colors.ink40}>
              About once a day, while signed in
            </AppText>
          </View>
          <Switch
            testID="switch-drive-auto"
            accessibilityLabel="Auto-backup when you leave the app"
            value={auto && signedIn}
            disabled={!signedIn}
            onValueChange={onToggleAuto}
            trackColor={{ true: colors.green, false: colors.ink10 }}
          />
        </Pressable>
        <LinkRow
          testID="drive-restore"
          icon="📥"
          label="Restore from Google Drive"
          subtitle={restoreSubtitle}
          onPress={onRestore}
          disabled={!signedIn || !remote || busy !== null}
          isLast
        />
      </View>
      <AppText variant="alt" color={colors.ink40} style={styles.caption}>
        Android also backs up Slay with your Google account automatically.
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.5 },
  // Sits under the group card; the screen's own gap handles the spacing above.
  caption: { paddingHorizontal: spacing.sm },
});

export default DriveBackupSection;
