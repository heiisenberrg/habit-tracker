import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, screenPadding, spacing } from '../../theme/theme';
import AppText from '../AppText';

type Props = {
  visible: boolean;
  /** The trip's current manual total, or null when it adds up its items. */
  initial: number | null;
  onSave: (total: number) => void;
  onClear: () => void;
  onClose: () => void;
};

/** "1,15" and "1.15" are the same number at a checkout. */
export const parseMoney = (raw: string): number => {
  const n = Number(raw.replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Receipt total in a sheet rather than inline: a decimal-pad has no return
 * key, so an inline field's Save button ends up under the keyboard and the
 * sticky total bar with no way to reach it.
 */
function ReceiptTotalSheet({
  visible,
  initial,
  onSave,
  onClear,
  onClose,
}: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (visible) {
      setValue(initial != null ? String(initial) : '');
    }
  }, [visible, initial]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Not an accessible container: it would swallow the sheet's controls. */}
        <Pressable accessible={false} style={styles.backdrop} onPress={onClose}>
          <View style={styles.sheet}>
            <AppText variant="title">Receipt total</AppText>
            <AppText variant="alt" color={colors.ink60}>
              Overrides the item sum for this shop. Clear it to go back to
              adding up items.
            </AppText>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              autoFocus
              placeholder="€ total"
              placeholderTextColor={colors.ink40}
              style={styles.input}
              accessibilityLabel="Receipt total in euros"
              testID="lump-total"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save receipt total"
              onPress={() => onSave(parseMoney(value))}
              style={({ pressed }) => [styles.save, pressed && styles.pressed]}
            >
              <AppText variant="bodyMedium" color={colors.white}>
                Save
              </AppText>
            </Pressable>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear receipt total"
                onPress={onClear}
                style={styles.ghost}
              >
                <AppText variant="bodyMedium" color={colors.ink60}>
                  Clear
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
                style={styles.ghost}
              >
                <AppText variant="bodyMedium" color={colors.ink60}>
                  Cancel
                </AppText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,4,21,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: screenPadding,
    paddingBottom: spacing.xl,
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
  save: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  ghost: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.75 },
});

export default ReceiptTotalSheet;
