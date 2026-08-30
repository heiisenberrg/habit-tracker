import React from 'react';
import { ActionSheetIOS, Linking, StyleSheet, View } from 'react-native';
import AppText from '../AppText';
import { Habit } from '../../data/seed';
import { appLockConditionLabel, zenActiveAt } from '../../services/appLock';
import { cancelReminder, resyncReminders } from '../../services/notifications';
import { useStore } from '../../store/useStore';
import { colors, radius, spacing } from '../../theme/theme';

const ZEN_MINUTES = [15, 30, 60, 120];

/** Zen session state + the action sheet that starts/ends one. */
export function useZen() {
  const store = useStore();
  const { habits } = store;
  const zenOn = zenActiveAt(store.zen.until);
  const zenEndLabel = store.zen.until
    ? `${String(new Date(store.zen.until).getHours()).padStart(
        2,
        '0',
      )}:${String(new Date(store.zen.until).getMinutes()).padStart(2, '0')}`
    : '';

  /** Start a quiet session: pause our reminders; the App-level effect
   *  raises the Screen Time shield from the new zen end-time. */
  const startZen = (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60000).toISOString();
    store.setZen({ until });
    habits.filter(h => h.reminder?.enabled).forEach(h => cancelReminder(h.id));
    if (store.zen.useFocusShortcut) {
      Linking.openURL('shortcuts://run-shortcut?name=Routiner%20Zen').catch(
        () => {},
      );
    }
  };

  const endZen = () => {
    store.setZen({ until: null });
    if (!store.prefs.vacationMode) {
      resyncReminders(habits);
    }
  };

  const onZenPress = () => {
    if (zenOn) {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Zen until ${zenEndLabel}`,
          options: ['End zen early', 'Keep going'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        i => {
          if (i === 0) {
            endZen();
          }
        },
      );
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Quiet time for…',
        message: 'Reminders pause and your locked apps stay shielded.',
        options: ['15 minutes', '30 minutes', '1 hour', '2 hours', 'Cancel'],
        cancelButtonIndex: 4,
      },
      i => {
        if (i < 4) {
          startZen(ZEN_MINUTES[i]);
        }
      },
    );
  };

  return { zenOn, zenEndLabel, onZenPress };
}

type ChipProps = {
  zenOn: boolean;
  zenEndLabel: string;
  appLocked: boolean;
  habits: Habit[];
};

/** Status pill under the banner: active zen session or App Lock state. */
function ZenControls({ zenOn, zenEndLabel, appLocked, habits }: ChipProps) {
  const appLock = useStore(s => s.appLock);
  if (!zenOn && !appLocked) {
    return null;
  }
  return (
    <View style={styles.lockChip}>
      <AppText variant="alt" color={colors.ink60}>
        {zenOn
          ? `🧘 Zen until ${zenEndLabel} — reminders paused`
          : `🔒 Apps locked ${appLockConditionLabel(appLock, habits)}`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  lockChip: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});

export default ZenControls;
