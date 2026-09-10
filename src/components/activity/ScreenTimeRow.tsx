import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import AppText from '../AppText';
import {
  getScreenTimeState,
  getTodayScreenTime,
  requestScreenTimeAccess,
  ScreenTimeReport,
} from '../../services/screenTime';
import { colors, spacing } from '../../theme/theme';

/**
 * Wellbeing card → "Pickups & social apps" (Android only).
 *
 * iOS renders nothing: Apple draws those numbers inside its own sandboxed
 * extension and the entitlement to host it was refused, so there is no row
 * to show. Android hands them over through UsageStatsManager, behind the
 * "Usage access" special permission that only system Settings can grant —
 * hence the re-check on focus and on returning from the background.
 *
 * Display only: the Wellbeing score never reads these (see ActivityScreen).
 */
function ScreenTimeRow() {
  return Platform.OS === 'android' ? <AndroidScreenTimeRow /> : null;
}

/** The value line reads as one sentence: "12 pickups · 48 min social · 2h 10m total". */
export const summaryLine = (r: ScreenTimeReport): string =>
  `${r.pickups} ${r.pickups === 1 ? 'pickup' : 'pickups'} · ${fmtMinutes(
    r.socialMinutes,
  )} social · ${fmtMinutes(r.totalMinutes)} total`;

/** Whole minutes under an hour, "2h 05m" past it — same shape as the sleep row. */
export const fmtMinutes = (m: number): string =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

function AndroidScreenTimeRow() {
  // `authorized` is null until the first check lands, so the row does not
  // flash the permission prompt at someone who already granted it.
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [report, setReport] = useState<ScreenTimeReport | null>(null);
  const [open, setOpen] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const state = await getScreenTimeState();
    const next = state.authorized ? await getTodayScreenTime() : null;
    if (!mounted.current) {
      return;
    }
    setAuthorized(state.authorized);
    setReport(next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Coming back from the Usage access page is an AppState change, not a
  // navigation event — without this the grant would not show until the
  // next visit to the tab.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const value =
    authorized == null
      ? 'Checking Usage access…'
      : !authorized
      ? 'Turn on Usage access'
      : report
      ? summaryLine(report)
      : 'No app time yet today';
  const expandable = !!authorized && !!report;

  const onPress = () => {
    if (authorized === false) {
      requestScreenTimeAccess();
    } else if (expandable) {
      setOpen(o => !o);
    }
  };

  return (
    <View style={styles.block}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          authorized === false
            ? 'Pickups & social apps — turn on Usage access'
            : `Pickups & social apps, ${value}`
        }
        accessibilityHint={
          authorized === false
            ? 'Opens the system Usage access page'
            : expandable
            ? open
              ? 'Hides the top apps'
              : 'Shows the top apps'
            : undefined
        }
        accessibilityState={expandable ? { expanded: open } : undefined}
        onPress={onPress}
        style={styles.wbRow}
      >
        <AppText variant="body">📵</AppText>
        <View style={styles.flex}>
          <AppText variant="bodyMedium">Pickups & social apps</AppText>
          <AppText
            variant="alt"
            color={authorized === false ? colors.blue : colors.ink60}
          >
            {value}
          </AppText>
        </View>
        {expandable && (
          <AppText variant="body" color={colors.ink40}>
            {open ? '⌃' : '⌄'}
          </AppText>
        )}
      </Pressable>

      {open && report && (
        <View style={styles.apps}>
          {report.topApps.length === 0 ? (
            <AppText variant="alt" color={colors.ink60}>
              No app has reached a minute yet
            </AppText>
          ) : (
            report.topApps.map(app => (
              // No controls inside — one TalkBack element per app so it reads
              // "Instagram · 42 min" as a sentence.
              <View key={app.packageName} style={styles.appRow} accessible>
                <AppText
                  variant="alt"
                  color={colors.ink60}
                  style={styles.flex}
                  numberOfLines={1}
                >
                  {app.label}
                </AppText>
                <AppText variant="alt" color={colors.ink60}>
                  {fmtMinutes(app.minutes)}
                </AppText>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// wbRow/flex mirror ActivityScreen's Wellbeing rows so this one sits flush
// with the sleep row above it (the screen does not export its styles).
const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  wbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  // Indented past the emoji column so the list reads as the row's detail.
  apps: { paddingLeft: spacing.xxl, gap: spacing.xs },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});

export default ScreenTimeRow;
