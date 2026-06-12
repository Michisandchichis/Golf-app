import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getRounds, getHoles, deleteRound, Round, Hole } from '../../lib/db';

type RoundStats = Round & {
  fairwayPct: number;
  girPct: number;
  avgPutts: number;
};

function calcStats(round: Round): RoundStats {
  const holes = getHoles(round.id!);
  if (holes.length === 0) return { ...round, fairwayPct: 0, girPct: 0, avgPutts: 0 };
  const fairwayPct = Math.round((holes.filter((h) => h.fairwayHit).length / holes.length) * 100);
  const girPct = Math.round((holes.filter((h) => h.greenInRegulation).length / holes.length) * 100);
  const avgPutts = parseFloat((holes.reduce((s, h) => s + h.putts, 0) / holes.length).toFixed(1));
  return { ...round, fairwayPct, girPct, avgPutts };
}

// USGA handicap: how many differentials to use based on round count
function diffsToUse(n: number): number {
  if (n <= 5) return 1;
  if (n <= 8) return 2;
  if (n <= 11) return 3;
  if (n <= 14) return 4;
  if (n <= 16) return 5;
  if (n <= 18) return 6;
  if (n === 19) return 7;
  return 8;
}

function calcHandicap(rounds: Round[]): string | null {
  const withData = rounds
    .filter((r) => r.courseRating && r.courseRating > 0 && r.slopeRating && r.slopeRating > 0 && r.totalScore > 0)
    .slice(0, 20);

  if (withData.length < 3) return null;

  const differentials = withData
    .map((r) => ((r.totalScore - r.courseRating!) * 113) / r.slopeRating!)
    .sort((a, b) => a - b);

  const count = diffsToUse(withData.length);
  const best = differentials.slice(0, count);
  const avg = best.reduce((s, d) => s + d, 0) / best.length;
  return Math.min(avg * 0.96, 54).toFixed(1);
}

export default function StatsScreen() {
  const [rounds, setRounds] = useState<RoundStats[]>([]);
  const [handicap, setHandicap] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const all = getRounds().filter((r) => r.totalScore > 0);
      setHandicap(calcHandicap(all));
      setRounds(all.map(calcStats));
    }, [])
  );

  function confirmDelete(id: number, name: string) {
    Alert.alert('Delete Round', `Delete round at ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteRound(id);
          setRounds((prev) => prev.filter((r) => r.id !== id));
        },
      },
    ]);
  }

  function scoreToPar(score: number, par: number) {
    const d = score - par;
    if (d === 0) return 'E';
    return d > 0 ? `+${d}` : `${d}`;
  }

  const avgScore =
    rounds.length > 0
      ? Math.round(rounds.reduce((s, r) => s + r.totalScore, 0) / rounds.length)
      : null;
  const bestRound = rounds.length > 0 ? rounds.reduce((b, r) => (r.totalScore < b.totalScore ? r : b)) : null;
  const avgFairway = rounds.length > 0 ? Math.round(rounds.reduce((s, r) => s + r.fairwayPct, 0) / rounds.length) : null;
  const avgGir = rounds.length > 0 ? Math.round(rounds.reduce((s, r) => s + r.girPct, 0) / rounds.length) : null;
  const avgPutts = rounds.length > 0 ? (rounds.reduce((s, r) => s + r.avgPutts, 0) / rounds.length).toFixed(1) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {rounds.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>No completed rounds yet</Text>
            <Text style={styles.emptySub}>Finish a round to see your stats here</Text>
          </View>
        ) : (
          <>
            {/* Handicap Index card */}
            <View style={styles.handicapCard}>
              <View>
                <Text style={styles.handicapLabel}>Handicap Index</Text>
                {handicap === null && (
                  <Text style={styles.handicapSub}>Enter course rating & slope when logging rounds</Text>
                )}
              </View>
              <Text style={styles.handicapValue}>{handicap ?? '—'}</Text>
            </View>

            {/* Summary cards */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{rounds.length}</Text>
                <Text style={styles.summaryLabel}>Rounds</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{avgScore ?? '—'}</Text>
                <Text style={styles.summaryLabel}>Avg Score</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{bestRound?.totalScore ?? '—'}</Text>
                <Text style={styles.summaryLabel}>Best Round</Text>
              </View>
            </View>

            {/* Overall stat pills */}
            <View style={styles.overallRow}>
              <StatPill label="Avg Fairways" value={avgFairway !== null ? `${avgFairway}%` : '—'} />
              <StatPill label="Avg GIR" value={avgGir !== null ? `${avgGir}%` : '—'} />
              <StatPill label="Avg Putts" value={avgPutts ?? '—'} />
            </View>

            {/* Round history */}
            <Text style={styles.sectionTitle}>Round History</Text>
            {rounds.map((r) => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardCourse}>{r.courseName}</Text>
                    <Text style={styles.cardDate}>{r.date} · {r.totalHoles} holes</Text>
                    {r.courseRating && r.courseRating > 0 ? (
                      <Text style={styles.cardRating}>Rating {r.courseRating} / Slope {r.slopeRating}</Text>
                    ) : null}
                  </View>
                  <View style={styles.scoreBlock}>
                    <Text style={styles.scoreNum}>{r.totalScore}</Text>
                    <Text style={styles.scorePar}>{scoreToPar(r.totalScore, r.totalPar)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(r.id!, r.courseName)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.statRow}>
                  <StatPill label="Fairways" value={`${r.fairwayPct}%`} />
                  <StatPill label="GIR" value={`${r.girPct}%`} />
                  <StatPill label="Avg Putts" value={`${r.avgPutts}`} />
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const GREEN = '#2d6a2d';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 16 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#888', marginTop: 6 },
  handicapCard: {
    backgroundColor: GREEN,
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  handicapLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  handicapSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, maxWidth: 200 },
  handicapValue: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryValue: { fontSize: 22, fontWeight: 'bold', color: GREEN },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  overallRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardCourse: { fontSize: 15, fontWeight: '600', color: '#222' },
  cardDate: { fontSize: 12, color: '#888', marginTop: 2 },
  cardRating: { fontSize: 11, color: '#aaa', marginTop: 2 },
  scoreBlock: { alignItems: 'center', marginRight: 8 },
  scoreNum: { fontSize: 22, fontWeight: 'bold', color: GREEN },
  scorePar: { fontSize: 11, color: '#666' },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 16 },
  statRow: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, backgroundColor: '#f0f6f0', borderRadius: 8, padding: 8, alignItems: 'center' },
  pillValue: { fontSize: 15, fontWeight: 'bold', color: GREEN },
  pillLabel: { fontSize: 10, color: '#666', marginTop: 2 },
});
