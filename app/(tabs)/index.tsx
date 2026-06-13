import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { getRounds } from '../../lib/db';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import NewRoundSheet from '../../components/NewRoundSheet';

export default function HomeScreen() {
  const router = useRouter();
  const { openNew } = useLocalSearchParams<{ openNew?: string }>();
  const [modalVisible, setModalVisible] = useState(false);
  const [hasRounds, setHasRounds] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      const rounds = getRounds().filter((r) => r.totalScore > 0);
      setHasRounds(rounds.length > 0);
    }, [])
  );

  useEffect(() => {
    if (openNew === '1') setModalVisible(true);
  }, [openNew]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => userId && router.push(`/profile/${userId}` as any)}
          >
            <Text style={styles.profileBtnText}>My Profile</Text>
          </TouchableOpacity>
          <Text style={styles.heroEmoji}>⛳</Text>
          <Text style={styles.heroTitle}>Golf Tracker</Text>
          <Text style={styles.heroSub}>Track your rounds, improve your game</Text>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.startBtnText}>Start New Round</Text>
        </TouchableOpacity>

        {hasRounds && (
          <TouchableOpacity style={styles.historyBtn} onPress={() => router.push('/(tabs)/stats')}>
            <Text style={styles.historyBtnText}>📋  Round History</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <NewRoundSheet visible={modalVisible} onClose={() => setModalVisible(false)} />
    </SafeAreaView>
  );
}

const GREEN = '#2d6a2d';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20 },
  hero: { alignItems: 'center', paddingVertical: 32, position: 'relative' },
  profileBtn: { position: 'absolute', top: 0, right: 0, paddingVertical: 4, paddingHorizontal: 10 },
  profileBtnText: { color: GREEN, fontSize: 13, fontWeight: '600' },
  heroEmoji: { fontSize: 64 },
  heroTitle: { fontSize: 28, fontWeight: 'bold', color: GREEN, marginTop: 8 },
  heroSub: { fontSize: 14, color: '#666', marginTop: 4 },
  startBtn: {
    backgroundColor: GREEN, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', marginBottom: 12,
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  historyBtn: {
    borderWidth: 1.5, borderColor: GREEN, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 16,
  },
  historyBtnText: { color: GREEN, fontSize: 16, fontWeight: '600' },
});
