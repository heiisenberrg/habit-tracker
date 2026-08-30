import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import AppText from '../AppText';
import { StepInput } from '../../data/assistantFlows';
import { colors, radius, spacing } from '../../theme/theme';

/** Reusable quick-reply chip row (flow chips, end chips, quick-log picks). */
export function ChipRow({
  options,
  onPick,
}: {
  options: { label: string; value: string; ghost?: boolean }[];
  onPick: (value: string, label: string) => void;
}) {
  return (
    <View style={styles.chipsWrap}>
      {options.map(o => (
        <Pressable
          key={o.value}
          onPress={() => onPick(o.value, o.label)}
          style={({ pressed }) => [
            styles.chip,
            o.ghost && styles.chipGhost,
            pressed && styles.pressed,
          ]}
        >
          <AppText
            variant="bodyMedium"
            color={o.ghost ? colors.ink60 : colors.blue}
          >
            {o.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

type Props = {
  input: StepInput;
  customTime: boolean;
  draft: string;
  placeholderOverride?: string;
  onChangeDraft: (text: string) => void;
  onSubmitDraft: () => void;
  onAnswer: (value: string, label?: string) => void;
  onCustomTime: () => void;
};

/** Renders the right input control for the current flow step. */
function FlowInput({
  input,
  customTime,
  draft,
  placeholderOverride,
  onChangeDraft,
  onSubmitDraft,
  onAnswer,
  onCustomTime,
}: Props) {
  if (input.kind === 'text' || customTime) {
    return (
      <View style={styles.textRow}>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={
            customTime
              ? 'HH:MM'
              : placeholderOverride ??
                (input.kind === 'text' ? input.placeholder : '')
          }
          placeholderTextColor={colors.ink20}
          autoFocus
          onSubmitEditing={onSubmitDraft}
          returnKeyType="send"
          style={styles.textInput}
        />
        <Pressable onPress={onSubmitDraft} style={styles.sendButton}>
          <AppText variant="bodyMedium" color={colors.white}>
            ↑
          </AppText>
        </Pressable>
      </View>
    );
  }
  if (input.kind === 'emoji') {
    return (
      <View style={styles.chipsWrap}>
        {input.options.map(e => (
          <Pressable
            key={e}
            onPress={() => onAnswer(e)}
            style={({ pressed }) => [
              styles.emojiChip,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="title">{e}</AppText>
          </Pressable>
        ))}
      </View>
    );
  }
  if (input.kind === 'time') {
    return (
      <ChipRow
        options={[
          ...input.options.map(t => ({ label: t, value: t })),
          { label: 'Custom…', value: '__custom__', ghost: true },
        ]}
        onPick={v => (v === '__custom__' ? onCustomTime() : onAnswer(v))}
      />
    );
  }
  return (
    <ChipRow options={input.options} onPick={(v, label) => onAnswer(v, label)} />
  );
}

const styles = StyleSheet.create({
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.blue40,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipGhost: { borderColor: colors.border },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  textInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});

export default FlowInput;
