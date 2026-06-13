import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getRounds, getHoles, deleteRound, Round, Hole } from '../../lib/db';

const GREEN = '#2d6a2d';
const RED = '#c62828';

type RoundStats = Round & {
  fairwayPct: number;
  girPct: number;
  avgPutts: number;
  totalPutts: number;
};

function calcRoundStats(round: Round, holes: Hole[]): RoundStats {
  if (holes.length === 0) return { ...round, fairwayPct: 0, girPct: 0, avgPutts: 0, totalPutts: 0 };
  const fairwayPct = Math.round((holes.filter((h) => h.fairwayHit).length / holes.length) * 100);
  const girPct = Math.round((holes.filter((h) => h.greenInRegulation).length / holes.length) * 100);
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const avgPutts = totalPutts / holes.length;
  return { ...round, fairwayPct, girPct, avgPutts, totalPutts };
}

function diffsToUse(n: number): number {
  if (n <= 5) return 1; if (n <= 8) return 2; if (n <= 11) return 3;
  if (n <= 14) return 4; if (n <= 16) return 5; if (n <= 18) return 6;
  if (n === 19) return 7; return 8;
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
  return Math.min((best.reduce((s, d) => s + d, 0) / best.length) * 0.96, 54).toFixed(1);
}

function trend(recent: number | null, overall: number | null, higherBetter: boolean) {
  if (recent === null || overall === null) return { arrow: '', color: '#888' };
  const diff = recent - overall;
  if (Math.abs(diff) < 1) return { arrow: '', color: '#888' };
  const improving = higherBetter ? diff > 0 : diff < 0;
  return { arrow: improving ? ' ↑' : ' ↓', color: improving ? GREEN : RED };
}

export default function StatsScreen() {
  const [rounds, setRounds] = useState<RoundStats[]>([]);
  const [allHoles, setAllHoles] = useState<Hole[]>([]);
  const [handicap, setHandicap] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const all = getRounds().filter((r) => r.totalScore > 0);
      setHandicap(calcHandicap(all));
      const holesPerRound = all.map((r) => getHoles(r.id!));
      setAllHoles(holesPerRound.flat());
      setRounds(all.map((r, i) => calcRoundStats(r, holesPerRound[i])));
    }, [])
  );

  function confirmDelete(id: number, name: string) {
    Alert.alert('Delete Round', `Delete round at ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteRound(id);
        setRounds((prev) => prev.filter((r) => r.id !== id));
      }},
    ]);
  }

  function scoreToPar(score: number, par: number) {
    const d = score - par;
    return d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`;
  }

  const n = rounds.length;

  // Overall averages
  const avgFw = n > 0 ? Math.round(rounds.reduce((s, r) => s + r.fairwayPct, 0) / n) : null;
  const avgGir = n > 0 ? Math.round(rounds.reduce((s, r) => s + r.girPct, 0) / n) : null;
  const avgPuttsNum = n > 0 ? rounds.reduce((s, r) => s + r.avgPutts, 0) / n : null;
  const avgScore = n > 0 ? Math.round(rounds.reduce((s, r) => s + r.totalScore, 0) / n) : null;
  const bestRound = n > 0 ? rounds.reduce((b, r) => r.totalScore < b.totalScore ? r : b) : null;

  // Last-5 trend (only meaningful if 6+ rounds so the comparison isn't self-referential)
  const last5 = rounds.slice(0, 5);
  const hasEnoughForTrend = n >= 6;
  const last5Fw = hasEnoughForTrend ? Math.round(last5.reduce((s, r) => s + r.fairwayPct, 0) / last5.length) : null;
  const last5Gir = hasEnoughForTrend ? Math.round(last5.reduce((s, r) => s + r.girPct, 0) / last5.length) : null;
  const last5Putts = hasEnoughForTrend ? last5.reduce((s, r) => s + r.avgPutts, 0) / last5.length : null;

  const fwTrend = trend(last5Fw, avgFw, true);
  const girTrend = trend(last5Gir, avgGir, true);
  const puttsTrend = trend(last5Putts, avgPuttsNum, false);

  // Scoring by par type
  const parGroups = [3, 4, 5].map((par) => {
    const hs = allHoles.filter((h) => h.par === par);
    if (hs.length === 0) return { par, avg: null, count: 0 };
    const avgDiff = hs.reduce((s, h) => s + (h.score - h.par), 0) / hs.length;
    return { par, avg: avgDiff, count: hs.length };
  });

  // GIR miss tendency
  const girMisses = allHoles.filter((h) => !h.greenInRegulation && h.girMiss);
  const girTotal = girMisses.length;
  const girLong = girMisses.filter((h) => h.girMiss === 'long').length;
  const girShort = girMisses.filter((h) => h.girMiss === 'short').length;
  const girLeft = girMisses.filter((h) => h.girMiss === 'left').length;
  const girRight = girMisses.filter((h) => h.girMiss === 'right').length;
  const gPct = (v: number) => girTotal > 0 ? `${Math.round((v / girTotal) * 100)}%` : '0%';

  // Fairway miss tendency
  const fwMisses = allHoles.filter((h) => !h.fairwayHit && h.fairwayMiss);
  const fwMissTotal = fwMisses.length;
  const fwLeft = fwMisses.filter((h) => h.fairwayMiss === 'left').length;
  const fwRight = fwMisses.filter((h) => h.fairwayMiss === 'right').length;
  const fPct = (v: number) => fwMissTotal > 0 ? `${Math.round((v / fwMissTotal) * 100)}%` : '0%';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {n === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>No completed rounds yet</Text>
            <Text style={styles.emptySub}>Finish a round to see your stats here</Text>
          </View>
        ) : (
          <>
            {/* Handicap */}
            <View style={styles.handicapCard}>
              <View>
                <Text style={styles.handicapLabel}>Handicap Index</Text>
                {handicap === null && (
                  <Text style={styles.handicapSub}>Enter course rating & slope when logging rounds</Text>
                )}
              </View>
              <Text style={styles.handicapValue}>{handicap ?? '—'}</Text>
            </View>

            {/* Summary row */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{n}</Text>
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

            {/* Key averages with trend */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Overall Averages</Text>
              <View style={styles.bigStatRow}>
                <View style={styles.bigStatItem}>
                  <Text style={styles.bigStatValue}>
                    {avgFw !== null ? `${avgFw}%` : '—'}
                    {fwTrend.arrow ? <Text style={[styles.trendArrow, { color: fwTrend.color }]}>{fwTrend.arrow}</Text> : null}
                  </Text>
                  <Text style={styles.bigStatLabel}>Fairways</Text>
                </View>
                <View style={styles.bigStatDivider} />
                <View style={styles.bigStatItem}>
                  <Text style={styles.bigStatValue}>
                    {avgGir !== null ? `${avgGir}%` : '—'}
                    {girTrend.arrow ? <Text style={[styles.trendArrow, { color: girTrend.color }]}>{girTrend.arrow}</Text> : null}
                  </Text>
                  <Text style={styles.bigStatLabel}>GIR</Text>
                </View>
                <View style={styles.bigStatDivider} />
                <View style={styles.bigStatItem}>
                  <Text style={styles.bigStatValue}>
                    {avgPuttsNum !== null ? avgPuttsNum.toFixed(1) : '—'}
                    {puttsTrend.arrow ? <Text style={[styles.trendArrow, { color: puttsTrend.color }]}>{puttsTrend.arrow}</Text> : null}
                  </Text>
                  <Text style={styles.bigStatLabel}>Putts/Hole</Text>
                </View>
              </View>
              {hasEnoughForTrend && (
                <Text style={styles.trendNote}>↑↓ based on last 5 rounds vs. all-time</Text>
              )}
            </View>

            {/* Scoring by par type */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Scoring by Par</Text>
              <View style={styles.parRow}>
                {parGroups.map(({ par, avg, count }) => {
                  const color = avg === null ? '#bbb' : avg <= 0 ? GREEN : avg <= 0.5 ? '#888' : RED;
                  const label = avg === null ? '—' : avg === 0 ? 'E' : avg > 0 ? `+${avg.toFixed(2)}` : avg.toFixed(2);
                  return (
                    <View key={par} style={styles.parCard}>
                      <Text style={styles.parType}>Par {par}</Text>
                      <Text style={[styles.parAvg, { color }]}>{label}</Text>
                      <Text style={styles.parCount}>{count} holes</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Miss tendencies */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Miss Tendencies</Text>
              <View style={styles.missSection}>
                {/* GIR compass */}
                <View style={styles.missHalf}>
                  <Text style={styles.missSubTitle}>GIR Misses</Text>
                  {girTotal === 0 ? (
                    <Text style={styles.noDataText}>Log miss directions{'\n'}when entering holes</Text>
                  ) : (
                    <View style={styles.compass}>
                      <View style={styles.compassDirBox}>
                        <Text style={styles.compassArrow}>↑</Text>
                        <Text style={styles.compassPct}>{gPct(girLong)}</Text>
                        <Text style={styles.compassName}>Long</Text>
                      </View>
                      <View style={styles.compassMid}>
                        <View style={styles.compassDirBox}>
                          <Text style={styles.compassArrow}>←</Text>
                          <Text style={styles.compassPct}>{gPct(girLeft)}</Text>
                          <Text style={styles.compassName}>Left</Text>
                        </View>
                        <View style={styles.compassDirBox}>
                          <Text style={styles.compassArrow}>→</Text>
                          <Text style={styles.compassPct}>{gPct(girRight)}</Text>
                          <Text style={styles.compassName}>Right</Text>
                        </View>
                      </View>
                      <View style={styles.compassDirBox}>
                        <Text style={styles.compassArrow}>↓</Text>
                        <Text style={styles.compassPct}>{gPct(girShort)}</Text>
                        <Text style={styles.compassName}>Short</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.missDivider} />

                {/* FW left/right */}
                <View style={styles.missHalf}>
                  <Text style={styles.missSubTitle}>FW Misses</Text>
                  {fwMissTotal === 0 ? (
                    <Text style={styles.noDataText}>Log miss directions{'\n'}when entering holes</Text>
                  ) : (
                    <View style={styles.fwWrap}>
                      <View style={styles.fwBarsRow}>
                        <View style={[styles.fwBarLeft, { flex: Math.max(fwLeft, 0.1) }]} />
                        <View style={[styles.fwBarRight, { flex: Math.max(fwRight, 0.1) }]} />
                      </View>
                      <View style={styles.fwLabels}>
                        <Text style={styles.fwLabel}>← L{'\n'}{fPct(fwLeft)}</Text>
                        <Text style={[styles.fwLabel, { textAlign: 'right' }]}>R →{'\n'}{fPct(fwRight)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Round history */}
            <Text style={styles.sectionTitleStandalone}>Round History</Text>
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
                  <StatPill label="Putts" value={`${r.totalPutts}`} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#888', marginTop: 6 },
  handicapCard: {
    backgroundColor: GREEN, borderRadius: 12, padding: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  handicapLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  handicapSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, maxWidth: 200 },
  handicapValue: { fontSize: 40, fontWeight: 'bold', color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 14,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  summaryValue: { fontSize: 22, fontWeight: 'bold', color: GREEN },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#999', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionTitleStandalone: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8 },
  bigStatRow: { flexDirection: 'row', alignItems: 'center' },
  bigStatItem: { flex: 1, alignItems: 'center' },
  bigStatValue: { fontSize: 26, fontWeight: 'bold', color: GREEN },
  trendArrow: { fontSize: 20, fontWeight: 'bold' },
  bigStatLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  bigStatDivider: { width: 1, height: 44, backgroundColor: '#eee' },
  trendNote: { fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 12 },
  parRow: { flexDirection: 'row', gap: 8 },
  parCard: {
    flex: 1, backgroundColor: '#f8f8f8', borderRadius: 10, padding: 12, alignItems: 'center',
  },
  parType: { fontSize: 12, color: '#888', fontWeight: '600' },
  parAvg: { fontSize: 22, fontWeight: 'bold', marginTop: 4 },
  parCount: { fontSize: 11, color: '#bbb', marginTop: 3 },
  missSection: { flexDirection: 'row', alignItems: 'flex-start' },
  missHalf: { flex: 1, alignItems: 'center' },
  missDivider: { width: 1, backgroundColor: '#eee', alignSelf: 'stretch', marginHorizontal: 8 },
  missSubTitle: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 12 },
  noDataText: { fontSize: 11, color: '#bbb', fontStyle: 'italic', textAlign: 'center', lineHeight: 17 },
  compass: { alignItems: 'center', gap: 6 },
  compassMid: { flexDirection: 'row', gap: 16 },
  compassDirBox: { alignItems: 'center', minWidth: 44 },
  compassArrow: { fontSize: 16, color: '#555' },
  compassPct: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  compassName: { fontSize: 10, color: '#aaa' },
  fwWrap: { width: '100%' },
  fwBarsRow: { flexDirection: 'row', height: 28, borderRadius: 6, overflow: 'hidden' },
  fwBarLeft: { backgroundColor: '#dceeff' },
  fwBarRight: { backgroundColor: '#fdecea' },
  fwLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  fwLabel: { fontSize: 12, fontWeight: '600', color: '#555', lineHeight: 17 },
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
