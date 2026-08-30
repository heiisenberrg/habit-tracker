import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton, SegmentControl } from '../components/common';
import { SettingsIcon } from '../components/icons';
import { deriveAchievements, deriveFeed } from '../data/profileFeed';
import { dayStreak, karma, perfectDayCount, useStore } from '../store/useStore';
import { colors, radius, screenPadding, spacing } from '../theme/theme';

/** Profile per Figma "Profile & Settings": Activity | Achievements. */
function ProfileScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const points = karma(store);
  const [tab, setTab] = useState(0);
  const [oldestFirst, setOldestFirst] = useState(false);

  const feed = useMemo(() => {
    const events = deriveFeed(store);
    return oldestFirst ? [...events].reverse() : events;
  }, [store, oldestFirst]);

  const achievements = useMemo(
    () => deriveAchievements(store, dayStreak(store), perfectDayCount(store)),
    [store],
  );
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <AppText variant="h5" style={styles.flex}>
            Your Profile
          </AppText>
          <IconButton size={44} onPress={() => navigation.navigate('Settings')}>
            <SettingsIcon size={22} />
          </IconButton>
        </View>
        <View style={styles.userRow}>
          <View style={[styles.avatar, styles.avatarFallback]}>
            <AppText variant="h5" color={colors.blue}>
              {(
                `${store.user.name[0] ?? ''}${store.user.surname[0] ?? ''}` ||
                '☺'
              ).toUpperCase()}
            </AppText>
          </View>
          <View style={styles.userText}>
            <AppText variant="title">
              {[store.user.name, store.user.surname]
                .filter(Boolean)
                .join(' ') || 'Your profile'}
            </AppText>
            {!!store.user.email && (
              <AppText variant="alt" color={colors.ink40}>
                {store.user.email}
              </AppText>
            )}
            {!!store.user.birthdate && (
              <AppText variant="alt" color={colors.ink40}>
                🎂 {store.user.birthdate}
              </AppText>
            )}
            <View style={styles.pointsChip}>
              <AppText variant="alt" color="#B7791F">
                🏅 {points} Points
              </AppText>
            </View>
          </View>
        </View>
        <SegmentControl
          tabs={['Activity', 'Achievements']}
          active={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 140 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {tab === 0 && (
          <>
            <View style={styles.captionRow}>
              <AppText variant="body" color={colors.ink40} style={styles.flex}>
                Showing last 30 days
              </AppText>
              <IconButton size={32} onPress={() => setOldestFirst(v => !v)}>
                <AppText variant="alt" color={colors.ink60}>
                  ⇅
                </AppText>
              </IconButton>
            </View>
            {feed.length === 0 && (
              <AppText variant="body" color={colors.ink40}>
                No activity yet — complete a habit and it will show up here.
              </AppText>
            )}
            {feed.map(f => (
              <Card key={f.id} style={styles.rowCard}>
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">{f.title}</AppText>
                  <AppText variant="alt" color={colors.ink40}>
                    {f.when}
                  </AppText>
                </View>
                <View style={[styles.iconChip, { backgroundColor: f.tint }]}>
                  <AppText variant="bodyMedium" color={f.color}>
                    {f.icon}
                  </AppText>
                </View>
              </Card>
            ))}
          </>
        )}

        {tab === 1 && (
          <>
            <AppText variant="body" color={colors.ink40}>
              {unlockedCount} of {achievements.length} unlocked
            </AppText>
            {achievements.map(a => (
              <Card
                key={a.id}
                style={
                  a.unlocked ? styles.rowCard : [styles.rowCard, styles.locked]
                }
              >
                <View style={[styles.iconChip, { backgroundColor: a.tint }]}>
                  <AppText variant="body">{a.icon}</AppText>
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">{a.title}</AppText>
                  <AppText variant="alt" color={colors.ink40}>
                    {a.detail}
                  </AppText>
                </View>
                <AppText
                  variant="chip"
                  color={a.unlocked ? colors.green : colors.ink40}
                >
                  {a.unlocked ? 'Unlocked' : 'Locked'}
                </AppText>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    backgroundColor: colors.info10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userText: { gap: spacing.xs },
  pointsChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3D6',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    alignSelf: 'stretch',
  },
  locked: { opacity: 0.55 },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProfileScreen;
