import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../theme';
import { colors as tColors } from '../theme/tokens';
import { useApp } from '../context/AppContext';
import { Sparkles } from 'lucide-react-native';

const isValidPassword = (pwd) =>
  pwd.length >= 6 && /[0-9]/.test(pwd) && /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);

export default function ResetPasswordScreen() {
  const { resetPassword } = useApp();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    setError('');
    if (!isValidPassword(password)) {
      setError('Min 6 characters · at least one number · at least one special character.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(password);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoBox}>
          <Sparkles size={22} color="#fff" />
        </View>

        {done ? (
          <>
            <Text style={styles.heading}>Password updated</Text>
            <Text style={styles.sub}>Your password has been changed. Please sign in with your new password.</Text>
          </>
        ) : (
          <>
            <Text style={styles.heading}>Set new password</Text>
            <Text style={styles.sub}>Choose a strong password for your account.</Text>

            <Text style={styles.label}>NEW PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={v => { setPassword(v); setError(''); }}
              placeholder="New password"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <TextInput
              value={confirm}
              onChangeText={v => { setConfirm(v); setError(''); }}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.hint}>Min 6 characters · at least one number · at least one special character</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Update Password →</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1, padding: spacing.xl, paddingTop: spacing.xxl,
    justifyContent: 'center',
  },
  logoBox: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xl, alignSelf: 'center',
  },
  logoIcon: { color: '#fff', fontSize: 26, fontWeight: '700' },
  heading: { fontSize: 26, ...font.bold, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl, textAlign: 'center' },
  label: { fontSize: 10, color: colors.textSecondary, letterSpacing: 0.8, ...font.bold, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.textPrimary, fontSize: 15,
    marginBottom: spacing.md,
  },
  hint: { fontSize: 11, color: colors.textTertiary, marginBottom: spacing.lg, marginTop: -spacing.xs },
  errorText: { fontSize: 13, color: tColors.error, marginBottom: spacing.sm },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnText: { color: '#fff', fontSize: 16, ...font.bold },
});
