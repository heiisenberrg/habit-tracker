import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { friends } from '../data/seed';
import { RootStackParamList } from '../navigation/RootNavigator';
import { challengeProgress, useStore } from '../store/useStore';
import {
  colors,
  gradients,
  radius,
  screenPadding,
  spacing,
} from '../theme/theme';

function challengeDates(endsAt: string | undefined, durationDays: number) {
  const end = new Date(endsAt ?? '');
  // Persisted challenges from older versions can miss/corrupt endsAt.
  if (Number.isNaN(end.getTime())) {
    return `${durationDays} day challenge`;
  }
  const start = new Date(end.getTime() - durationDays * 24 * 3600 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${fmt(start)} to ${fmt(end)}`;
}

/** Challenge detail per the Figma "Home & Add Habit" section (blue full-bleed). */
function ChallengeDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ChallengeDetail'>>();
  const insets = useSafeAreaInsets();
  const {
    challenges,
    joinedChallengeIds,
    challengeJoinedOn,
    joinChallenge,
    leaveChallenge,
    addInboxItem,
  } = useStore();

  const challenge = challenges.find(c => c.id === route.params?.id);

  if (!challenge) {
    return (
      <LinearGradient colors={gradients.blue} style={styles.notFound}>
        <AppText variant="h5" color={colors.white} center>
          This challenge is no longer available
        </AppText>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.leaveButton}
        >
          <AppText variant="bodyMedium" color={colors.white}>
            Go back
          </AppText>
        </Pressable>
      </LinearGradient>
    );
  }
  const joined = joinedChallengeIds.includes(challenge.id);
  // Old persisted challenges may miss durationDays; never divide by nothing.
  const durationDays = challenge.durationDays || 7;

  const progress = challengeProgress(
    challengeJoinedOn[challenge.id],
    durationDays,
  );
  const pct = Math.round(progress * 100);
  const day = Math.min(
    durationDays,
    Math.max(1, Math.round(progress * durationDays)),
  );

  const shownFriends = friends.slice(
    0,
    Math.min(challenge.friendsJoined, friends.length),
  );
  const extraFriends = challenge.friendsJoined - shownFriends.length;

  const handleJoin = () => {
    if (joined) {
      return;
    }
    joinChallenge(challenge.id);
    addInboxItem({
      title: 'Challenge joined',
      body: `You joined ${challenge.title} — ${durationDays} days to go. Good luck!`,
    });
  };

  return (
    <LinearGradient
      colors={gradients.blue}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.fill}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <AppText variant="h6" color={colors.white}>
            ‹
          </AppText>
        </Pressable>
        <View style={styles.flex} />
        {!joined && (
          <Pressable onPress={handleJoin} style={styles.headerButton}>
            <AppText variant="h6" color={colors.white}>
              +
            </AppText>
          </Pressable>
        )}
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <AppText style={styles.heroEmoji}>{challenge.emoji}</AppText>
          <AppText variant="h5" color={colors.white} center>
            {challenge.title.replace(/\s*\p{Extended_Pictographic}+\s*$/u, '')}
          </AppText>
          <AppText variant="body" color={colors.blue40} center>
            {challengeDates(challenge.endsAt, durationDays)}
          </AppText>
          <View style={styles.avatarRow}>
            {shownFriends.map((f, i) => (
              <Image
                key={f.id}
                source={f.avatar}
                style={[styles.avatar, i > 0 && styles.avatarOverlap]}
              />
            ))}
            {extraFriends > 0 && (
              <View style={[styles.avatarExtra, styles.avatarOverlap]}>
                <AppText variant="chip" color={colors.white}>
                  +{extraFriends}
                </AppText>
              </View>
            )}
            <AppText
              variant="alt"
              color={colors.blue40}
              style={styles.avatarCount}
            >
              {challenge.friendsJoined}{' '}
              {challenge.friendsJoined === 1 ? 'friend' : 'friends'} joined
            </AppText>
          </View>
        </View>
        <AppText
          variant="body"
          color="rgba(255,255,255,0.85)"
          center
          style={styles.description}
        >
          {challenge.description}
        </AppText>
        {joined ? (
          <View style={styles.progressCard}>
            <View style={styles.progressLabelRow}>
              <AppText variant="chip" color={colors.blue40}>
                Your progress
              </AppText>
              <AppText variant="chip" color={colors.white}>
                Day {day} of {durationDays} · {pct}%
              </AppText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
          </View>
        ) : (
          <Pressable
            onPress={handleJoin}
            style={({ pressed }) => [
              styles.joinButton,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="bodyMedium" color={colors.ink}>
              Join Challenge
            </AppText>
          </Pressable>
        )}
        {(challenge.tasks?.length ?? 0) > 0 && (
          <AppText variant="bodyMedium" color={colors.white}>
            Tasks
          </AppText>
        )}
        <View style={styles.tasks}>
          {/* Persisted challenges saved before `tasks` existed lack it. */}
          {(challenge.tasks ?? []).map((task, i) => (
            <View key={task} style={styles.taskCard}>
              <View style={styles.taskEmoji}>
                <AppText variant="bodyMedium" color={colors.blue}>
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="bodyMedium" style={styles.flex}>
                {task}
              </AppText>
            </View>
          ))}
        </View>
        {joined && (
          <Pressable
            onPress={() =>
              Alert.alert('Leave challenge?', 'Your progress will reset.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: () => leaveChallenge(challenge.id),
                },
              ])
            }
            style={({ pressed }) => [
              styles.leaveButton,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="bodyMedium" color="rgba(255,255,255,0.8)">
              Leave challenge
            </AppText>
          </Pressable>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: screenPadding,
    gap: spacing.lg,
  },
  fill: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: screenPadding, gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  heroEmoji: { fontSize: 48, lineHeight: 56 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  avatarOverlap: { marginLeft: -8 },
  avatarExtra: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCount: { marginLeft: spacing.sm },
  description: { paddingHorizontal: spacing.sm },
  joinButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  leaveButton: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  tasks: { gap: spacing.sm },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  taskEmoji: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.blue10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChallengeDetailScreen;
