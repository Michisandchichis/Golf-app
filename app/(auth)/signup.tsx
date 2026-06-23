import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import TopoBackground from '../../components/TopoBackground';
import { colors, fonts, spacing, radius, typography } from '../../lib/theme';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function signUp() {
    const u = username.trim().toLowerCase();
    if (!u) { Alert.alert('Username required', 'Please pick a username.'); return; }
    if (u.length < 3) { Alert.alert('Too short', 'Username must be at least 3 characters.'); return; }
    if (!email.trim()) { Alert.alert('Email required'); return; }
    if (password.length < 6) { Alert.alert('Password too short', 'Must be at least 6 characters.'); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      Alert.alert('Sign up failed', error.message);
      return;
    }
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, username: u });
      if (profileError) {
        setLoading(false);
        Alert.alert('Could not save username', profileError.message);
        return;
      }
      router.replace('/');
    } else {
      setLoading(false);
      Alert.alert('Check your email', 'We sent you a confirmation link. Click it then come back to log in.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TopoBackground />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Request Membership</Text>
          <Text style={styles.sub}>Apply for access to the club</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. tigerw"
            placeholderTextColor={colors.gray}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@email.com"
            placeholderTextColor={colors.gray}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min 6 characters"
            placeholderTextColor={colors.gray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.5 }]}
            onPress={signUp}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Submitting request...' : 'Request Membership'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.linkBtn}>
            <Text style={styles.linkText}>
              Already a member? <Text style={{ color: colors.gold, fontFamily: fonts.bodySemiBold }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  title: { ...typography.h1, fontSize: 32, textAlign: 'center', letterSpacing: 0.4 },
  sub: { ...typography.bodyMuted, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.xl },
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },
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
  },
  btn: {
    backgroundColor: colors.emerald,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  btnText: { color: colors.offWhite, fontSize: 16, fontFamily: fonts.bodySemiBold },
  linkBtn: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { color: colors.gray, fontSize: 14, fontFamily: fonts.body },
});
