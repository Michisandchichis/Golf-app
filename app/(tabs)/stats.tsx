import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { getRounds, getHoles, deleteRound, Round, Hole } from '../../lib/db';

const GREEN = '#2d6a2d';
const RED = '#c62828';

type RoundStats = Round & {
  fairwayPct: number;
  girPct: number;
  avgPutts: number;
  totalPutts: number;
  scrambling: number;
  threePuttPct: number;
  totalPenalties: number;
};

function calcRoundStats(round: Round, holes: Hole[]): RoundStats {
  if (holes.length === 0) return { ...round, fairwayPct: 0, girPct: 0, avgPutts: 0, totalPutts: 0, scrambling: 0, threePuttPct: 0, totalPenalties: 0 };
  const fwEligible = holes.filter((h) => h.par !== 3);
  const fairwayPct = fwEligible.length > 0
    ? Math.round((fwEligible.filter((h) => h.fairwayHit).length / fwEligible.length) * 100)
    : 0;
  const girPct = Math.round((holes.filter((h) => h.greenInRegulation).length / holes.length) * 100);
  const totalPutts = holes.reduce((s, h) => s + h.putts, 0);
  const avgPutts = totalPutts / holes.length;
  const scrambOpps = holes.filter((h) => !h.greenInRegulation);
  const scrambling = scrambOpps.length > 0
    ? Math.round(scrambOpps.filter((h) => h.score <= h.par).length / scrambOpps.length * 100)
    : 0;
  const threePuttPct = Math.round(holes.filter((h) => h.putts >= 3).length / holes.length * 100);
  const totalPenalties = holes.reduce((s, h) => s + (h.penalties ?? 0), 0);
  return { ...round, fairwayPct, girPct, avgPutts, totalPutts, scrambling, threePuttPct, totalPenalties };
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

function calcHandicapHistory(rounds: Round[]): { date: string; value: number }[] {
  const chrono = [...rounds].reverse(); // oldest first
  const result: { date: string; value: number }[] = [];
  for (let i = 0; i < chrono.length; i++) {
    const subset = chrono.slice(0, i + 1).reverse(); // newest-first for calcHandicap
    const h = calcHandicap(subset);
    if (h !== null) result.push({ date: chrono[i].date, value: parseFloat(h) });
  }
  return result;
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
  const [hcapHistory, setHcapHistory] = useState<{ date: string; value: number }[]>([]);

  useFocusEffect(
    useCallback(() => {
      const all = getRounds().filter((r) => r.totalScore > 0);
      setHandicap(calcHandicap(all));
      setHcapHistory(calcHandicapHistory(all));
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

  const avgScrambling = n > 0 ? Math.round(rounds.reduce((s, r) => s + r.scrambling, 0) / n) : null;
  const avgThreePuttPct = n > 0 ? Math.round(rounds.reduce((s, r) => s + r.threePuttPct, 0) / n) : null;
  const avgPenalties = n > 0 ? (rounds.reduce((s, r) => s + r.totalPenalties, 0) / n).toFixed(1) : null;

  const last5Scrambling = hasEnoughForTrend ? Math.round(last5.reduce((s, r) => s + r.scrambling, 0) / last5.length) : null;
  const last5ThreePutt = hasEnoughForTrend ? Math.round(last5.reduce((s, r) => s + r.threePuttPct, 0) / last5.length) : null;
  const last5Penalties = hasEnoughForTrend ? last5.reduce((s, r) => s + r.totalPenalties, 0) / last5.length : null;

  const scrambTrend = trend(last5Scrambling, avgScrambling, true);
  const threePuttTrend = trend(last5ThreePutt, avgThreePuttPct, false);
  const penTrend = trend(last5Penalties, avgPenalties !== null ? parseFloat(avgPenalties) : null, false);

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

  // Fairway miss tendency (par 3s excluded — no fairway on par 3s)
  const fwMisses = allHoles.filter((h) => h.par !== 3 && !h.fairwayHit && h.fairwayMiss);
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

            {/* Handicap trend chart */}
            {handicap !== null && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Handicap Trend</Text>
                {hcapHistory.length >= 2 ? (
                  <HandicapLineGraph data={hcapHistory} />
                ) : (
                  <Text style={styles.noDataText}>
                    Log 1 more rated round to see your handicap trend
                  </Text>
                )}
              </View>
            )}

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
              <View style={styles.bigStatDividerH} />
              <View style={styles.bigStatRow}>
                <View style={styles.bigStatItem}>
                  <Text style={styles.bigStatValue}>
                    {avgScrambling !== null ? `${avgScrambling}%` : '—'}
                    {scrambTrend.arrow ? <Text style={[styles.trendArrow, { color: scrambTrend.color }]}>{scrambTrend.arrow}</Text> : null}
                  </Text>
                  <Text style={styles.bigStatLabel}>Scrambling</Text>
                </View>
                <View style={styles.bigStatDivider} />
                <View style={styles.bigStatItem}>
                  <Text style={styles.bigStatValue}>
                    {avgThreePuttPct !== null ? `${avgThreePuttPct}%` : '—'}
                    {threePuttTrend.arrow ? <Text style={[styles.trendArrow, { color: threePuttTrend.color }]}>{threePuttTrend.arrow}</Text> : null}
                  </Text>
                  <Text style={styles.bigStatLabel}>3-Putt %</Text>
                </View>
                <View style={styles.bigStatDivider} />
                <View style={styles.bigStatItem}>
                  <Text style={styles.bigStatValue}>
                    {avgPenalties ?? '—'}
                    {penTrend.arrow ? <Text style={[styles.trendArrow, { color: penTrend.color }]}>{penTrend.arrow}</Text> : null}
                  </Text>
                  <Text style={styles.bigStatLabel}>Pen/Round</Text>
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
                  <StatPill label="GIR" value={`${r.girPct}%`} />
                  <StatPill label="Scramble" value={`${r.scrambling}%`} />
                  <StatPill label="3-Putt" value={`${r.threePuttPct}%`} />
                  <StatPill label="Penalties" value={`${r.totalPenalties}`} highlight={r.totalPenalties > 0} />
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HandicapLineGraph({ data }: { data: { date: string; value: number }[] }) {
  const [width, setWidth] = useState(0);
  const values = data.map((d) => d.value);

  if (width === 0) {
    return <View style={{ height: 110 }} onLayout={(e: any) => setWidth(e.nativeEvent.layout.width)} />;
  }

  const height = 110;
  const pad = { t: 14, b: 18, l: 34, r: 12 };
  const cw = width - pad.l - pad.r;
  const ch = height - pad.t - pad.b;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const yPad = (max - min) * 0.25 || 1;
  const yMax = max + yPad;
  const yRange = yMax - (min - yPad);

  const pts = values.map((v, i) => ({
    x: pad.l + (i / Math.max(values.length - 1, 1)) * cw,
    y: pad.t + ((yMax - v) / yRange) * ch,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(pad.t + ch).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.t + ch).toFixed(1)} Z`;

  const latest = values[values.length - 1];
  const first = values[0];
  const latestPt = pts[pts.length - 1];
  const firstPt = pts[0];
  const improving = latest < first;

  const lineColor = improving ? GREEN : '#c62828';

  return (
    <View onLayout={(e: any) => setWidth(e.nativeEvent.layout.width)}>
      <Svg width={width} height={height}>
        {/* Baseline */}
        <Line x1={pad.l} y1={pad.t + ch} x2={pad.l + cw} y2={pad.t + ch} stroke="#eee" strokeWidth={1} />
        {/* Fill under line */}
        <Path d={fillPath} fill={lineColor} fillOpacity={0.08} />
        {/* Line */}
        <Path d={linePath} stroke={lineColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((p, i) => {
          const isLast = i === pts.length - 1;
          return (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={isLast ? 5 : 3}
              fill={isLast ? lineColor : '#fff'}
              stroke={lineColor}
              strokeWidth={1.5}
            />
          );
        })}
        {/* Latest label */}
        <SvgText x={pad.l - 4} y={latestPt.y + 4} textAnchor="end" fontSize={11} fill={lineColor} fontWeight="700">
          {latest.toFixed(1)}
        </SvgText>
        {/* First label — only if far enough away to not overlap */}
        {Math.abs(first - latest) > 0.4 && (
          <SvgText x={pad.l - 4} y={firstPt.y + 4} textAnchor="end" fontSize={10} fill="#bbb">
            {first.toFixed(1)}
          </SvgText>
        )}
        {/* Date labels: first and last */}
        <SvgText x={pts[0].x} y={height - 2} textAnchor="middle" fontSize={9} fill="#bbb">
          {data[0].date.slice(5)}
        </SvgText>
        <SvgText x={pts[pts.length - 1].x} y={height - 2} textAnchor="middle" fontSize={9} fill="#bbb">
          {data[data.length - 1].date.slice(5)}
        </SvgText>
      </Svg>
      <Text style={styles.trendNote}>
        {improving
          ? `↓ Improving — down ${(first - latest).toFixed(1)} from first tracked round`
          : latest === first
          ? 'Holding steady'
          : `↑ Up ${(latest - first).toFixed(1)} from first tracked round`}
      </Text>
    </View>
  );
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.pill}>
      <Text style={[styles.pillValue, highlight && { color: '#c62828' }]}>{value}</Text>
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
  bigStatDividerH: { height: 1, backgroundColor: '#eee', marginVertical: 14 },
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
