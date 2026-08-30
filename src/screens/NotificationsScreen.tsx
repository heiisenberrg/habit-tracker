import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton } from '../components/common';
import { timeAgo } from '../data/profileFeed';
import { useStore } from '../store/useStore';
import { colors, screenPadding, spacing } from '../theme/theme';

const logo = require('../assets/logo.png');

/** In-app notification center rendering the real store inbox. */
function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const inbox = useStore(s => s.inbox);

  // Snapshot which items were unread when the screen opened so their dots stay
  // visible for this viewing, then mark everything read (clears the bell badge).
  const unreadAtOpen = useRef(
    new Set(inbox.filter(i => !i.read).map(i => i.id)),
  ).current;
  useEffect(() => {
    useStore.getState().markInboxRead();
  }, []);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton size={40} onPress={() => navigation.goBack()}>
          <AppText variant="h6">‹</AppText>
        </IconButton>
        <AppText variant="h6">Notifications</AppText>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {inbox.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="h5">🔔</AppText>
            <AppText variant="bodyMedium">You're all caught up!</AppText>
            <AppText variant="body" color={colors.ink60} center>
              Reminders, streak milestones and weather heads-ups will land here.
            </AppText>
          </View>
        ) : (
          inbox.map(n => (
            <Card key={n.id} style={styles.card}>
              <View style={styles.logoChip}>
                <Image source={logo} style={styles.logo} resizeMode="contain" />
              </View>
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  <AppText variant="bodyMedium" style={styles.flex}>
                    {n.title}
                  </AppText>
                  <AppText variant="alt" color={colors.ink40}>
                    {timeAgo(n.at)}
                  </AppText>
                </View>
                <AppText variant="alt" color={colors.ink60}>
                  {n.body}
                </AppText>
              </View>
              {unreadAtOpen.has(n.id) && <View style={styles.dot} />}
            </Card>
          ))
        )}
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
  content: { padding: screenPadding, gap: spacing.sm },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  logoChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 24, height: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
    marginTop: 6,
  },
});

export default NotificationsScreen;
