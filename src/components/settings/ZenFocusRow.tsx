import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Platform,
  Pressable,
  Switch,
  View,
} from 'react-native';
import AppText from '../AppText';
import {
  getZenAccessState,
  openZenAccessSettings,
} from '../../services/zenMode';
import { useStore } from '../../store/useStore';
import { colors } from '../../theme/theme';
import { settingsStyles as s } from './rowStyles';

/**
 * Settings → Focus: the "Zen also runs the system quiet mode" row, bound to
 * `zen.useFocusShortcut` on both platforms (the preference means "run the
 * system quiet mode", whatever that is here).
 *  - iOS: runs the user's “Slay Zen” Shortcut (Set Focus).
 *  - Android: Do Not Disturb through src/services/zenMode.ts, with the
 *    notification-policy access flow.
 */
function ZenFocusRow() {
  return Platform.OS === 'android' ? <AndroidDndRow /> : <IosFocusRow />;
}

function IosFocusRow() {
  const zen = useStore(st => st.zen);
  const setZen = useStore(st => st.setZen);
  return (
    <View style={s.group}>
      <View style={s.row}>
        <View style={s.iconChip}>
          <AppText variant="body">🧘</AppText>
        </View>
        <View style={s.flex}>
          <AppText variant="bodyMedium">Zen runs iOS Focus</AppText>
          <AppText variant="alt" color={colors.ink40}>
            Starting zen also triggers your “Slay Zen” Shortcut
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Zen runs iOS Focus"
          value={zen.useFocusShortcut}
          onValueChange={v => {
            setZen({ useFocusShortcut: v });
            if (v) {
              Alert.alert(
                'One-time setup',
                'In the Shortcuts app, create a shortcut named ' +
                  '“Slay Zen” with the action “Set Focus” (e.g. Do ' +
                  'Not Disturb until turned off). Starting zen will run ' +
                  'it, silencing every app’s notifications system-wide.',
              );
            }
          }}
          trackColor={{ true: colors.green, false: colors.ink10 }}
        />
      </View>
    </View>
  );
}

const ANDROID_LABEL = 'Zen turns on Do Not Disturb';
const BLOCKED_LINE = 'Needs notification-policy access · Open settings';

/**
 * Android's "Notification policy access" is a special permission granted
 * only from the system page, so this row mirrors SettingsScreen's
 * PermissionRow: explain-and-open when switching on without access, and a
 * red recovery line while the preference is on but access was revoked later.
 * The grant happens outside the app, hence the re-check on focus and on
 * returning to the foreground.
 */
function AndroidDndRow() {
  const dndOn = useStore(st => st.zen.useFocusShortcut);
  const setZen = useStore(st => st.setZen);
  // null until the first check so a fresh mount never flashes the red line.
  const [granted, setGranted] = useState<boolean | null>(null);
  const refresh = useCallback(() => {
    getZenAccessState().then(st => setGranted(st.granted));
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);
  const blocked = dndOn && granted === false;

  const openSettings = () => {
    openZenAccessSettings();
  };
  const explainAndOpen = () => {
    Alert.alert(
      'Allow Do Not Disturb access',
      'Android only lets Slay switch Do Not Disturb on with “Notification ' +
        'policy access”. Turn Slay on in the list that opens next, then ' +
        'come back.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: openSettings },
      ],
    );
  };

  return (
    <View style={s.group}>
      <Pressable
        accessible={false}
        onPress={blocked ? openSettings : undefined}
        disabled={!blocked}
        style={s.row}
      >
        <View style={s.iconChip}>
          <AppText variant="body">🧘</AppText>
        </View>
        <View style={s.flex}>
          <AppText variant="bodyMedium">{ANDROID_LABEL}</AppText>
          <AppText variant="alt" color={blocked ? colors.red : colors.ink40}>
            {blocked
              ? BLOCKED_LINE
              : 'Silences other apps’ notifications for the session'}
          </AppText>
        </View>
        <Switch
          accessibilityLabel={ANDROID_LABEL}
          accessibilityHint={
            blocked ? 'Needs notification-policy access' : undefined
          }
          value={dndOn}
          onValueChange={v => {
            setZen({ useFocusShortcut: v });
            if (!v) {
              return;
            }
            // Re-check rather than trust the last snapshot: the grant may
            // have changed since the screen last focused.
            getZenAccessState().then(st => {
              setGranted(st.granted);
              if (!st.granted) {
                explainAndOpen();
              }
            });
          }}
          trackColor={{ true: colors.green, false: colors.ink10 }}
        />
      </Pressable>
    </View>
  );
}

export default ZenFocusRow;
