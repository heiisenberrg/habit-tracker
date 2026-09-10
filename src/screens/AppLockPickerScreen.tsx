import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { IconButton } from '../components/common';
import {
  applyAppLock,
  getLockedApps,
  InstalledApp,
  listInstalledApps,
  setLockedApps,
} from '../services/appLock';
import { useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

const ROW_HEIGHT = 64;

/**
 * Android App Lock: pick the installed apps to shield. The Android
 * counterpart of the iOS FamilyActivityPicker sheet — same "Lock these
 * apps" title and Done semantics, but a plain list of launchable apps
 * because Android has no system picker. Route name: 'AppLockPicker'.
 */
function AppLockPickerScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const appLock = useStore(st => st.appLock);
  const habits = useStore(st => st.habits);
  const completions = useStore(st => st.completions);
  const statuses = useStore(st => st.statuses);
  const zenUntil = useStore(st => st.zen.until);

  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([listInstalledApps(), getLockedApps()]).then(
      ([list, locked]) => {
        if (!alive) {
          return;
        }
        setApps(list);
        setSelected(new Set(locked));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!apps) {
      return [];
    }
    const q = query.trim().toLowerCase();
    if (!q) {
      return apps;
    }
    return apps.filter(
      a =>
        a.label.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q),
    );
  }, [apps, query]);

  const toggle = useCallback((packageName: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(packageName)) {
        next.delete(packageName);
      } else {
        next.add(packageName);
      }
      return next;
    });
  }, []);

  const onDone = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    await setLockedApps([...selected]);
    // Re-evaluate with the current prefs so a shield that is already meant
    // to be up covers the new set immediately.
    await applyAppLock(appLock, habits, completions, statuses, zenUntil);
    navigation.goBack();
  };

  const renderItem = useCallback(
    ({ item }: { item: InstalledApp }) => {
      const checked = selected.has(item.packageName);
      return (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={item.label}
          onPress={() => toggle(item.packageName)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          {item.icon ? (
            <Image source={{ uri: item.icon }} style={styles.icon} />
          ) : (
            <View style={[styles.icon, styles.iconFallback]}>
              <AppText variant="bodyMedium" color={colors.ink60}>
                {item.label.slice(0, 1).toUpperCase()}
              </AppText>
            </View>
          )}
          <View style={styles.flex}>
            <AppText variant="bodyMedium" numberOfLines={1}>
              {item.label}
            </AppText>
            <AppText variant="alt" color={colors.ink40} numberOfLines={1}>
              {item.packageName}
            </AppText>
          </View>
          <View style={[styles.checkbox, checked && styles.checkboxOn]}>
            {checked && (
              <AppText variant="alt" color={colors.white}>
                ✓
              </AppText>
            )}
          </View>
        </Pressable>
      );
    },
    [selected, toggle],
  );

  const doneDisabled = saving || apps === null;

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
        <AppText variant="h6" style={styles.flex} numberOfLines={1}>
          Lock these apps
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          accessibilityState={{ disabled: doneDisabled }}
          disabled={doneDisabled}
          onPress={onDone}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AppText
            variant="bodyMedium"
            color={doneDisabled ? colors.ink40 : colors.blue}
          >
            Done
          </AppText>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search apps"
          placeholderTextColor={colors.ink40}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search apps"
        />
        <AppText variant="alt" color={colors.ink60}>
          {selected.size === 0
            ? 'Pick the apps to shield until you earn them'
            : `${selected.size} app${selected.size === 1 ? '' : 's'} locked`}
        </AppText>
      </View>

      {apps === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
          <AppText variant="alt" color={colors.ink60}>
            Loading apps…
          </AppText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={a => a.packageName}
          renderItem={renderItem}
          extraData={selected}
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * index,
            index,
          })}
          initialNumToRender={16}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          ListEmptyComponent={
            <View style={styles.center}>
              <AppText variant="alt" color={colors.ink60}>
                {apps.length === 0
                  ? 'No launchable apps found'
                  : 'No apps match your search'}
              </AppText>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  searchWrap: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  input: {
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.ink,
  },
  list: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.md,
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  icon: { width: 40, height: 40, borderRadius: 10 },
  iconFallback: {
    backgroundColor: colors.ink10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: screenPadding,
  },
});

export default AppLockPickerScreen;
