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

const GREEN = '#2d6a2d';

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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.emoji}>⛳</Text>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.sub}>Join the golf community</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. tigerw"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@email.com"
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
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.5 }]}
            onPress={signUp}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Creating account...' : 'Create Account'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace('/login')} style={styles.linkBtn}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={{ color: GREEN, fontWeight: '600' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  inner: { padding: 28, flexGrow: 1, justifyContent: 'center' },
  emoji: { fontSize: 60, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 30, fontWeight: 'bold', color: GREEN, textAlign: 'center' },
  sub: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 4, marginBottom: 28 },
  label: { fontSize: 13, color: '#555', marginBottom: 5, marginTop: 10 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
  },
  btn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkBtn: { alignItems: 'center', marginTop: 24 },
  linkText: { color: '#888', fontSize: 14 },
});
