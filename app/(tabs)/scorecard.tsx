import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { saveHole, finalizeRound, getHoles, Hole } from '../../lib/db';
import NewRoundSheet from '../../components/NewRoundSheet';
import HonorUnlockedModal from '../../components/HonorUnlockedModal';
import { useFocusEffect } from 'expo-router';
import { colors, fonts, spacing, radius, typography } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { detectNewMilestones, MilestoneDefinition } from '../../lib/achievements';

const DEFAULT_PARS = [4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5];

export default function ScorecardScreen() {
  const { roundId, totalHoles, courseName, pars: parsParam, yards: yardsParam, handicaps: handicapsParam } = useLocalSearchParams<{
    roundId: string;
    totalHoles: string;
    courseName: string;
    pars: string;
    yards: string;
    handicaps: string;
  }>();
  const router = useRouter();
  const numHoles = parseInt(totalHoles ?? '18');
  const rid = parseInt(roundId ?? '0');
  const HOLE_PARS = parsParam ? parsParam.split(',').map(Number) : DEFAULT_PARS;
  const HOLE_YARDS = yardsParam ? yardsParam.split(',').map(Number) : [];
  const HOLE_HANDICAPS = handicapsParam ? handicapsParam.split(',').map(Number) : [];

  const [savedHoles, setSavedHoles] = useState<Hole[]>([]);
  const [displayHole, setDisplayHole] = useState(1);
  const [nextHole, setNextHole] = useState(1);

  const [par, setPar] = useState(HOLE_PARS[0] ?? 4);
  const [score, setScore] = useState(HOLE_PARS[0] ?? 4);
  const [putts, setPutts] = useState(2);
  const [fairwayHit, setFairwayHit] = useState(false);
  const [fairwayMiss, setFairwayMiss] = useState<'left' | 'right' | null>(null);
  const [gir, setGir] = useState(false);
  const [girMiss, setGirMiss] = useState<'long' | 'short' | 'left' | 'right' | null>(null);
  const [penalties, setPenalties] = useState(0);
  const [roundComplete, setRoundComplete] = useState<{ score: number; diff: number } | null>(null);
  const [showNewRound, setShowNewRound] = useState(false);
  const [honorQueue, setHonorQueue] = useState<MilestoneDefinition[]>([]);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [finalizedRound, setFinalizedRound] = useState<{ score: number; par: number } | null>(null);

  function loadHoleIntoForm(holeNum: number, holes: Hole[]) {
    const saved = holes.find((h) => h.holeNumber === holeNum);
    if (saved) {
      setPar(saved.par);
      setScore(saved.score);
      setPutts(saved.putts);
      setFairwayHit(!!saved.fairwayHit);
      setFairwayMiss(saved.fairwayMiss ?? null);
      setGir(!!saved.greenInRegulation);
      setGirMiss(saved.girMiss ?? null);
      setPenalties(saved.penalties ?? 0);
    } else {
      const p = HOLE_PARS[holeNum - 1] ?? DEFAULT_PARS[holeNum - 1] ?? 4;
      setPar(p);
      setScore(p);
      setPutts(2);
      setFairwayHit(false);
      setFairwayMiss(null);
      setGir(false);
      setGirMiss(null);
      setPenalties(0);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (rid) {
        const holes = getHoles(rid);
        setSavedHoles(holes);
        const next = Math.min(holes.length + 1, numHoles);
        setNextHole(next);
        setDisplayHole(next);
        loadHoleIntoForm(next, holes);
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
  const runningToPar = totalScore - totalPar;
  const scoreDiff = score - par;
  const scoreColor = scoreDiff < 0 ? colors.gold : scoreDiff === 0 ? colors.emeraldLight : colors.gray;
  const isSavedHole = savedHoles.some((h) => h.holeNumber === displayHole);
  const isLastHole = displayHole === numHoles && !isSavedHole;

  function jumpToHole(holeNum: number) {
    setDisplayHole(holeNum);
    loadHoleIntoForm(holeNum, savedHoles);
  }

  async function checkMilestones(finalScore: number, finalPar: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    const roundObj = {
      id: rid,
      totalScore: finalScore,
      totalPar: finalPar,
      totalHoles: numHoles,
      courseName: courseName ?? '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    };
    const newMilestones = await detectNewMilestones(roundObj, getHoles(rid), user.id);
    if (newMilestones.length > 0) {
      setFinalizedRound({ score: finalScore, par: finalPar });
      setHonorQueue(newMilestones);
    }
  }

  async function handleSave() {
    saveHole({
      roundId: rid, holeNumber: displayHole, par, score, putts,
      fairwayHit: par === 3 ? false : fairwayHit,
      fairwayMiss: par === 3 || fairwayHit ? null : fairwayMiss,
      greenInRegulation: gir, girMiss: gir ? null : girMiss,
      penalties,
    });
    const updated = getHoles(rid);
    setSavedHoles(updated);

    if (isSavedHole && updated.length >= numHoles) {
      // Edited a hole and all holes are complete — show round complete
      const finalScore = updated.reduce((s, h) => s + h.score, 0);
      const finalPar = updated.reduce((s, h) => s + h.par, 0);
      finalizeRound(rid);
      await checkMilestones(finalScore, finalPar);
      setRoundComplete({ score: finalScore, diff: finalScore - finalPar });
    } else if (isSavedHole) {
      // Edited existing hole, round not yet complete — return to next unplayed hole
      setDisplayHole(nextHole);
      loadHoleIntoForm(nextHole, updated);
    } else if (displayHole < numHoles) {
      // Saved new hole, more to go
      const newNext = nextHole + 1;
      setNextHole(newNext);
      setDisplayHole(newNext);
      loadHoleIntoForm(newNext, updated);
    } else {
      // Saved the final hole — round complete
      const finalScore = updated.reduce((s, h) => s + h.score, 0);
      const finalPar = updated.reduce((s, h) => s + h.par, 0);
      const diff = finalScore - finalPar;
      finalizeRound(rid);
      await checkMilestones(finalScore, finalPar);
      setRoundComplete({ score: finalScore, diff });
    }
  }

  function proceedFromRoundComplete(next: () => void) {
    setRoundComplete(null);
    if (honorQueue.length > 0) {
      setPendingAction(next);
    } else {
      next();
    }
  }

  function dismissCurrentHonor() {
    setHonorQueue((prev) => {
      const rest = prev.slice(1);
      if (rest.length === 0) {
        pendingAction?.();
        setPendingAction(null);
      }
      return rest;
    });
  }

  function Counter({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
    return (
      <View style={styles.counter}>
        <TouchableOpacity style={styles.counterBtn} onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={styles.counterBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.counterValue}>{value}</Text>
        <TouchableOpacity style={styles.counterBtn} onPress={() => onChange(value + 1)}>
          <Text style={styles.counterBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const btnLabel = isSavedHole
    ? 'Update Hole ✓'
    : isLastHole
    ? 'Finish Round 🏆'
    : 'Save & Next →';

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.homeBtnText}>⌂ Home</Text>
        </TouchableOpacity>
        <Text style={styles.totalScore}>
          {savedHoles.length > 0
            ? `${totalScore}  (${runningToPar >= 0 ? '+' : ''}${runningToPar})`
            : 'Score: —'}
        </Text>
      </View>

      {/* Hole selector */}
      <View style={styles.holeSelectorWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.holeSelector}
        >
          {Array.from({ length: numHoles }, (_, i) => i + 1).map((n) => {
            const saved = savedHoles.some((h) => h.holeNumber === n);
            const active = n === displayHole;
            return (
              <TouchableOpacity
                key={n}
                style={[
                  styles.holeDot,
                  saved && styles.holeDotSaved,
                  active && styles.holeDotActive,
                ]}
                onPress={() => jumpToHole(n)}
              >
                <Text style={[styles.holeDotText, (saved || active) && styles.holeDotTextLight]}>
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hole entry / edit card */}
        <View style={styles.card}>
          {/* Code-drawn hole header */}
          <View style={styles.holeHeader}>
            <View style={{ flex: 1 }}>
              {courseName ? <Text style={styles.courseNameLabel}>{courseName}</Text> : null}
              <Text style={styles.holeCursive}>Hole {displayHole}</Text>
            </View>
            <View style={styles.greenScene}>

              <View style={styles.greenBlob} />
              <View style={styles.greenDark} />
              <View style={[styles.golfBall, { bottom: 20, left: 18 }]} />
              <View style={[styles.golfBall, { bottom: 15, left: 30 }]} />
              <View style={styles.flagPole} />
              <View style={styles.flag}>
                <Text style={styles.flagNum}>{displayHole}</Text>
              </View>
              <View style={styles.holeCup} />
            </View>
          </View>

          <View style={styles.cardContent}>
            {isSavedHole && (
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>Editing</Text>
              </View>
            )}

            {/* Par / yards / handicap stat blocks */}
            <View style={styles.holeStatsRow}>
              <View style={styles.holeStatBlock}>
                <Text style={styles.holeStatLabel}>Par</Text>
                <Text style={styles.holeStatValue}>{par}</Text>
              </View>
              {HOLE_YARDS[displayHole - 1] ? (
                <>
                  <View style={styles.holeStatDivider} />
                  <View style={styles.holeStatBlock}>
                    <Text style={styles.holeStatLabel}>Yards</Text>
                    <Text style={styles.holeStatValue}>{HOLE_YARDS[displayHole - 1]}</Text>
                  </View>
                </>
              ) : null}
              {HOLE_HANDICAPS[displayHole - 1] ? (
                <>
                  <View style={styles.holeStatDivider} />
                  <View style={styles.holeStatBlock}>
                    <Text style={styles.holeStatLabel}>HCP</Text>
                    <Text style={styles.holeStatValue}>{HOLE_HANDICAPS[displayHole - 1]}</Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.row}>
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
              <View style={styles.rowItem}>
                <Text style={[styles.rowLabel, penalties > 0 && { color: colors.danger }]}>Penalties</Text>
                <Counter value={penalties} onChange={setPenalties} min={0} />
              </View>
            </View>

            {/* Fairway toggle + miss direction (par 3s don't have fairways) */}
            {par !== 3 && (
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggle, fairwayHit && styles.toggleActive]}
                  onPress={() => { setFairwayHit(!fairwayHit); setFairwayMiss(null); }}
                >
                  <Text style={[styles.toggleText, fairwayHit && styles.toggleTextActive]}>
                    🌿 Fairway
                  </Text>
                </TouchableOpacity>
                {!fairwayHit && (
                  <View style={styles.missRow}>
                    {(['left', 'right'] as const).map((dir) => (
                      <TouchableOpacity
                        key={dir}
                        style={[styles.missBtn, fairwayMiss === dir && styles.missBtnActive]}
                        onPress={() => setFairwayMiss(fairwayMiss === dir ? null : dir)}
                      >
                        <Text style={[styles.missBtnText, fairwayMiss === dir && styles.missBtnTextActive]}>
                          {dir === 'left' ? '← L' : 'R →'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* GIR toggle + miss direction compass */}
            <View style={styles.girRow}>
              <TouchableOpacity
                style={[styles.toggle, gir && styles.toggleActive]}
                onPress={() => { setGir(!gir); setGirMiss(null); }}
              >
                <Text style={[styles.toggleText, gir && styles.toggleTextActive]}>
                  🏌️ GIR
                </Text>
              </TouchableOpacity>
              {!gir && (
                <View style={styles.compassWrap}>
                  <TouchableOpacity
                    style={[styles.compassBtn, girMiss === 'long' && styles.missBtnActive]}
                    onPress={() => setGirMiss(girMiss === 'long' ? null : 'long')}
                  >
                    <Text style={[styles.missBtnText, girMiss === 'long' && styles.missBtnTextActive]}>↑ Long</Text>
                  </TouchableOpacity>
                  <View style={styles.compassMiddle}>
                    <TouchableOpacity
                      style={[styles.compassBtn, girMiss === 'left' && styles.missBtnActive]}
                      onPress={() => setGirMiss(girMiss === 'left' ? null : 'left')}
                    >
                      <Text style={[styles.missBtnText, girMiss === 'left' && styles.missBtnTextActive]}>← L</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.compassBtn, girMiss === 'right' && styles.missBtnActive]}
                      onPress={() => setGirMiss(girMiss === 'right' ? null : 'right')}
                    >
                      <Text style={[styles.missBtnText, girMiss === 'right' && styles.missBtnTextActive]}>R →</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.compassBtn, girMiss === 'short' && styles.missBtnActive]}
                    onPress={() => setGirMiss(girMiss === 'short' ? null : 'short')}
                  >
                    <Text style={[styles.missBtnText, girMiss === 'short' && styles.missBtnTextActive]}>↓ Short</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, isSavedHole && styles.updateBtn]}
              onPress={handleSave}
            >
              <Text style={styles.nextBtnText}>{btnLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scorecard table — tap any row to edit that hole */}
        {savedHoles.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scorecard  <Text style={styles.tapHint}>(tap a row to edit)</Text></Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.tableHeaderText, styles.cellHoleCol]}>#</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, styles.cellSmall]}>Par</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, styles.cellSmall]}>Score</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, styles.cellSmall]}>+/-</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, styles.cellMiss]}>Putts</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, styles.cellMiss]}>FW</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, styles.cellMiss]}>GIR</Text>
              <Text style={[styles.tableCell, styles.tableHeaderText, styles.cellMiss]}>Pen</Text>
            </View>
            {savedHoles.map((h) => {
              const diff = h.score - h.par;
              const isActiveRow = h.holeNumber === displayHole;
              const puttColor = h.putts <= 1 ? colors.emeraldLight : h.putts === 2 ? colors.gray : '#e07000';
              const fwIcon = h.par === 3 ? '—' : h.fairwayHit ? '✓' : '·';
              const fwColor = h.par === 3 ? colors.gray : h.fairwayHit ? colors.emeraldLight : colors.gray;
              const girIcon = h.greenInRegulation ? '✓' : '·';
              const girColor = h.greenInRegulation ? colors.emeraldLight : colors.gray;
              return (
                <TouchableOpacity
                  key={h.holeNumber}
                  style={[styles.tableRow, isActiveRow && styles.tableRowActive]}
                  onPress={() => jumpToHole(h.holeNumber)}
                >
                  <Text style={[styles.tableCell, styles.tableCellHole, styles.cellHoleCol]}>{h.holeNumber}</Text>
                  <Text style={[styles.tableCell, styles.cellSmall]}>{h.par}</Text>
                  <Text style={[styles.tableCell, styles.cellSmall]}>{h.score}</Text>
                  <Text style={[styles.tableCell, styles.cellSmall, { color: diff < 0 ? colors.gold : diff === 0 ? colors.emeraldLight : colors.gray }]}>
                    {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                  </Text>
                  <Text style={[styles.tableCell, styles.cellMiss, { color: puttColor, fontWeight: '700' }]}>{h.putts}</Text>
                  <Text style={[styles.tableCell, styles.cellMiss, { color: fwColor, fontWeight: '700' }]}>{fwIcon}</Text>
                  <Text style={[styles.tableCell, styles.cellMiss, { color: girColor, fontWeight: '700' }]}>{girIcon}</Text>
                  <Text style={[styles.tableCell, styles.cellMiss, { color: (h.penalties ?? 0) > 0 ? colors.danger : colors.gray, fontWeight: '700' }]}>
                    {(h.penalties ?? 0) > 0 ? h.penalties : '·'}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* Footer: total putts, FW%, GIR% */}
            {(() => {
              const fwEligible = savedHoles.filter((h) => h.par !== 3);
              const fwHit = fwEligible.filter((h) => h.fairwayHit).length;
              const girHit = savedHoles.filter((h) => h.greenInRegulation).length;
              const totalPutts = savedHoles.reduce((s, h) => s + h.putts, 0);
              const totalPens = savedHoles.reduce((s, h) => s + (h.penalties ?? 0), 0);
              const total = savedHoles.length;
              return (
                <View style={styles.tableFooter}>
                  <Text style={styles.tableFooterText}>{totalPutts} putts</Text>
                  <Text style={styles.tableFooterText}>
                    FW {fwHit}/{fwEligible.length}{fwEligible.length > 0 ? ` (${Math.round(fwHit / fwEligible.length * 100)}%)` : ''}
                  </Text>
                  <Text style={styles.tableFooterText}>
                    GIR {girHit}/{total} ({Math.round(girHit / total * 100)}%)
                  </Text>
                  {totalPens > 0 && (
                    <Text style={[styles.tableFooterText, { color: colors.danger }]}>{totalPens} pen</Text>
                  )}
                </View>
              );
            })()}
          </View>
        )}
      </ScrollView>
      {/* Round complete overlay */}
      <NewRoundSheet visible={showNewRound} onClose={() => setShowNewRound(false)} />
      {!!roundComplete && (
        <View style={styles.completeOverlay}>
          <View style={styles.completeCard}>
            <Text style={styles.completeTrophy}>🏆</Text>
            <Text style={styles.completeTitle}>Round Complete!</Text>
            <Text style={styles.completeScore}>
              {roundComplete.score}{'  '}(
              {roundComplete.diff >= 0 ? '+' : ''}{roundComplete.diff})
            </Text>
            <TouchableOpacity
              style={styles.completeBtn}
              onPress={() => proceedFromRoundComplete(() => setShowNewRound(true))}
            >
              <Text style={styles.completeBtnText}>Start New Round</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completeBtnOutline}
              onPress={() => proceedFromRoundComplete(() => {})}
            >
              <Text style={styles.completeBtnOutlineText}>Edit Round</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.completeBtnGhost}
              onPress={() => proceedFromRoundComplete(() => router.push('/(tabs)'))}
            >
              <Text style={styles.completeBtnGhostText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {honorQueue.length > 0 && currentUserId && finalizedRound && (
        <HonorUnlockedModal
          milestone={honorQueue[0]}
          userId={currentUserId}
          round={{
            id: rid,
            totalScore: finalizedRound.score,
            totalPar: finalizedRound.par,
            totalHoles: numHoles,
            courseName: courseName ?? '',
            date: new Date().toISOString().split('T')[0],
            notes: '',
          }}
          onDone={dismissCurrentHonor}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  homeBtn: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  homeBtnText: { color: colors.offWhite, fontSize: 14, fontFamily: fonts.bodySemiBold },
  totalScore: { color: colors.gold, fontSize: 16, fontFamily: fonts.bodySemiBold },
  holeSelectorWrap: {
    backgroundColor: colors.bgSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  holeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  holeDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeDotSaved: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  holeDotActive: { backgroundColor: colors.emerald, borderWidth: 2, borderColor: colors.gold, shadowColor: colors.gold, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
  holeDotText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.gray },
  holeDotTextLight: { color: colors.offWhite },
  scroll: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  cardContent: {
    padding: spacing.md,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle: { fontSize: 17, fontFamily: fonts.bodySemiBold, color: colors.offWhite },
  parLabel: { fontSize: 14, color: colors.gray },
  holeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 12,
    paddingVertical: 16,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  courseNameLabel: {
    fontSize: 12, color: colors.gold, fontFamily: fonts.bodySemiBold,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  holeCursive: {
    fontSize: 40,
    fontFamily: fonts.heading,
    color: colors.offWhite,
  },
  greenScene: {
    width: 140,
    height: 95,
    position: 'relative',
    flexShrink: 0,
  },
  greenBlob: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: colors.emerald,
    borderTopLeftRadius: 72,
    borderTopRightRadius: 50,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 38,
  },
  greenDark: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 48,
    height: 24,
    backgroundColor: colors.emeraldLight,
    borderRadius: 24,
    opacity: 0.45,
  },
  golfBall: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.offWhite,
    borderWidth: 0.5,
    borderColor: colors.gray,
  },
  flagPole: {
    position: 'absolute',
    bottom: 24,
    left: 82,
    width: 2,
    height: 68,
    backgroundColor: colors.gray,
  },
  flag: {
    position: 'absolute',
    top: 3,
    left: 84,
    width: 32,
    height: 22,
    backgroundColor: colors.gold,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagNum: {
    color: colors.bg,
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
  },
  holeCup: {
    position: 'absolute',
    bottom: 19,
    left: 79,
    width: 9,
    height: 5,
    backgroundColor: '#000',
    borderRadius: 4,
  },
  holeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.hairline,
  },
  holeStatBlock: { flex: 1, alignItems: 'center' },
  holeStatLabel: { fontSize: 11, color: colors.gray, fontFamily: fonts.bodySemiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  holeStatValue: { fontSize: 26, fontFamily: fonts.bodySemiBold, color: colors.gold },
  holeStatDivider: { width: 1, height: 36, backgroundColor: colors.hairline },
  tapHint: { fontSize: 12, color: colors.gray },
  editBadge: { backgroundColor: 'rgba(198,162,103,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  editBadgeText: { fontSize: 12, color: colors.gold, fontFamily: fonts.bodySemiBold },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12, alignItems: 'flex-end' },
  rowItem: { flex: 1, alignItems: 'center' },
  rowLabel: { fontSize: 12, color: colors.gray, marginBottom: 6 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  counterBtnText: { fontSize: 20, color: colors.offWhite, lineHeight: 24 },
  counterValue: { fontSize: 24, fontFamily: fonts.bodySemiBold, color: colors.offWhite, minWidth: 32, textAlign: 'center' },
  scoreDiff: { fontSize: 28, fontFamily: fonts.bodySemiBold, textAlign: 'center', marginBottom: 4 },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' },
  girRow: { marginBottom: 16 },
  toggle: {
    flex: 1, borderWidth: 1, borderColor: colors.inputBorder,
    borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.emerald, borderColor: colors.emerald },
  toggleText: { fontSize: 13, color: colors.offWhite },
  toggleTextActive: { color: colors.offWhite, fontFamily: fonts.bodySemiBold },
  missRow: { flexDirection: 'row', gap: 6 },
  missBtn: {
    borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  missBtnActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  missBtnText: { fontSize: 13, color: colors.offWhite, fontFamily: fonts.bodySemiBold },
  missBtnTextActive: { color: colors.offWhite },
  compassWrap: { alignItems: 'center', gap: 4, marginTop: 8 },
  compassMiddle: { flexDirection: 'row', gap: 24 },
  compassBtn: {
    borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm,
    paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 70, alignItems: 'center',
  },
  nextBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  updateBtn: { backgroundColor: colors.emeraldLight },
  nextBtnText: { color: colors.offWhite, fontSize: 16, fontFamily: fonts.bodySemiBold },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.hairline, paddingBottom: 6, marginBottom: 4, paddingHorizontal: 12 },
  tableHeaderText: { fontFamily: fonts.bodySemiBold, color: colors.gray, fontSize: 12 },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderRadius: 6, paddingHorizontal: 12 },
  tableRowActive: { backgroundColor: colors.inputBg },
  tableCell: { flex: 1, textAlign: 'center', fontSize: 14, color: colors.offWhite },
  cellHoleCol: { flex: 0.6 },
  cellSmall: { flex: 0.8 },
  cellMiss: { flex: 0.7 },
  tableCellHole: { fontWeight: '700', color: colors.gold },
  tableFooter: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 10, borderTopWidth: 1, borderColor: colors.hairline, marginTop: 4,
  },
  tableFooterText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.gold },
  completeOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 32,
    zIndex: 999,
  },
  completeCard: {
    backgroundColor: colors.bgSecondary, borderRadius: radius.xl, padding: 32, width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: colors.hairline,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  completeTrophy: { fontSize: 56, marginBottom: 8 },
  completeTitle: { fontSize: 24, fontFamily: fonts.heading, color: colors.offWhite, marginBottom: 4 },
  completeScore: { fontSize: 36, fontFamily: fonts.bodySemiBold, color: colors.gold, marginBottom: 28 },
  completeBtn: {
    backgroundColor: colors.emerald, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', width: '100%', marginBottom: 10,
  },
  completeBtnText: { color: colors.offWhite, fontSize: 16, fontFamily: fonts.bodySemiBold },
  completeBtnOutline: {
    borderWidth: 1.5, borderColor: colors.gold, borderRadius: radius.md, paddingVertical: 14,
    alignItems: 'center', width: '100%', marginBottom: 10,
  },
  completeBtnOutlineText: { color: colors.gold, fontSize: 16, fontFamily: fonts.bodySemiBold },
  completeBtnGhost: { paddingVertical: 12, alignItems: 'center', width: '100%' },
  completeBtnGhostText: { color: colors.gray, fontSize: 15 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 20, fontFamily: fonts.heading, color: colors.offWhite, marginTop: 12 },
  emptySub: { fontSize: 14, color: colors.gray, marginTop: 6, textAlign: 'center' },
  goHomeBtn: { backgroundColor: colors.emerald, borderRadius: radius.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 20 },
  goHomeBtnText: { color: colors.offWhite, fontFamily: fonts.bodySemiBold, fontSize: 15 },
});
