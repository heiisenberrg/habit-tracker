import React, { RefObject } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppText from '../AppText';
import TypingDots from './TypingDots';
import {
  colors,
  gradients,
  radius,
  screenPadding,
  spacing,
} from '../../theme/theme';

const logo = require('../../assets/logo.png');

export type Message = { id: string; from: 'bot' | 'me'; text: string };

/** RN types ScrollView as a function component; the ref holds its instance. */
export type ScrollHandle = React.ComponentRef<typeof ScrollView>;

type Props = {
  messages: Message[];
  typing: boolean;
  scrollRef: RefObject<ScrollHandle | null>;
};

/** The chat scrollback: avatar-tagged bot bubbles, gradient user bubbles. */
function ChatTranscript({ messages, typing, scrollRef }: Props) {
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={styles.transcript}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {messages.map(m =>
        m.from === 'bot' ? (
          <View key={m.id} style={styles.botRow}>
            <View style={styles.botAvatar}>
              <Image
                source={logo}
                style={styles.botAvatarImg}
                resizeMode="contain"
              />
            </View>
            <View style={[styles.bubble, styles.botBubble]}>
              <AppText variant="body">{m.text}</AppText>
            </View>
          </View>
        ) : (
          <View key={m.id} style={[styles.bubble, styles.meBubble]}>
            <LinearGradient
              colors={gradients.blue}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.meFill}
            />
            <AppText variant="body" color={colors.white}>
              {m.text}
            </AppText>
          </View>
        ),
      )}
      {typing && (
        <View style={styles.botRow}>
          <View style={styles.botAvatar}>
            <Image
              source={logo}
              style={styles.botAvatarImg}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.bubble, styles.botBubble, styles.typing]}>
            <TypingDots />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  transcript: {
    padding: screenPadding,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    overflow: 'hidden',
  },
  botRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  },
  botAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.blue10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botAvatarImg: { width: 15, height: 15 },
  botBubble: {
    alignSelf: 'flex-start',
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  meBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  meFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  typing: { paddingVertical: spacing.sm },
});

export default ChatTranscript;
