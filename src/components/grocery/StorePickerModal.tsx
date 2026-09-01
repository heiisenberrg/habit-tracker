import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Store } from '../../data/grocery';
import { colors, radius, screenPadding, spacing } from '../../theme/theme';
import AppText from '../AppText';

type Props = {
  visible: boolean;
  title: string;
  stores: Store[];
  /** Highlighted row, e.g. the trip's current store. */
  selectedId?: string;
  onSelect: (storeId: string) => void;
  onClose: () => void;
  onManage?: () => void;
};

/** Bottom sheet of active stores — the one tap between "go shop" and shopping. */
function StorePickerModal({
  visible,
  title,
  stores,
  selectedId,
  onSelect,
  onClose,
  onManage,
}: Props) {
  const active = stores.filter(s => !s.archived);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/*
        The backdrop must NOT be an accessible container: iOS merges every
        child of one into a single element, which hides the store rows from
        VoiceOver (and from the e2e driver). Closing lives on the Cancel row.
      */}
      <Pressable accessible={false} style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <AppText variant="title">{title}</AppText>
          {active.length === 0 && (
            <AppText variant="body" color={colors.ink60}>
              No stores yet — add one first.
            </AppText>
          )}
          {active.map(store => (
            <Pressable
              key={store.id}
              accessibilityRole="button"
              accessibilityLabel={store.name}
              accessibilityState={{ selected: store.id === selectedId }}
              onPress={() => onSelect(store.id)}
              style={({ pressed }) => [
                styles.row,
                store.id === selectedId && styles.rowSelected,
                pressed && styles.pressed,
              ]}
            >
              <AppText variant="bodyMedium">{store.name}</AppText>
              {store.id === selectedId && (
                <AppText variant="bodyMedium" color={colors.blue}>
                  ✓
                </AppText>
              )}
            </Pressable>
          ))}
          {onManage && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Manage stores"
              onPress={onManage}
              hitSlop={8}
            >
              <AppText variant="bodyMedium" color={colors.blue} center>
                Manage stores
              </AppText>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            hitSlop={8}
          >
            <AppText variant="bodyMedium" color={colors.ink60} center>
              Cancel
            </AppText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: spacing.xxl + spacing.lg,
    gap: spacing.sm,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.blue, backgroundColor: colors.blue10 },
  pressed: { opacity: 0.7 },
});

export default StorePickerModal;
