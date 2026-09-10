/**
 * Cross-platform action sheet.
 *
 *  - iOS: delegates to ActionSheetIOS (native sheet).
 *  - Android: a themed bottom sheet rendered by <ActionSheetHost/>, which
 *    App.tsx mounts once. React Native's ActionSheetIOS throws an invariant
 *    on Android ("ActionSheetManager doesn't exist"), so nothing may call it
 *    directly outside this file.
 *
 * The API is imperative on purpose — callers are often plain handlers, not
 * components — so `showActionSheet` hands the request to a module-level
 * listener that the mounted host subscribes to. Dismissing the Android
 * sheet by backdrop tap or the back button reports `cancelButtonIndex`,
 * matching what ActionSheetIOS does for an outside tap.
 */
import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme/theme';
import AppText from './AppText';

export type ActionSheetOptions = {
  title?: string;
  message?: string;
  options: string[];
  cancelButtonIndex?: number;
  destructiveButtonIndex?: number;
};

type Request = {
  opts: ActionSheetOptions;
  onSelect: (index: number) => void;
};

let listener: ((req: Request) => void) | null = null;

/**
 * The index a dismissal reports. Without a cancel button there is no option
 * to attribute it to, so use one past the end — `options[i]` is undefined
 * and every `i === n` / `i < n` guard callers write stays false.
 */
const cancelIndexOf = (opts: ActionSheetOptions): number =>
  opts.cancelButtonIndex ?? opts.options.length;

export const showActionSheet = (
  opts: ActionSheetOptions,
  onSelect: (index: number) => void,
): void => {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(opts, onSelect);
    return;
  }
  if (listener) {
    listener({ opts, onSelect });
    return;
  }
  // No host mounted (a test, or a call before App rendered): don't strand
  // the caller's pending state — answer as a dismissal.
  if (__DEV__) {
    console.warn('showActionSheet: <ActionSheetHost/> is not mounted');
  }
  onSelect(cancelIndexOf(opts));
};

/** Mount once near the root (inside SafeAreaProvider); renders the Android sheet. */
export function ActionSheetHost(): React.JSX.Element | null {
  const [req, setReq] = useState<Request | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    listener = setReq;
    return () => {
      if (listener === setReq) {
        listener = null;
      }
    };
  }, []);

  if (Platform.OS === 'ios') {
    return null;
  }

  const finish = (index: number) => {
    const current = req;
    setReq(null);
    current?.onSelect(index);
  };
  const cancelIndex = req ? cancelIndexOf(req.opts) : -1;
  const opts = req?.opts;
  const hasHeader = !!(opts?.title || opts?.message);
  const cancelLabel =
    opts && opts.cancelButtonIndex != null
      ? opts.options[opts.cancelButtonIndex]
      : undefined;

  return (
    <Modal
      visible={req != null}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => finish(cancelIndex)}
    >
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={() => finish(cancelIndex)}
      >
        {/* The sheet swallows presses so a tap inside never hits the backdrop. */}
        <Pressable
          style={[styles.sheet, { marginBottom: insets.bottom + spacing.md }]}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          {opts && (
            <View style={styles.card}>
              {hasHeader && (
                <View style={[styles.header, styles.rowBorder]}>
                  {!!opts.title && (
                    <AppText variant="bodyMedium" color={colors.ink60} center>
                      {opts.title}
                    </AppText>
                  )}
                  {!!opts.message && (
                    <AppText
                      variant="alt"
                      color={colors.ink60}
                      center
                      style={!!opts.title && styles.message}
                    >
                      {opts.message}
                    </AppText>
                  )}
                </View>
              )}
              {opts.options.map((label, i) => {
                if (i === opts.cancelButtonIndex) {
                  return null;
                }
                const destructive = i === opts.destructiveButtonIndex;
                const last =
                  i === opts.options.length - 1 ||
                  (i === opts.options.length - 2 &&
                    opts.cancelButtonIndex === opts.options.length - 1);
                return (
                  <Pressable
                    key={`${i}-${label}`}
                    testID={`action-sheet-option-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    onPress={() => finish(i)}
                    style={({ pressed }) => [
                      styles.row,
                      !last && styles.rowBorder,
                      pressed && styles.rowPressed,
                    ]}
                  >
                    <AppText
                      variant="body"
                      color={destructive ? colors.red : colors.ink}
                      center
                    >
                      {label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          )}
          {cancelLabel != null && (
            <Pressable
              testID="action-sheet-cancel"
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={() => finish(cancelIndex)}
              style={({ pressed }) => [
                styles.card,
                styles.cancel,
                styles.row,
                pressed && styles.rowPressed,
              ]}
            >
              <AppText variant="bodyMedium" center>
                {cancelLabel}
              </AppText>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    marginHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cancel: {
    marginTop: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  message: {
    marginTop: spacing.xs,
  },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.info10,
  },
});
