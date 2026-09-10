import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Appearance,
  AppState,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { IconButton } from '../components/common';
import AppLockSection from '../components/settings/AppLockSection';
import DriveBackupSection from '../components/settings/DriveBackupSection';
import ZenFocusRow from '../components/settings/ZenFocusRow';
import { afterMutation } from '../services/afterMutation';
import {
  applyBackup,
  lastBackupAt,
  mirrorBackup,
  parseBackup,
  shareExport,
} from '../services/backup';
import { connectCalendar } from '../services/deviceCalendar';
import { connectHealth, healthSourceName } from '../services/health';
import {
  cancelReminder,
  hasNotificationPermission,
  requestNotificationPermission,
  resyncReminders,
  scheduleDailyReminder,
} from '../services/notifications';
import { scheduleRecap } from '../services/recap';
import { requestLocationPermission } from '../services/weather';
import { applyInterfaceStyle } from '../services/theme';
import { useStore } from '../store/useStore';
import {
  cardShadow,
  colors,
  radius,
  screenPadding,
  spacing,
} from '../theme/theme';

type Row = {
  key: string;
  label: string;
  icon: string;
  type: 'link' | 'toggle';
  subtitle?: string;
};

const GENERAL: Row[] = [
  { key: 'dark', label: 'Dark Mode', icon: '🌙', type: 'toggle' },
  { key: 'sounds', label: 'Sounds', icon: '🔊', type: 'toggle' },
  {
    key: 'vacation',
    label: 'Vacation Mode',
    icon: '🏝',
    type: 'toggle',
    subtitle: 'Pauses every reminder without forgetting them',
  },
];

/** Remembered dates are nudges too: a yearly one instead of a daily one. */
const DATES_ROW: Row = {
  key: 'dates',
  label: 'Remember dates',
  icon: '🎂',
  type: 'link',
  subtitle: 'Birthdays, anniversaries, deadlines — a nudge every year',
};

/** The inbox row lives with the nudges it collects (design review 2A). */
const INBOX_ROW: Row = {
  key: 'notifications',
  label: 'Inbox',
  icon: '📥',
  type: 'link',
  subtitle: 'Delivered nudges and heads-ups',
};

const ABOUT: Row[] = [
  { key: 'share', label: 'Share with Friends', icon: '↗', type: 'link' },
  { key: 'about', label: 'About Us', icon: 'ℹ️', type: 'link' },
];

const APP_VERSION: string = require('../../package.json').version;

/** Row with a permission-owning switch: subtitle, pending, blocked state (6A). */
function PermissionRow({
  icon,
  label,
  subtitle,
  value,
  isPending,
  blocked,
  onValueChange,
  onOpenSettings,
  isLast,
  testID,
}: {
  icon: string;
  label: string;
  subtitle: string;
  value: boolean;
  isPending: boolean;
  blocked: boolean;
  onValueChange: (v: boolean) => void;
  onOpenSettings: () => void;
  isLast?: boolean;
  testID: string;
}) {
  return (
    <Pressable
      accessible={false}
      onPress={blocked ? onOpenSettings : undefined}
      disabled={!blocked}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      <View style={styles.iconChip}>
        <AppText variant="body">{icon}</AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyMedium">{label}</AppText>
        <AppText variant="alt" color={blocked ? colors.red : colors.ink60}>
          {blocked
            ? 'Off — blocked in system Settings. Tap to open Settings ›'
            : isPending
            ? 'Waiting for permission…'
            : subtitle}
        </AppText>
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={blocked ? 'Blocked in system Settings' : undefined}
        value={value && !blocked}
        disabled={isPending}
        onValueChange={onValueChange}
        trackColor={{ true: colors.green, false: colors.ink10 }}
      />
    </Pressable>
  );
}

/** Settings per the Figma "Profile & Settings" section. */
function SettingsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {
    healthConnected,
    calendarConnected,
    setIntegration,
    habits,
    updateHabit,
    darkMode,
    setDarkMode,
    prefs,
    setPref,
  } = useStore();
  const reminderHabits = habits.filter(h => h.reminder);

  /* ------------------------------ Backup ------------------------------ */

  const [backupAt, setBackupAt] = useState<string | null>(null);
  useEffect(() => {
    lastBackupAt().then(setBackupAt);
  }, []);

  const onExport = async () => {
    await mirrorBackup(); // freshen the slot alongside the share
    setBackupAt(await lastBackupAt());
    await shareExport();
  };

  const onImport = () => {
    if (Platform.OS !== 'ios') {
      Alert.alert(
        'Import',
        'Paste-import is iOS-only for now — share a backup file to this device and open it in the app instead.',
      );
      return;
    }
    Alert.prompt(
      'Import backup',
      'Paste the backup JSON you exported earlier. Your current data is snapshotted first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Validate',
          onPress: (text?: string) => {
            const parsed = parseBackup(text ?? '');
            if (!parsed.ok) {
              Alert.alert('Import failed', parsed.error);
              return;
            }
            const habitsN = Array.isArray(parsed.state.habits)
              ? (parsed.state.habits as unknown[]).length
              : 0;
            Alert.alert(
              'Replace your data?',
              `This backup (v${parsed.version}) holds ${habitsN} habits. ` +
                'Your current data will be replaced (a pre-import snapshot is kept).',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Replace',
                  style: 'destructive',
                  onPress: async () => {
                    await applyBackup(parsed.state);
                    await afterMutation();
                    Alert.alert('Import complete', 'Your data was restored.');
                  },
                },
              ],
            );
          },
        },
      ],
      'plain-text',
    );
  };

  const toggleReminder = async (habitId: string, on: boolean) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit?.reminder) {
      return;
    }
    updateHabit(habitId, {
      reminder: { ...habit.reminder, enabled: on },
    });
    if (on) {
      // During vacation mode keep the flag but don't schedule — turning
      // vacation off resyncs every enabled reminder.
      if (prefs.vacationMode) {
        Alert.alert(
          'Vacation mode is on',
          'This reminder will start again when you turn vacation mode off.',
        );
        return;
      }
      const ok = await scheduleDailyReminder(
        habitId,
        habit.name,
        habit.reminder.time,
      );
      if (!ok) {
        // Roll the flag back so the switch doesn't claim a reminder
        // that was never scheduled.
        updateHabit(habitId, {
          reminder: { ...habit.reminder, enabled: false },
        });
        Alert.alert(
          'Notifications disabled',
          'Allow notifications for Slay to get reminders.',
        );
      }
    } else {
      cancelReminder(habitId);
    }
  };
  /**
   * Vacation mode pauses every scheduled reminder without forgetting them:
   * ON cancels the OS triggers, OFF re-creates them from the store.
   */
  const toggleVacation = (on: boolean) => {
    setPref('vacationMode', on);
    if (on) {
      habits
        .filter(h => h.reminder?.enabled)
        .forEach(h => cancelReminder(h.id));
    } else {
      resyncReminders(habits);
    }
  };

  const onRowPress = (key: string) => {
    if (key === 'notifications') {
      navigation.navigate('Notifications');
    } else if (key === 'dates') {
      navigation.navigate('RememberDates');
    } else if (key === 'share') {
      Share.share({
        message:
          'I’m building better habits with Slay, a simple habit tracker. Join me and let’s keep our streaks going! 🌱',
      }).catch(() => {});
    } else if (key === 'about') {
      Alert.alert(
        `Slay v${APP_VERSION}`,
        'A small personal habit tracker: build good habits, quit bad ones, and keep the streak alive. Your data stays on this device.\n\nQuote of the day provided by ZenQuotes API (zenquotes.io).',
      );
    }
  };

  const toggleHealth = async (on: boolean) => {
    if (!on) {
      setIntegration('healthConnected', false);
      return;
    }
    const ok = await connectHealth();
    setIntegration('healthConnected', ok);
    if (!ok) {
      Alert.alert(
        `${healthSourceName} unavailable`,
        Platform.OS === 'android'
          ? 'Health Connect access could not be enabled. Make sure it is installed and up to date, then allow steps and sleep.'
          : 'Health access could not be enabled on this device.',
      );
    }
  };

  const toggleCalendar = async (on: boolean) => {
    if (!on) {
      setIntegration('calendarConnected', false);
      return;
    }
    const ok = await connectCalendar();
    setIntegration('calendarConnected', ok);
    if (!ok) {
      Alert.alert(
        'Calendar unavailable',
        'Calendar access could not be enabled on this device.',
      );
    }
  };

  /* --------------- permission-owning toggles (eng review 2026-08-31) ---- */
  // Visible states for the two rows (design review 6A): pending while the OS
  // dialog is up, denied with a recovery path, and "ON but blocked" after a
  // later revoke or the v4 migration — re-checked on focus and foreground.
  const [pending, setPending] = useState<{
    recap?: boolean;
    weather?: boolean;
  }>({});
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const refreshPermissionStatus = useCallback(() => {
    hasNotificationPermission().then(setNotifGranted);
  }, []);
  useFocusEffect(refreshPermissionStatus);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        refreshPermissionStatus();
      }
    });
    return () => sub.remove();
  }, [refreshPermissionStatus]);
  const recapBlocked = notifGranted === false && prefs.recap;
  const weatherBlocked = prefs.locationDenied;
  const openIosSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  // Boot and background paths never raise an OS dialog; these two switches
  // are the only places (besides creating a habit reminder) that do.
  const toggleRecap = async (on: boolean) => {
    if (!on) {
      setPref('recap', false);
      scheduleRecap();
      return;
    }
    if (pending.recap) {
      return;
    }
    setPending(p => ({ ...p, recap: true }));
    const ok = await requestNotificationPermission();
    setPending(p => ({ ...p, recap: false }));
    setNotifGranted(ok);
    setPref('recap', ok);
    if (ok) {
      scheduleRecap();
    } else {
      Alert.alert(
        'Notifications are off',
        'Allow notifications for Slay in system Settings to get the evening recap.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: openIosSettings },
        ],
      );
    }
  };

  const toggleWeather = async (on: boolean) => {
    if (!on) {
      setPref('weather', false);
      return;
    }
    if (pending.weather) {
      return;
    }
    setPending(p => ({ ...p, weather: true }));
    const ok = await requestLocationPermission();
    setPending(p => ({ ...p, weather: false }));
    setPref('locationDenied', !ok);
    setPref('weather', ok);
    if (!ok) {
      Alert.alert(
        'Location is off',
        'Allow location for Slay in system Settings to show local weather and rain alerts.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: openIosSettings },
        ],
      );
    }
  };

  const toggleValue = (key: string): boolean =>
    key === 'dark'
      ? darkMode
      : key === 'sounds'
      ? prefs.sounds
      : prefs.vacationMode;

  const onToggle = (key: string, v: boolean) => {
    if (key === 'dark') {
      setDarkMode(v);
      Appearance.setColorScheme(v ? 'dark' : 'light');
      applyInterfaceStyle(v ? 'dark' : 'light');
    } else if (key === 'sounds') {
      setPref('sounds', v);
    } else {
      toggleVacation(v);
    }
  };

  const renderRow = (row: Row, isLast: boolean) => (
    <Pressable
      key={row.key}
      onPress={() => onRowPress(row.key)}
      disabled={row.type === 'toggle'}
      // Toggle rows: keep the Switch its own VoiceOver element instead of
      // merging label + switch into one inert container.
      accessible={row.type !== 'toggle'}
      style={[styles.row, !isLast && styles.rowBorder]}
    >
      <View style={styles.iconChip}>
        <AppText variant="body">{row.icon}</AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyMedium">{row.label}</AppText>
        {row.subtitle ? (
          <AppText variant="alt" color={colors.ink60}>
            {row.subtitle}
          </AppText>
        ) : null}
      </View>
      {row.type === 'toggle' ? (
        <Switch
          testID={`switch-${row.key}`}
          accessibilityLabel={row.label}
          value={toggleValue(row.key)}
          onValueChange={v => onToggle(row.key, v)}
          trackColor={{ true: colors.green, false: colors.ink10 }}
        />
      ) : (
        <AppText variant="body" color={colors.ink40}>
          ›
        </AppText>
      )}
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton
          size={40}
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
        >
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <AppText variant="h6">Settings</AppText>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="chip" color={colors.ink40}>
          General
        </AppText>
        <View style={styles.group}>
          {GENERAL.map((r, i) => renderRow(r, i === GENERAL.length - 1))}
        </View>
        <AppText variant="chip" color={colors.ink40}>
          Nudges
        </AppText>
        <View style={styles.group}>
          <PermissionRow
            icon="🌆"
            label="Evening recap"
            subtitle="A 9 pm check-in when the day isn’t perfect yet"
            value={prefs.recap}
            isPending={!!pending.recap}
            blocked={recapBlocked}
            onValueChange={toggleRecap}
            onOpenSettings={openIosSettings}
            testID="switch-recap"
          />
          <PermissionRow
            icon="🌦"
            label="Weather & rain alerts"
            subtitle="Local forecast on Home, heads-up before rain"
            value={prefs.weather}
            isPending={!!pending.weather}
            blocked={weatherBlocked}
            onValueChange={toggleWeather}
            onOpenSettings={openIosSettings}
            testID="switch-weather"
          />
          {renderRow(DATES_ROW, false)}
          {renderRow(INBOX_ROW, true)}
        </View>
        <AppText variant="chip" color={colors.ink40}>
          Connected Services
        </AppText>
        <View style={styles.group}>
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.iconChip}>
              <AppText variant="body">❤️</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">{healthSourceName}</AppText>
              <AppText variant="alt" color={colors.ink40}>
                Auto-track steps into your Walk habit
              </AppText>
            </View>
            <Switch
              accessibilityLabel={healthSourceName}
              value={healthConnected}
              onValueChange={toggleHealth}
              trackColor={{ true: colors.green, false: colors.ink10 }}
            />
          </View>
          <View style={styles.row}>
            <View style={styles.iconChip}>
              <AppText variant="body">🗓</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Device Calendar</AppText>
              <AppText variant="alt" color={colors.ink40}>
                Import meetings as time blocks
              </AppText>
            </View>
            <Switch
              accessibilityLabel="Device Calendar"
              value={calendarConnected}
              onValueChange={toggleCalendar}
              trackColor={{ true: colors.green, false: colors.ink10 }}
            />
          </View>
        </View>
        <AppText variant="chip" color={colors.ink40}>
          Focus
        </AppText>
        <AppLockSection />
        <ZenFocusRow />
        {reminderHabits.length > 0 && (
          <>
            <AppText variant="chip" color={colors.ink40}>
              Reminders
            </AppText>
            <View style={styles.group}>
              {reminderHabits.map((h, i) => (
                <View
                  key={h.id}
                  style={[
                    styles.row,
                    i < reminderHabits.length - 1 && styles.rowBorder,
                  ]}
                >
                  <View style={styles.iconChip}>
                    <AppText variant="body">{h.emoji}</AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyMedium">{h.name}</AppText>
                    <AppText variant="alt" color={colors.ink40}>
                      🕐 {h.reminder?.time} ·{' '}
                      {prefs.vacationMode ? 'Paused (vacation)' : 'Every day'}
                    </AppText>
                  </View>
                  <Switch
                    value={h.reminder?.enabled ?? false}
                    onValueChange={v => toggleReminder(h.id, v)}
                    trackColor={{ true: colors.green, false: colors.ink10 }}
                  />
                </View>
              ))}
            </View>
          </>
        )}
        <AppText variant="chip" color={colors.ink40}>
          Backup
        </AppText>
        <View style={styles.group}>
          <Pressable
            style={[styles.row, Platform.OS === 'ios' && styles.rowBorder]}
            onPress={onExport}
          >
            <View style={styles.iconChip}>
              <AppText variant="body">📤</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyMedium">Export backup</AppText>
              <AppText variant="alt" color={colors.ink40}>
                Share your data as JSON — the off-device copy
              </AppText>
            </View>
            <AppText variant="body" color={colors.ink40}>
              ›
            </AppText>
          </Pressable>
          {/* Paste-import is iOS-only; Android restores through Google Drive below. */}
          {Platform.OS === 'ios' && (
            <Pressable style={styles.row} onPress={onImport}>
              <View style={styles.iconChip}>
                <AppText variant="body">📥</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyMedium">Import backup</AppText>
                <AppText variant="alt" color={colors.ink40}>
                  {backupAt
                    ? `Last auto-backup: ${new Date(backupAt).toLocaleString()}`
                    : 'No auto-backup yet — happens when you leave the app'}
                </AppText>
              </View>
              <AppText variant="body" color={colors.ink40}>
                ›
              </AppText>
            </Pressable>
          )}
        </View>
        <DriveBackupSection />
        <AppText variant="chip" color={colors.ink40}>
          About
        </AppText>
        <View style={styles.group}>
          {ABOUT.map((r, i) => renderRow(r, i === ABOUT.length - 1))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: { padding: screenPadding, gap: spacing.md },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    ...cardShadow,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SettingsScreen;
