import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { saveHole, finalizeRound, getHoles, Hole } from '../../lib/db';
import { useFocusEffect } from 'expo-router';

const DEFAULT_PARS = [4,4,3,4,5,4,3,4,5, 4,4,3,4,5,4,3,4,5];

export default function ScorecardScreen() {
  const { roundId, totalHoles, pars: parsParam } = useLocalSearchParams<{ roundId: string; totalHoles: string; pars: string }>();
  const router = useRouter();
  const numHoles = parseInt(totalHoles ?? '18');
  const rid = parseInt(roundId ?? '0');
  const HOLE_PARS = parsParam
    ? parsParam.split(',').map(Number)
    : DEFAULT_PARS;

  const [currentHole, setCurrentHole] = useState(1);
  const [savedHoles, setSavedHoles] = useState<Hole[]>([]);

  // Per-hole entry state
  const [par, setPar] = useState(HOLE_PARS[0]);
  const [score, setScore] = useState(DEFAULT_PARS[0]);
  const [putts, setPutts] = useState(2);
  const [fairwayHit, setFairwayHit] = useState(false);
  const [gir, setGir] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (rid) {
        const holes = getHoles(rid);
        setSavedHoles(holes);
        const next = holes.length + 1;
        if (next <= numHoles) {
          setCurrentHole(next);
          const p = HOLE_PARS[next - 1] ?? DEFAULT_PARS[next - 1];
          setPar(p);
          setScore(p);
          setPutts(2);
          setFairwayHit(false);
          setGir(false);
        }
      }
    }, [rid])
  );

  if (!roundId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No active round</Text>
          <Text style={styles.emptySub}>Go to Home and tap "Start New Round"</Text>
          <TouchableOpacity style={styles.goHomeBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.goHomeBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalScore = savedHoles.reduce((s, h) => s + h.score, 0);
  const totalPar = savedHoles.reduce((s, h) => s + h.par, 0);
  const scoreToPar = totalScore - totalPar;

  function saveCurrentHole() {
    saveHole({ roundId: rid, holeNumber: currentHole, par, score, putts, fairwayHit, greenInRegulation: gir });
    const updated = getHoles(rid);
    setSavedHoles(updated);
    if (currentHole < numHoles) {
      const next = currentHole + 1;
      setCurrentHole(next);
      const p = HOLE_PARS[next - 1] ?? DEFAULT_PARS[next - 1];
      setPar(p);
      setScore(p);
      setPutts(2);
      setFairwayHit(false);
      setGir(false);
    } else {
      Alert.alert(
        'Round Complete! 🎉',
        `Final score: ${totalScore + score} (${scoreToPar + score - par >= 0 ? '+' : ''}${scoreToPar + score - par})`,
        [
          {
            text: 'Save & Finish',
            onPress: () => {
              finalizeRound(rid);
              router.push('/(tabs)');
            },
          },
        ]
      );
    }
  }

  function Counter({
    value, onChange, min = 0,
  }: { value: number; onChange: (v: number) => void; min?: number }) {
    return (
      <View style={styles.counter}>
        <TouchableOpacity
          style={styles.counterBtn}
          onPress={() => onChange(Math.max(min, value - 1))}
        >
          <Text style={styles.counterBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity style={styles.counterBtn} onPress={() => onChange(value + 1)}>
          <Text style={styles.counterBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreDiff = score - par;
  const scoreColor = scoreDiff < 0 ? '#c00' : scoreDiff === 0 ? '#2d6a2d' : '#555';

  return (
    <SafeAreaView style={styles.container}>
      {/* Running total bar */}
      <View style={styles.totalBar}>
        <Text style={styles.totalLabel}>Hole {currentHole}/{numHoles}</Text>
        <Text style={styles.totalScore}>
          {savedHoles.length > 0
            ? `${totalScore} (${scoreToPar >= 0 ? '+' : ''}${scoreToPar})`
            : 'E'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Current hole entry */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hole {currentHole}</Text>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.rowLabel}>Par</Text>
              <Counter value={par} onChange={(v) => { setPar(v); if (score === par) setScore(v); }} min={3} />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.rowLabel}>Score</Text>
              <Counter value={score} onChange={setScore} min={1} />
            </View>
            <View style={styles.rowItem}>
              <Text style={[styles.scoreDiff, { color: scoreColor }]}>
                {scoreDiff === 0 ? 'E' : scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.rowLabel}>Putts</Text>
              <Counter value={putts} onChange={setPutts} min={0} />
            </View>
          </View>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggle, fairwayHit && styles.toggleActive]}
              onPress={() => setFairwayHit(!fairwayHit)}
            >
              <Text style={[styles.toggleText, fairwayHit && styles.toggleTextActive]}>
                🌿 Fairway Hit
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggle, gir && styles.toggleActive]}
              onPress={() => setGir(!gir)}
            >
              <Text style={[styles.toggleText, gir && styles.toggleTextActive]}>
                🏌️ GIR
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.nextBtn} onPress={saveCurrentHole}>
            <Text style={styles.nextBtnText}>
              {currentHole < numHoles ? `Save & Next Hole →` : 'Finish Round 🏆'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Completed holes mini-scorecard */}
        {savedHoles.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Completed Holes</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>#</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>Par</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>Score</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText]}>+/-</Text>
            </View>
            {savedHoles.map((h) => {
              const diff = h.score - h.par;
              return (
                <View key={h.holeNumber} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{h.holeNumber}</Text>
                  <Text style={styles.tableCell}>{h.par}</Text>
                  <Text style={styles.tableCell}>{h.score}</Text>
                  <Text style={[styles.tableCell, { color: diff < 0 ? '#c00' : diff === 0 ? '#2d6a2d' : '#555' }]}>
                    {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const GREEN = '#2d6a2d';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  totalBar: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  totalLabel: { color: '#fff', fontSize: 14, opacity: 0.9 },
  totalScore: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  scroll: { padding: 16, gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-end' },
  rowItem: { flex: 1, alignItems: 'center' },
  rowLabel: { fontSize: 12, color: '#666', marginBottom: 6 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: { fontSize: 20, color: '#333', lineHeight: 24 },
  counterValue: { fontSize: 24, fontWeight: 'bold', color: '#222', minWidth: 32, textAlign: 'center' },
  scoreDiff: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: GREEN, borderColor: GREEN },
  toggleText: { fontSize: 13, color: '#444' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  nextBtn: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 6, marginBottom: 4 },
  tableHeaderText: { fontWeight: '600', color: '#555', fontSize: 12 },
  tableRow: { flexDirection: 'row', paddingVertical: 4 },
  tableCell: { flex: 1, textAlign: 'center', fontSize: 14, color: '#333' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#888', marginTop: 6, textAlign: 'center' },
  goHomeBtn: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 },
  goHomeBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
