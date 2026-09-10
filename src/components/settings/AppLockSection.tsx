import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  Switch,
  View,
} from 'react-native';
import { showActionSheet } from '../ActionSheet';
import AppText from '../AppText';
import {
  AppLockPrefs,
  AppLockState,
  applyAppLock,
  appLockConditionLabel,
  getAppLockState,
  requestAppLockAuth,
} from '../../services/appLock';
import { useStore } from '../../store/useStore';
import { colors } from '../../theme/theme';
import { settingsStyles as s } from './rowStyles';

const UNLOCK_TIMES = ['12:00', '18:00', '21:00'];

const PERMISSIONS_COPY =
  'App Lock watches which app is in front (Usage access) and draws the ' +
  'lock screen over it (Display over other apps). Android only grants ' +
  'both from Settings — allow each one, then come back.';

/**
 * Settings → Focus: App Lock.
 * Android: Usage access + overlay shield (android/…/applock). iOS renders
 * nothing until the Family Controls provisioning profile exists (see
 * TODOS.md); the iOS module stays wired for when it does.
 */
function AppLockSection(): React.JSX.Element | null {
  if (Platform.OS !== 'android') {
    return null;
  }
  return <AndroidAppLockSection />;
}

function AndroidAppLockSection() {
  const navigation = useNavigation<any>();
  const habits = useStore(st => st.habits);
  const completions = useStore(st => st.completions);
  const statuses = useStore(st => st.statuses);
  const appLock = useStore(st => st.appLock);
  const setAppLock = useStore(st => st.setAppLock);

  const [lockInfo, setLockInfo] = useState<AppLockState | null>(null);

  // "Turn on" spans a Settings round-trip and/or the picker screen, neither
  // of which can be awaited. Remember the intent and finish it when the
  // section is next refreshed (AppState 'active' or screen focus).
  const pendingEnable = useRef(false);
  const pickerOpened = useRef(false);

  /** Persist a prefs change and sync the shield right away. */
  const syncAppLock = useCallback(
    (patch: Partial<AppLockPrefs>) => {
      const next = { ...appLock, ...patch };
      setAppLock(patch);
      applyAppLock(next, habits, completions, statuses).then(() =>
        getAppLockState().then(setLockInfo),
      );
    },
    [appLock, setAppLock, habits, completions, statuses],
  );

  const enableNow = useCallback(() => {
    syncAppLock({
      enabled: true,
      habitId:
        appLock.condition === 'habit'
          ? appLock.habitId ?? habits[0]?.id ?? null
          : appLock.habitId,
    });
  }, [appLock.condition, appLock.habitId, habits, syncAppLock]);

  const refresh = useCallback(async () => {
    const info = await getAppLockState();
    setLockInfo(info);
    if (!pendingEnable.current) {
      return;
    }
    if (!info.authorized) {
      // Came back from Settings without granting — don't ambush them later.
      pendingEnable.current = false;
      pickerOpened.current = false;
      return;
    }
    if (info.apps > 0) {
      pendingEnable.current = false;
      pickerOpened.current = false;
      enableNow();
    } else if (pickerOpened.current) {
      pendingEnable.current = false;
      pickerOpened.current = false;
      Alert.alert('No apps picked', 'Choose at least one app to lock.');
    } else {
      pickerOpened.current = true;
      navigation.navigate('AppLockPicker');
    }
  }, [enableNow, navigation]);

  // Listeners must see the latest closure without re-subscribing per render.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      refreshRef.current();
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        refreshRef.current();
      }
    });
    return () => sub.remove();
  }, []);

  const openPermissionSettings = () => {
    // Opens whichever special-permission page is still missing.
    requestAppLockAuth();
  };

  const toggleAppLock = async (on: boolean) => {
    if (!on) {
      pendingEnable.current = false;
      pickerOpened.current = false;
      syncAppLock({ enabled: false });
      return;
    }
    const info = await getAppLockState();
    setLockInfo(info);
    pendingEnable.current = true;
    pickerOpened.current = false;
    if (!info.authorized) {
      Alert.alert('Two permissions needed', PERMISSIONS_COPY, [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => {
            pendingEnable.current = false;
          },
        },
        { text: 'Open Settings', onPress: openPermissionSettings },
      ]);
      return;
    }
    await refresh();
  };

  const chooseLockedApps = () => {
    navigation.navigate('AppLockPicker');
  };

  const chooseUnlockCondition = () => {
    const options = [
      ...habits.map(h => `${h.emoji} After “${h.name}” is done`),
      '✅ After all habits are done',
      ...UNLOCK_TIMES.map(t => `🕐 Daily at ${t}`),
      'Cancel',
    ];
    showActionSheet(
      {
        title: 'Apps unlock…',
        options,
        cancelButtonIndex: options.length - 1,
      },
      idx => {
        if (idx === options.length - 1) {
          return;
        }
        if (idx < habits.length) {
          syncAppLock({ condition: 'habit', habitId: habits[idx].id });
        } else if (idx === habits.length) {
          syncAppLock({ condition: 'all' });
        } else {
          syncAppLock({
            condition: 'time',
            until: UNLOCK_TIMES[idx - habits.length - 1],
          });
        }
      },
    );
  };

  const revoked = appLock.enabled && lockInfo !== null && !lockInfo.authorized;

  return (
    <View style={s.group}>
      <Pressable
        accessible={false}
        onPress={revoked ? openPermissionSettings : undefined}
        disabled={!revoked}
        style={[s.row, appLock.enabled && s.rowBorder]}
      >
        <View style={s.iconChip}>
          <AppText variant="body">🔒</AppText>
        </View>
        <View style={s.flex}>
          <AppText variant="bodyMedium">App Lock</AppText>
          <AppText variant="alt" color={revoked ? colors.red : colors.ink40}>
            {revoked
              ? 'Needs Usage access and Display over other apps · Open settings ›'
              : appLock.enabled
              ? `Locked ${appLockConditionLabel(appLock, habits)}`
              : 'Block distracting apps until you earn them'}
          </AppText>
        </View>
        <Switch
          testID="applock-switch"
          accessibilityLabel="App Lock"
          accessibilityHint={
            revoked ? 'A permission was revoked in Android Settings' : undefined
          }
          value={appLock.enabled}
          onValueChange={toggleAppLock}
          trackColor={{ true: colors.green, false: colors.ink10 }}
        />
      </Pressable>
      {appLock.enabled && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Locked apps"
            style={[s.row, s.rowBorder]}
            onPress={chooseLockedApps}
          >
            <View style={s.iconChip}>
              <AppText variant="body">📱</AppText>
            </View>
            <View style={s.flex}>
              <AppText variant="bodyMedium">Locked apps</AppText>
              <AppText variant="alt" color={colors.ink40}>
                {lockInfo
                  ? `${lockInfo.apps} app${lockInfo.apps === 1 ? '' : 's'}`
                  : 'Loading…'}
              </AppText>
            </View>
            <AppText variant="body" color={colors.ink40}>
              ›
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Unlocks"
            style={s.row}
            onPress={chooseUnlockCondition}
          >
            <View style={s.iconChip}>
              <AppText variant="body">🔓</AppText>
            </View>
            <View style={s.flex}>
              <AppText variant="bodyMedium">Unlocks</AppText>
              <AppText variant="alt" color={colors.ink40}>
                {appLockConditionLabel(appLock, habits)}
              </AppText>
            </View>
            <AppText variant="body" color={colors.ink40}>
              ›
            </AppText>
          </Pressable>
        </>
      )}
    </View>
  );
}

export default AppLockSection;
