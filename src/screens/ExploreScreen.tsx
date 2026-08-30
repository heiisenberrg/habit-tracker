import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { Card, IconButton, SectionHeader } from '../components/common';
import { TimeCircleIcon } from '../components/icons';
import { clubs, learningArticles } from '../data/seed';
import { challengeProgress, useStore } from '../store/useStore';
import {
  colors,
  gradients,
  radius,
  screenPadding,
  spacing,
} from '../theme/theme';

const SUGGESTED = [
  {
    name: 'Walk',
    emoji: '🚶🏻‍♀️',
    meta: '10 km',
    tint: '#FCDDEC',
    amount: 10,
    unit: 'KM' as const,
    step: 2,
  },
  {
    name: 'Swim',
    emoji: '🏊🏻‍♂️',
    meta: '30 min',
    tint: '#E2E4FC',
    amount: 30,
    unit: 'MIN' as const,
    step: 10,
  },
  {
    name: 'Read',
    emoji: '📕',
    meta: '20 min',
    tint: '#DFF3E2',
    amount: 20,
    unit: 'MIN' as const,
    step: 5,
  },
];

const COLLAPSED_SUGGESTED = 2;
const COLLAPSED_CLUBS = 3;

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) {
    return 'Ended';
  }
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} left`;
  }
  return `${days} ${days === 1 ? 'day' : 'days'} ${hours % 24}h left`;
}

/** Section header whose action toggles between View All and Show less. */
function ToggleHeader({
  title,
  expanded,
  onToggle,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.toggleHeader}>
      <AppText variant="bodyMedium" style={styles.flex}>
        {title}
      </AppText>
      <Pressable onPress={onToggle} hitSlop={8}>
        <AppText variant="chip" color={colors.blue}>
          {expanded ? 'Show less' : 'View All'}
        </AppText>
      </Pressable>
    </View>
  );
}

/** Explore per the Figma Explore screen. */
function ExploreScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { challenges, addHabit, joinedChallengeIds, challengeJoinedOn } =
    useStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAllSuggested, setShowAllSuggested] = useState(false);
  const [showAllClubs, setShowAllClubs] = useState(false);
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  const toggleSearch = () => {
    if (searchOpen) {
      setQuery('');
    }
    setSearchOpen(!searchOpen);
  };

  const q = query.trim().toLowerCase();
  const searching = searchOpen && q.length > 0;

  const visibleSuggested = searching
    ? SUGGESTED.filter(s => s.name.toLowerCase().includes(q))
    : showAllSuggested
    ? SUGGESTED
    : SUGGESTED.slice(0, COLLAPSED_SUGGESTED);
  const visibleChallenges = searching
    ? challenges.filter(c => c.title.toLowerCase().includes(q))
    : challenges;
  const visibleClubs = showAllClubs ? clubs : clubs.slice(0, COLLAPSED_CLUBS);
  const article = learningArticles.find(a => a.title === openArticle);

  const addSuggested = (s: (typeof SUGGESTED)[number]) => {
    addHabit({
      id: `${s.name.toLowerCase()}-${Date.now()}`,
      name: s.name,
      emoji: s.emoji,
      type: 'good',
      goal: { amount: s.amount, unit: s.unit },
      step: s.step,
      friendIds: [],
      tracking: 'count',
      kind: 'build',
    });
    navigation.navigate('Success', {
      title: `${s.name} added to your habits!`,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <AppText variant="h5" style={styles.flex}>
            Explore
          </AppText>
          <IconButton size={44} onPress={toggleSearch}>
            <AppText variant="body">{searchOpen ? '✕' : '🔍'}</AppText>
          </IconButton>
        </View>
        {searchOpen && (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search suggestions and challenges"
            placeholderTextColor={colors.ink40}
            style={styles.searchInput}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
        )}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 140 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {searching &&
          visibleSuggested.length === 0 &&
          visibleChallenges.length === 0 && (
            <AppText variant="body" color={colors.ink60} center>
              No suggestions or challenges match “{query.trim()}”.
            </AppText>
          )}

        {visibleSuggested.length > 0 && (
          <>
            {searching ? (
              <SectionHeader title="Suggested for You" />
            ) : (
              <ToggleHeader
                title="Suggested for You"
                expanded={showAllSuggested}
                onToggle={() => setShowAllSuggested(!showAllSuggested)}
              />
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hRow}
            >
              {visibleSuggested.map(s => (
                <Pressable
                  key={s.name}
                  onPress={() => addSuggested(s)}
                  style={[styles.suggestCard, { backgroundColor: s.tint }]}
                >
                  <View style={styles.emojiChip}>
                    <AppText variant="body">{s.emoji}</AppText>
                  </View>
                  <AppText variant="bodyMedium">{s.name}</AppText>
                  <AppText variant="alt" color={colors.ink60}>
                    {s.meta}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        {!searching && (
          <>
            <ToggleHeader
              title="Habit Clubs"
              expanded={showAllClubs}
              onToggle={() => setShowAllClubs(!showAllClubs)}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hRow}
            >
              {visibleClubs.map(c => (
                <Card key={c.name} style={styles.clubCard}>
                  <View style={styles.emojiChip}>
                    <AppText variant="body">{c.emoji}</AppText>
                  </View>
                  <AppText variant="bodyMedium">{c.name}</AppText>
                </Card>
              ))}
            </ScrollView>
          </>
        )}

        {visibleChallenges.length > 0 && (
          <>
            <SectionHeader title="Challenges" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hRow}
            >
              {visibleChallenges.map(c => {
                const joined = joinedChallengeIds.includes(c.id);
                const progress = joined
                  ? challengeProgress(challengeJoinedOn[c.id], c.durationDays)
                  : c.progress;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() =>
                      navigation.navigate('ChallengeDetail', { id: c.id })
                    }
                  >
                    <View style={styles.challengeCard}>
                      <LinearGradient
                        colors={gradients.blue}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientFill}
                      />
                      <View style={styles.challengeTop}>
                        <View style={styles.challengeClock}>
                          <TimeCircleIcon size={18} />
                        </View>
                        {joined && (
                          <View style={styles.joinedChip}>
                            <AppText variant="chip" color={colors.white}>
                              Joined
                            </AppText>
                          </View>
                        )}
                      </View>
                      <AppText variant="bodyMedium" color={colors.white}>
                        {c.title}
                      </AppText>
                      <AppText variant="chip" color={colors.blue40}>
                        {timeLeft(c.endsAt)}
                      </AppText>
                      {joined ? (
                        <>
                          <View style={styles.progressTrack}>
                            <View
                              style={[
                                styles.progressFill,
                                { width: `${progress * 100}%` },
                              ]}
                            />
                          </View>
                          <AppText variant="chip" color={colors.blue40}>
                            Your progress {Math.round(progress * 100)}%
                          </AppText>
                        </>
                      ) : (
                        <AppText variant="chip" color={colors.blue40}>
                          {c.durationDays}-day challenge
                        </AppText>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        )}

        {!searching && (
          <>
            <SectionHeader title="Learning" />
            <View style={styles.learnRow}>
              {learningArticles.map(a => {
                const open = a.title === openArticle;
                return (
                  <Pressable
                    key={a.title}
                    onPress={() => setOpenArticle(open ? null : a.title)}
                    style={({ pressed }) => [
                      styles.learnCard,
                      pressed && styles.pressedCard,
                    ]}
                  >
                    <View style={styles.learnImage}>
                      <LinearGradient
                        colors={['#AFB4FF', '#5D66FF']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientFill}
                      />
                      <AppText style={styles.learnEmoji}>{a.emoji}</AppText>
                    </View>
                    <View style={styles.learnCaption}>
                      <AppText variant="alt" color={colors.white}>
                        📁 {a.title}
                      </AppText>
                      <AppText variant="chip" color={colors.blue40}>
                        {open ? 'Tap to close' : 'Tap to read'}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {article && (
              <Card style={styles.readerCard}>
                <AppText variant="bodyMedium">
                  {article.emoji} {article.title}
                </AppText>
                <AppText variant="body" color={colors.ink60}>
                  {article.body}
                </AppText>
              </Card>
            )}
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
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: screenPadding,
    paddingBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.ink,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  hRow: { gap: spacing.sm, paddingRight: spacing.lg },
  suggestCard: {
    width: 128,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emojiChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  clubCard: { width: 128, gap: spacing.xs, padding: spacing.md },
  challengeCard: {
    width: 210,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  gradientFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  challengeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  challengeClock: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinedChip: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: spacing.xs,
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.surface },
  learnRow: { flexDirection: 'row', gap: spacing.sm },
  learnCard: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  pressedCard: { opacity: 0.85 },
  learnImage: { height: 96, alignItems: 'center', justifyContent: 'center' },
  learnEmoji: { fontSize: 40, lineHeight: 48 },
  learnCaption: {
    backgroundColor: colors.blue,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  readerCard: { gap: spacing.sm },
});

export default ExploreScreen;
