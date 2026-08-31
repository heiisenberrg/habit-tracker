import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from '../components/AppText';
import { IconButton, PrimaryButton } from '../components/common';
import { useStore } from '../store/useStore';
import { colors, screenPadding, spacing } from '../theme/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EmailAuthScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const setUser = useStore(s => s.setUser);
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);

  const trimmed = email.trim();
  const valid = EMAIL_RE.test(trimmed);
  const showError = trimmed.length > 0 && !valid;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <View style={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.header}>
          <IconButton
            size={40}
            accessibilityLabel="Back"
            onPress={() => navigation.goBack()}
          >
            <AppText variant="h6">‹</AppText>
          </IconButton>
          <AppText variant="h6">Continue with E-mail</AppText>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <AppText variant="chip" color={colors.ink40}>
              E-mail
            </AppText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.ink20}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[
                styles.input,
                focused && styles.inputFocused,
                showError && styles.inputError,
              ]}
            />
            {showError && (
              <AppText variant="alt" color={colors.red}>
                Enter a valid e-mail address
              </AppText>
            )}
          </View>
          <AppText variant="alt" color={colors.ink40}>
            Your e-mail is only used for your profile — it never leaves this
            device.
          </AppText>
        </View>

        <View style={styles.flex} />

        <PrimaryButton
          label="Continue"
          disabled={!valid}
          onPress={() => {
            setUser({ email: trimmed });
            navigation.navigate('CreateAccount');
          }}
          style={{ marginBottom: Math.max(insets.bottom, spacing.lg) }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1, paddingHorizontal: screenPadding, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  form: { gap: spacing.lg },
  field: { gap: spacing.xs },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocused: { borderBottomColor: colors.blue },
  inputError: { borderBottomColor: colors.red },
  flex: { flex: 1 },
});

export default EmailAuthScreen;
