import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createRound, getRounds, deleteRound, Round } from '../../lib/db';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

export default function HomeScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [holes, setHoles] = useState<'9' | '18'>('18');
  const [recentRounds, setRecentRounds] = useState<Round[]>([]);

  useFocusEffect(
    useCallback(() => {
      setRecentRounds(getRounds().slice(0, 5));
    }, [])
  );

  function startRound() {
    if (!courseName.trim()) return;
    const roundId = createRound(courseName.trim(), parseInt(holes));
    setModalVisible(false);
    setCourseName('');
    router.push({ pathname: '/(tabs)/scorecard', params: { roundId, totalHoles: holes } });
  }

  function scoreToPar(score: number, par: number) {
    const diff = score - par;
    if (diff === 0) return 'E';
    return diff > 0 ? `+${diff}` : `${diff}`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>⛳</Text>
          <Text style={styles.heroTitle}>Golf Tracker</Text>
          <Text style={styles.heroSub}>Track your rounds, improve your game</Text>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.startBtnText}>Start New Round</Text>
        </TouchableOpacity>

        {recentRounds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Rounds</Text>
            {recentRounds.map((r) => (
              <View key={r.id} style={styles.roundCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roundCourse}>{r.courseName}</Text>
                  <Text style={styles.roundDate}>{r.date} · {r.totalHoles} holes</Text>
                </View>
                {r.totalScore > 0 && (
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreBadgeText}>{r.totalScore}</Text>
                    <Text style={styles.scoreParText}>{scoreToPar(r.totalScore, r.totalPar)}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Round</Text>

            <Text style={styles.label}>Course name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Pebble Beach"
              value={courseName}
              onChangeText={setCourseName}
              autoFocus
            />

            <Text style={styles.label}>Number of holes</Text>
            <View style={styles.holeToggle}>
              {(['9', '18'] as const).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.holeBtn, holes === n && styles.holeBtnActive]}
                  onPress={() => setHoles(n)}
                >
                  <Text style={[styles.holeBtnText, holes === n && styles.holeBtnTextActive]}>
                    {n} holes
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.confirmBtn, !courseName.trim() && { opacity: 0.4 }]}
              onPress={startRound}
              disabled={!courseName.trim()}
            >
              <Text style={styles.confirmBtnText}>Tee Off →</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const GREEN = '#2d6a2d';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20 },
  hero: { alignItems: 'center', paddingVertical: 32 },
  heroEmoji: { fontSize: 64 },
  heroTitle: { fontSize: 28, fontWeight: 'bold', color: GREEN, marginTop: 8 },
  heroSub: { fontSize: 14, color: '#666', marginTop: 4 },
  startBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  startBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 10 },
  roundCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roundCourse: { fontSize: 15, fontWeight: '600', color: '#222' },
  roundDate: { fontSize: 12, color: '#888', marginTop: 2 },
  scoreBadge: { alignItems: 'center', minWidth: 48 },
  scoreBadgeText: { fontSize: 20, fontWeight: 'bold', color: GREEN },
  scoreParText: { fontSize: 12, color: '#666' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 16 },
  label: { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  holeToggle: { flexDirection: 'row', gap: 10, marginTop: 4 },
  holeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  holeBtnActive: { backgroundColor: GREEN, borderColor: GREEN },
  holeBtnText: { fontSize: 15, color: '#444' },
  holeBtnTextActive: { color: '#fff', fontWeight: '600' },
  confirmBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: '#888', fontSize: 14 },
});
