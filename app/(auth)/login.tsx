import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import TopoBackground from '../../components/TopoBackground';
import { colors, fonts, spacing, radius, typography } from '../../lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  async function signIn() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      router.replace('/');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopoBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Text style={styles.title}>Welcome to the Club</Text>
        <Text style={styles.sub}>Sign in to access your membership</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.gray}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.gray}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, (!email.trim() || !password || loading) && { opacity: 0.5 }]}
          onPress={signIn}
          disabled={!email.trim() || !password || loading}
        >
          <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/signup')} style={styles.linkBtn}>
          <Text style={styles.linkText}>
            Not a member yet? <Text style={{ color: colors.gold, fontFamily: fonts.bodySemiBold }}>Request access</Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  title: { ...typography.h1, fontSize: 32, textAlign: 'center', letterSpacing: 0.4 },
  sub: { ...typography.bodyMuted, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xxl },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.offWhite,
    marginBottom: spacing.sm,
  },
  btn: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnText: { color: colors.bg, fontSize: 16, fontFamily: fonts.bodySemiBold },
  linkBtn: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { color: colors.gray, fontSize: 14, fontFamily: fonts.body },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginBottom: spacing.sm },
});
