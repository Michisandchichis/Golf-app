import { Round, Hole, getRounds, getAllHoles } from './db';
import { supabase } from './supabase';
import { rarityColors } from './theme';

export type Category = 'score' | 'birdie_eagle' | 'putting' | 'ball_striking' | 'clean_round' | 'career';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type RoundFeats = {
  birdieCount: number;
  eagleCount: number;
  albatrossCount: number;
  bogeyFreeRound: boolean;
  noWorseThanBogey: boolean;
  doubleBogeyFree: boolean;
  threePuttFree: boolean;
  totalPutts: number;
  onePuttCount: number;
  fairwaysHit: number;
  fairwaysEligible: number;
  allFairwaysHit: boolean;
  girHit: number;
  girEligible: number;
  allGreensHit: boolean;
  birdieAfterDoubleBogey: boolean;
  backToBackBirdies: boolean;
  allPar3sParred: boolean;
  par3BirdieCount: number;
  holeInOne: boolean;
  penaltyFreeRound: boolean;
  noBlowUpHoles: boolean;
  consecutiveParStreak: number;
  consecutiveBirdieStreak: number;
};

export type CareerStats = {
  roundsPlayed: number;
  coursesPlayed: number;
  handicapIndex: number | null;
  previousBest18: number | null;
  previousBest9: number | null;
  recentScores18: number[];
  careerBirdies: number;
  careerEagles: number;
  careerPars: number;
  careerFairwaysHit: number;
  careerGIR: number;
  careerOnePutts: number;
  handicapImprovement: number | null;
};

export type MilestoneDefinition = {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: Category;
  rarity: Rarity;
  check: (round: Round, feats: RoundFeats, career: CareerStats) => boolean;
  progress?: (career: CareerStats) => { current: number; target: number };
};

export const RARITY_META: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'Common', color: rarityColors.common },
  rare: { label: 'Rare', color: rarityColors.rare },
  epic: { label: 'Epic', color: rarityColors.epic },
  legendary: { label: 'Legendary', color: rarityColors.legendary },
  mythic: { label: 'Mythic', color: rarityColors.mythic },
};

function maxStreak(sorted: Hole[], condition: (h: Hole) => boolean): number {
  let best = 0, cur = 0;
  for (const h of sorted) { if (condition(h)) { cur++; best = Math.max(best, cur); } else cur = 0; }
  return best;
}

export function computeRoundFeats(round: Round, holes: Hole[]): RoundFeats {
  const playedHoles = holes.filter((h) => h.par > 0);
  const fullyRecorded = playedHoles.length === round.totalHoles && playedHoles.length > 0;

  let birdieCount = 0, eagleCount = 0, albatrossCount = 0;
  let onePuttCount = 0, totalPutts = 0;
  let fairwaysHit = 0, fairwaysEligible = 0;
  let girHit = 0;

  for (const h of playedHoles) {
    const diff = h.score - h.par;
    if (diff === -1) birdieCount++;
    else if (diff === -2) eagleCount++;
    else if (diff <= -3) albatrossCount++;

    totalPutts += h.putts;
    if (h.putts <= 1) onePuttCount++;

    if (h.par !== 3) {
      fairwaysEligible++;
      if (h.fairwayHit) fairwaysHit++;
    }
    if (h.greenInRegulation) girHit++;
  }

  const bogeyFreeRound = fullyRecorded && playedHoles.every((h) => h.score <= h.par);
  const noWorseThanBogey = fullyRecorded && playedHoles.every((h) => h.score <= h.par + 1);
  const doubleBogeyFree = fullyRecorded && playedHoles.every((h) => h.score <= h.par + 2);
  const threePuttFree = fullyRecorded && playedHoles.every((h) => h.putts <= 2);
  const penaltyFreeRound = fullyRecorded && playedHoles.every((h) => (h.penalties ?? 0) === 0);
  const noBlowUpHoles = fullyRecorded && playedHoles.every((h) => h.score <= h.par + 3);

  const sorted = [...playedHoles].sort((a, b) => a.holeNumber - b.holeNumber);
  let birdieAfterDoubleBogey = false;
  let backToBackBirdies = false;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev.score >= prev.par + 2 && curr.score <= curr.par - 1) birdieAfterDoubleBogey = true;
    if (prev.score <= prev.par - 1 && curr.score <= curr.par - 1) backToBackBirdies = true;
  }

  const consecutiveParStreak = maxStreak(sorted, (h) => h.score <= h.par);
  const consecutiveBirdieStreak = maxStreak(sorted, (h) => h.score <= h.par - 1);

  return {
    birdieCount, eagleCount, albatrossCount,
    bogeyFreeRound, noWorseThanBogey, doubleBogeyFree, threePuttFree,
    penaltyFreeRound, noBlowUpHoles,
    totalPutts, onePuttCount,
    fairwaysHit, fairwaysEligible,
    allFairwaysHit: fullyRecorded && fairwaysEligible > 0 && fairwaysHit === fairwaysEligible,
    girHit, girEligible: playedHoles.length,
    allGreensHit: fullyRecorded && girHit === playedHoles.length,
    birdieAfterDoubleBogey, backToBackBirdies,
    allPar3sParred: (() => { const p3 = playedHoles.filter(h => h.par === 3); return p3.length > 0 && p3.every(h => h.score <= h.par); })(),
    par3BirdieCount: playedHoles.filter(h => h.par === 3 && h.score <= h.par - 1).length,
    holeInOne: playedHoles.some(h => h.score === 1),
    consecutiveParStreak, consecutiveBirdieStreak,
  };
}

const WHS_BEST_OF = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6, 7, 7, 8];

function computeHandicapIndex(rounds: Round[]): number | null {
  const valid = rounds
    .filter((r) => r.totalHoles === 18 && r.totalScore > 0 && (r.courseRating ?? 0) > 0 && (r.slopeRating ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20);
  if (valid.length < 3) return null;
  const diffs = valid.map((r) => ((r.totalScore - r.courseRating!) * 113) / r.slopeRating!);
  const bestCount = WHS_BEST_OF[Math.min(diffs.length, 20)];
  const sorted = [...diffs].sort((a, b) => a - b);
  const avg = sorted.slice(0, bestCount).reduce((a, b) => a + b, 0) / bestCount;
  return Math.round(avg * 0.96 * 10) / 10;
}

export function computeCareerStats(rounds: Round[], allHoles?: Hole[], excludeRoundId?: number | null): CareerStats {
  const courseNames = new Set(rounds.map((r) => r.courseName.toLowerCase().trim()));
  const others = excludeRoundId != null ? rounds.filter((r) => r.id !== excludeRoundId) : rounds;
  const others18 = others.filter((r) => r.totalHoles === 18 && r.totalScore > 0);
  const others9 = others.filter((r) => r.totalHoles === 9 && r.totalScore > 0);
  const sorted18 = [...others18].sort((a, b) => b.date.localeCompare(a.date));

  const currentHandicap = computeHandicapIndex(rounds);
  const validChronological = rounds
    .filter((r) => r.totalHoles === 18 && r.totalScore > 0 && (r.courseRating ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstHandicap = validChronological.length >= 3
    ? computeHandicapIndex(validChronological.slice(0, Math.min(5, validChronological.length)))
    : null;
  const handicapImprovement = firstHandicap !== null && currentHandicap !== null
    ? Math.round((firstHandicap - currentHandicap) * 10) / 10
    : null;

  const h = allHoles ?? [];
  const careerBirdies = h.filter((x) => x.par > 0 && x.score === x.par - 1).length;
  const careerEagles = h.filter((x) => x.par > 0 && x.score <= x.par - 2).length;
  const careerPars = h.filter((x) => x.par > 0 && x.score === x.par).length;
  const careerFairwaysHit = h.filter((x) => x.par !== 3 && x.fairwayHit).length;
  const careerGIR = h.filter((x) => x.greenInRegulation).length;
  const careerOnePutts = h.filter((x) => x.putts <= 1).length;

  return {
    roundsPlayed: rounds.length,
    coursesPlayed: courseNames.size,
    handicapIndex: currentHandicap,
    previousBest18: others18.length > 0 ? Math.min(...others18.map((r) => r.totalScore)) : null,
    previousBest9: others9.length > 0 ? Math.min(...others9.map((r) => r.totalScore)) : null,
    recentScores18: sorted18.slice(0, 2).map((r) => r.totalScore),
    careerBirdies, careerEagles, careerPars,
    careerFairwaysHit, careerGIR, careerOnePutts,
    handicapImprovement,
  };
}

function brokeScore(threshold: number, requiredHoles: 9 | 18) {
  return (round: Round) => round.totalHoles === requiredHoles && round.totalScore > 0 && round.totalScore < threshold;
}

export const MILESTONES_18: MilestoneDefinition[] = [
  { key: 'broke_120', label: 'Broke 120', description: 'Shot under 120 for the first time', icon: '🏌️', category: 'score', rarity: 'common', check: brokeScore(120, 18) },
  { key: 'broke_110', label: 'Broke 110', description: 'Shot under 110 for the first time', icon: '🏌️', category: 'score', rarity: 'common', check: brokeScore(110, 18) },
  { key: 'broke_100', label: 'Broke 100', description: 'Shot under 100 for the first time', icon: '🥉', category: 'score', rarity: 'common', check: brokeScore(100, 18) },
  { key: 'broke_90', label: 'Broke 90', description: 'Shot under 90 for the first time', icon: '🥈', category: 'score', rarity: 'rare', check: brokeScore(90, 18) },
  { key: 'broke_80', label: 'Broke 80', description: 'Shot under 80 for the first time', icon: '🥇', category: 'score', rarity: 'epic', check: brokeScore(80, 18) },
  { key: 'broke_75', label: 'Broke 75', description: 'Shot under 75 for the first time', icon: '🥇', category: 'score', rarity: 'epic', check: brokeScore(75, 18) },
  { key: 'broke_70', label: 'Broke 70', description: 'Shot under 70 for the first time', icon: '💎', category: 'score', rarity: 'legendary', check: brokeScore(70, 18) },
  { key: 'even_par', label: 'Even Par', description: 'Shot exactly even par for a round', icon: '🎯', category: 'score', rarity: 'legendary', check: (r) => r.totalScore > 0 && r.totalPar > 0 && r.totalScore === r.totalPar },
  { key: 'under_par', label: 'Shot Under Par', description: 'Finished a round under par', icon: '🔥', category: 'score', rarity: 'legendary', check: (r) => r.totalScore > 0 && r.totalPar > 0 && r.totalScore < r.totalPar },
  { key: 'new_pb_18', label: 'New Personal Best', description: 'Beat your best ever 18-hole score', icon: '⭐', category: 'score', rarity: 'epic', check: (r, _f, c) => r.totalHoles === 18 && r.totalScore > 0 && c.previousBest18 !== null && r.totalScore < c.previousBest18 },
  { key: 'back_to_back_100', label: 'Back-to-Back Under 100', description: 'Shot under 100 two rounds in a row', icon: '🔁', category: 'score', rarity: 'rare', check: (r, _f, c) => r.totalHoles === 18 && r.totalScore > 0 && r.totalScore < 100 && c.recentScores18.length >= 1 && c.recentScores18[0] < 100 },
  { key: 'back_to_back_90', label: 'Back-to-Back Under 90', description: 'Shot under 90 two rounds in a row', icon: '🔁', category: 'score', rarity: 'epic', check: (r, _f, c) => r.totalHoles === 18 && r.totalScore > 0 && r.totalScore < 90 && c.recentScores18.length >= 1 && c.recentScores18[0] < 90 },
  { key: 'back_to_back_80', label: 'Back-to-Back Under 80', description: 'Shot under 80 two rounds in a row', icon: '🔁', category: 'score', rarity: 'legendary', check: (r, _f, c) => r.totalHoles === 18 && r.totalScore > 0 && r.totalScore < 80 && c.recentScores18.length >= 1 && c.recentScores18[0] < 80 },
];

export const MILESTONES_9: MilestoneDefinition[] = [
  { key: 'broke_50', label: 'Broke 50', description: 'Shot under 50 for the first time', icon: '🥉', category: 'score', rarity: 'common', check: brokeScore(50, 9) },
  { key: 'broke_45', label: 'Broke 45', description: 'Shot under 45 for the first time', icon: '🥈', category: 'score', rarity: 'rare', check: brokeScore(45, 9) },
  { key: 'broke_40', label: 'Broke 40', description: 'Shot under 40 for the first time', icon: '🥇', category: 'score', rarity: 'epic', check: brokeScore(40, 9) },
  { key: 'broke_35', label: 'Broke 35', description: 'Shot under 35 for the first time', icon: '💎', category: 'score', rarity: 'legendary', check: brokeScore(35, 9) },
  { key: 'new_pb_9', label: 'New Personal Best (9)', description: 'Beat your best ever 9-hole score', icon: '⭐', category: 'score', rarity: 'rare', check: (r, _f, c) => r.totalHoles === 9 && r.totalScore > 0 && c.previousBest9 !== null && r.totalScore < c.previousBest9 },
];

export const MILESTONES_BIRDIE_EAGLE: MilestoneDefinition[] = [
  { key: 'first_birdie', label: 'First Birdie', description: 'Made your first birdie', icon: '🐦', category: 'birdie_eagle', rarity: 'common', check: (_r, f) => f.birdieCount >= 1 },
  { key: 'birdies_3', label: '3 Birdies in a Round', description: 'Made 3 birdies in a single round', icon: '🐦', category: 'birdie_eagle', rarity: 'rare', check: (_r, f) => f.birdieCount >= 3 },
  { key: 'birdies_5', label: '5 Birdies in a Round', description: 'Made 5 birdies in a single round', icon: '🐦', category: 'birdie_eagle', rarity: 'epic', check: (_r, f) => f.birdieCount >= 5 },
  { key: 'first_eagle', label: 'First Eagle', description: 'Made your first eagle', icon: '🦅', category: 'birdie_eagle', rarity: 'epic', check: (_r, f) => f.eagleCount >= 1 },
  { key: 'eagles_2', label: '2 Eagles in a Round', description: 'Made 2 eagles in a single round', icon: '🦅', category: 'birdie_eagle', rarity: 'legendary', check: (_r, f) => f.eagleCount >= 2 },
  { key: 'albatross', label: 'Albatross', description: 'Made a double eagle — 3 under par on one hole', icon: '🦢', category: 'birdie_eagle', rarity: 'mythic', check: (_r, f) => f.albatrossCount >= 1 },
  { key: 'hole_in_one', label: 'Hole in One', description: 'Scored a 1 on any hole', icon: '🕳️', category: 'birdie_eagle', rarity: 'mythic', check: (_r, f) => f.holeInOne },
  { key: 'bounce_back', label: 'Bounce Back', description: 'Made a birdie on the hole right after a double bogey', icon: '💪', category: 'birdie_eagle', rarity: 'rare', check: (_r, f) => f.birdieAfterDoubleBogey },
  { key: 'back_to_back_birdies', label: '2 Birdies in a Row', description: 'Made two birdies in a row', icon: '🔥', category: 'birdie_eagle', rarity: 'rare', check: (_r, f) => f.consecutiveBirdieStreak >= 2 },
  { key: 'birdies_3_row', label: '3 Birdies in a Row', description: 'Made three birdies in a row', icon: '🔥', category: 'birdie_eagle', rarity: 'epic', check: (_r, f) => f.consecutiveBirdieStreak >= 3 },
  { key: 'birdies_4_row', label: '4 Birdies in a Row', description: 'Made four birdies in a row', icon: '🔥', category: 'birdie_eagle', rarity: 'legendary', check: (_r, f) => f.consecutiveBirdieStreak >= 4 },
  { key: 'par3_all_parred', label: 'Par 3 Perfect', description: 'Parred every par 3 in a round', icon: '🎯', category: 'birdie_eagle', rarity: 'common', check: (_r, f) => f.allPar3sParred },
  { key: 'par3_birdie', label: 'Par 3 Birdie', description: 'Made a birdie on a par 3', icon: '🎯', category: 'birdie_eagle', rarity: 'rare', check: (_r, f) => f.par3BirdieCount >= 1 },
];

export const MILESTONES_PUTTING: MilestoneDefinition[] = [
  { key: 'under_putts_36', label: 'Under 36 Putts', description: 'Took fewer than 36 putts in an 18-hole round', icon: '⛳', category: 'putting', rarity: 'common', check: (r, f) => r.totalHoles === 18 && f.totalPutts > 0 && f.totalPutts < 36 },
  { key: 'three_putt_free', label: '3-Putt-Free Round', description: 'Finished a round with no 3-putts', icon: '⛳', category: 'putting', rarity: 'common', check: (_r, f) => f.threePuttFree },
  { key: 'one_putts_5', label: '5 One-Putts in a Round', description: 'One-putted 5 holes in a single round', icon: '🎯', category: 'putting', rarity: 'rare', check: (_r, f) => f.onePuttCount >= 5 },
  { key: 'under_putts_low', label: 'Lights-Out Putting', description: 'Under 30 putts (18 holes) or under 15 putts (9 holes)', icon: '🎯', category: 'putting', rarity: 'rare', check: (r, f) => (r.totalHoles === 18 && f.totalPutts > 0 && f.totalPutts < 30) || (r.totalHoles === 9 && f.totalPutts > 0 && f.totalPutts < 15) },
  { key: 'under_putts_elite', label: 'Elite Putting', description: 'Under 28 putts (18 holes) or under 13 putts (9 holes)', icon: '🎯', category: 'putting', rarity: 'epic', check: (r, f) => (r.totalHoles === 18 && f.totalPutts > 0 && f.totalPutts < 28) || (r.totalHoles === 9 && f.totalPutts > 0 && f.totalPutts < 13) },
  { key: 'under_putts_25', label: 'Putting Wizard', description: 'Under 25 putts in an 18-hole round', icon: '🪄', category: 'putting', rarity: 'legendary', check: (r, f) => r.totalHoles === 18 && f.totalPutts > 0 && f.totalPutts < 25 },
  { key: 'career_one_putts_50', label: '50 Career One-Putts', description: 'Sank 50 one-putts across all rounds', icon: '🎯', category: 'putting', rarity: 'common', check: (_r, _f, c) => c.careerOnePutts >= 50, progress: (c) => ({ current: c.careerOnePutts, target: 50 }) },
  { key: 'career_one_putts_200', label: '200 Career One-Putts', description: 'Sank 200 one-putts across all rounds', icon: '🎯', category: 'putting', rarity: 'rare', check: (_r, _f, c) => c.careerOnePutts >= 200, progress: (c) => ({ current: c.careerOnePutts, target: 200 }) },
  { key: 'career_one_putts_500', label: '500 Career One-Putts', description: 'Sank 500 one-putts across all rounds', icon: '🎯', category: 'putting', rarity: 'epic', check: (_r, _f, c) => c.careerOnePutts >= 500, progress: (c) => ({ current: c.careerOnePutts, target: 500 }) },
];

export const MILESTONES_BALL_STRIKING: MilestoneDefinition[] = [
  { key: 'first_fairway', label: 'First Fairway Hit', description: 'Hit your first fairway in regulation', icon: '🌿', category: 'ball_striking', rarity: 'common', check: (_r, f) => f.fairwaysHit >= 1 },
  { key: 'fairways_half', label: 'Hit Half Your Fairways', description: 'Hit at least half your fairways in a round', icon: '🌿', category: 'ball_striking', rarity: 'common', check: (_r, f) => f.fairwaysEligible > 0 && f.fairwaysHit / f.fairwaysEligible >= 0.5 },
  { key: 'fairways_10', label: '10 Fairways in a Round', description: 'Hit 10 fairways in a single round', icon: '🌿', category: 'ball_striking', rarity: 'rare', check: (_r, f) => f.fairwaysHit >= 10 },
  { key: 'fairways_12', label: '12 Fairways in a Round', description: 'Hit 12 fairways in a single round', icon: '🌿', category: 'ball_striking', rarity: 'epic', check: (_r, f) => f.fairwaysHit >= 12 },
  { key: 'fairways_14', label: '14 Fairways in a Round', description: 'Hit 14 fairways in a single round', icon: '🌿', category: 'ball_striking', rarity: 'legendary', check: (_r, f) => f.fairwaysHit >= 14 },
  { key: 'fairways_all', label: 'Hit Every Fairway', description: 'Hit every fairway in a round', icon: '🌿', category: 'ball_striking', rarity: 'epic', check: (_r, f) => f.allFairwaysHit },
  { key: 'career_fairways_100', label: '100 Career Fairways', description: 'Hit 100 fairways across all rounds', icon: '🌿', category: 'ball_striking', rarity: 'common', check: (_r, _f, c) => c.careerFairwaysHit >= 100, progress: (c) => ({ current: c.careerFairwaysHit, target: 100 }) },
  { key: 'career_fairways_500', label: '500 Career Fairways', description: 'Hit 500 fairways across all rounds', icon: '🌿', category: 'ball_striking', rarity: 'rare', check: (_r, _f, c) => c.careerFairwaysHit >= 500, progress: (c) => ({ current: c.careerFairwaysHit, target: 500 }) },
  { key: 'career_fairways_1000', label: '1,000 Career Fairways', description: 'Hit 1,000 fairways across all rounds', icon: '🌿', category: 'ball_striking', rarity: 'epic', check: (_r, _f, c) => c.careerFairwaysHit >= 1000, progress: (c) => ({ current: c.careerFairwaysHit, target: 1000 }) },
  { key: 'first_gir', label: 'First Green Hit', description: 'Hit your first green in regulation', icon: '🟢', category: 'ball_striking', rarity: 'common', check: (_r, f) => f.girHit >= 1 },
  { key: 'greens_5', label: '5 Greens in a Round', description: 'Hit 5 greens in regulation in a single round', icon: '🟢', category: 'ball_striking', rarity: 'common', check: (_r, f) => f.girHit >= 5 },
  { key: 'greens_half', label: 'Hit Half Your Greens', description: 'Hit at least half your greens in regulation', icon: '🟢', category: 'ball_striking', rarity: 'common', check: (_r, f) => f.girEligible > 0 && f.girHit / f.girEligible >= 0.5 },
  { key: 'greens_10', label: '10 Greens in a Round', description: 'Hit 10 greens in regulation in a single round', icon: '🟢', category: 'ball_striking', rarity: 'rare', check: (_r, f) => f.girHit >= 10 },
  { key: 'greens_12', label: '12 Greens in a Round', description: 'Hit 12 greens in regulation in a single round', icon: '🟢', category: 'ball_striking', rarity: 'epic', check: (_r, f) => f.girHit >= 12 },
  { key: 'greens_15', label: '15 Greens in a Round', description: 'Hit 15 greens in regulation in a single round', icon: '🟢', category: 'ball_striking', rarity: 'legendary', check: (_r, f) => f.girHit >= 15 },
  { key: 'greens_all', label: 'Hit Every Green', description: 'Hit every green in regulation', icon: '🟢', category: 'ball_striking', rarity: 'legendary', check: (_r, f) => f.allGreensHit },
  { key: 'career_gir_50', label: '50 Career GIRs', description: 'Hit 50 greens in regulation across all rounds', icon: '🟢', category: 'ball_striking', rarity: 'common', check: (_r, _f, c) => c.careerGIR >= 50, progress: (c) => ({ current: c.careerGIR, target: 50 }) },
  { key: 'career_gir_250', label: '250 Career GIRs', description: 'Hit 250 greens in regulation across all rounds', icon: '🟢', category: 'ball_striking', rarity: 'rare', check: (_r, _f, c) => c.careerGIR >= 250, progress: (c) => ({ current: c.careerGIR, target: 250 }) },
  { key: 'career_gir_500', label: '500 Career GIRs', description: 'Hit 500 greens in regulation across all rounds', icon: '🟢', category: 'ball_striking', rarity: 'epic', check: (_r, _f, c) => c.careerGIR >= 500, progress: (c) => ({ current: c.careerGIR, target: 500 }) },
];

export const MILESTONES_CLEAN_ROUND: MilestoneDefinition[] = [
  { key: 'double_bogey_free', label: 'Double-Bogey-Free Round', description: 'No hole worse than a double bogey', icon: '🧹', category: 'clean_round', rarity: 'common', check: (_r, f) => f.doubleBogeyFree },
  { key: 'no_worse_than_bogey', label: 'No Worse Than Bogey', description: 'No hole worse than a bogey', icon: '🧹', category: 'clean_round', rarity: 'rare', check: (_r, f) => f.noWorseThanBogey },
  { key: 'bogey_free', label: 'Bogey-Free Round', description: 'Played an entire round at par or better on every hole', icon: '✨', category: 'clean_round', rarity: 'epic', check: (_r, f) => f.bogeyFreeRound },
  { key: 'penalty_free', label: 'Penalty-Free Round', description: 'Finished a round with zero penalty strokes', icon: '🚫', category: 'clean_round', rarity: 'common', check: (_r, f) => f.penaltyFreeRound },
  { key: 'no_blow_up', label: 'No Blow-Up Holes', description: 'No hole scored triple bogey or worse', icon: '🛡️', category: 'clean_round', rarity: 'common', check: (_r, f) => f.noBlowUpHoles },
  { key: 'pars_2_row', label: '2 Pars in a Row', description: 'Made two consecutive pars or better', icon: '🔗', category: 'clean_round', rarity: 'common', check: (_r, f) => f.consecutiveParStreak >= 2 },
  { key: 'pars_3_row', label: '3 Pars in a Row', description: 'Made three consecutive pars or better', icon: '🔗', category: 'clean_round', rarity: 'common', check: (_r, f) => f.consecutiveParStreak >= 3 },
  { key: 'pars_5_row', label: '5 Pars in a Row', description: 'Made five consecutive pars or better', icon: '🔗', category: 'clean_round', rarity: 'rare', check: (_r, f) => f.consecutiveParStreak >= 5 },
  { key: 'pars_10_row', label: '10 Pars in a Row', description: 'Made ten consecutive pars or better', icon: '🔗', category: 'clean_round', rarity: 'legendary', check: (_r, f) => f.consecutiveParStreak >= 10 },
];

export const MILESTONES_CAREER: MilestoneDefinition[] = [
  { key: 'rounds_10', label: '10 Rounds Played', description: 'Logged 10 rounds', icon: '📋', category: 'career', rarity: 'common', check: (_r, _f, c) => c.roundsPlayed >= 10, progress: (c) => ({ current: c.roundsPlayed, target: 10 }) },
  { key: 'rounds_25', label: '25 Rounds Played', description: 'Logged 25 rounds', icon: '📋', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.roundsPlayed >= 25, progress: (c) => ({ current: c.roundsPlayed, target: 25 }) },
  { key: 'rounds_50', label: '50 Rounds Played', description: 'Logged 50 rounds', icon: '📋', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.roundsPlayed >= 50, progress: (c) => ({ current: c.roundsPlayed, target: 50 }) },
  { key: 'rounds_100', label: '100 Rounds Played', description: 'Logged 100 rounds', icon: '📋', category: 'career', rarity: 'legendary', check: (_r, _f, c) => c.roundsPlayed >= 100, progress: (c) => ({ current: c.roundsPlayed, target: 100 }) },
  { key: 'courses_5', label: 'Played 5 Different Courses', description: 'Played 5 different courses', icon: '🗺️', category: 'career', rarity: 'common', check: (_r, _f, c) => c.coursesPlayed >= 5, progress: (c) => ({ current: c.coursesPlayed, target: 5 }) },
  { key: 'courses_10', label: 'Played 10 Different Courses', description: 'Played 10 different courses', icon: '🗺️', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.coursesPlayed >= 10, progress: (c) => ({ current: c.coursesPlayed, target: 10 }) },
  { key: 'courses_25', label: 'Played 25 Different Courses', description: 'Played 25 different courses', icon: '🗺️', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.coursesPlayed >= 25, progress: (c) => ({ current: c.coursesPlayed, target: 25 }) },
  { key: 'handicap_established', label: 'Handicap Established', description: 'Played enough rounds to establish a handicap index', icon: '📊', category: 'career', rarity: 'common', check: (_r, _f, c) => c.handicapIndex !== null },
  { key: 'handicap_30', label: 'Below 30 Handicap', description: 'Handicap index reached 30 or better', icon: '📊', category: 'career', rarity: 'common', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 30 },
  { key: 'handicap_25', label: 'Below 25 Handicap', description: 'Handicap index reached 25 or better', icon: '📊', category: 'career', rarity: 'common', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 25 },
  { key: 'handicap_20', label: 'Below 20 Handicap', description: 'Handicap index reached 20 or better', icon: '📊', category: 'career', rarity: 'common', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 20 },
  { key: 'handicap_18', label: 'Below 18 Handicap', description: 'Handicap index reached 18 or better', icon: '📊', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 18 },
  { key: 'handicap_15', label: 'Below 15 Handicap', description: 'Handicap index reached 15 or better', icon: '📊', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 15 },
  { key: 'handicap_12', label: 'Below 12 Handicap', description: 'Handicap index reached 12 or better', icon: '📊', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 12 },
  { key: 'handicap_10', label: 'Below 10 Handicap', description: 'Handicap index reached 10 or better', icon: '📊', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 10 },
  { key: 'handicap_single', label: 'Single Digits', description: 'Reached a single-digit handicap index', icon: '🏆', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex < 10 },
  { key: 'handicap_8', label: 'Below 8 Handicap', description: 'Handicap index reached 8 or better', icon: '📊', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 8 },
  { key: 'handicap_5', label: 'Below 5 Handicap', description: 'Handicap index reached 5 or better', icon: '📊', category: 'career', rarity: 'legendary', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 5 },
  { key: 'handicap_scratch', label: 'Scratch Golfer', description: 'Reached a scratch handicap (0 or better)', icon: '👑', category: 'career', rarity: 'legendary', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex <= 0 },
  { key: 'handicap_plus', label: 'Plus Handicap', description: 'Reached a plus handicap (better than scratch)', icon: '👑', category: 'career', rarity: 'mythic', check: (_r, _f, c) => c.handicapIndex !== null && c.handicapIndex < 0 },
  { key: 'handicap_improved_5', label: 'Improved 5 Strokes', description: 'Improved handicap by 5 strokes from starting index', icon: '📈', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.handicapImprovement !== null && c.handicapImprovement >= 5 },
  { key: 'handicap_improved_10', label: 'Improved 10 Strokes', description: 'Improved handicap by 10 strokes from starting index', icon: '📈', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.handicapImprovement !== null && c.handicapImprovement >= 10 },
  { key: 'handicap_improved_15', label: 'Improved 15 Strokes', description: 'Improved handicap by 15 strokes from starting index', icon: '📈', category: 'career', rarity: 'legendary', check: (_r, _f, c) => c.handicapImprovement !== null && c.handicapImprovement >= 15 },
  { key: 'handicap_improved_20', label: 'Improved 20 Strokes', description: 'Improved handicap by 20 strokes from starting index', icon: '📈', category: 'career', rarity: 'mythic', check: (_r, _f, c) => c.handicapImprovement !== null && c.handicapImprovement >= 20 },
  { key: 'career_birdies_10', label: '10 Career Birdies', description: 'Made 10 birdies across all rounds', icon: '🐦', category: 'career', rarity: 'common', check: (_r, _f, c) => c.careerBirdies >= 10, progress: (c) => ({ current: c.careerBirdies, target: 10 }) },
  { key: 'career_birdies_25', label: '25 Career Birdies', description: 'Made 25 birdies across all rounds', icon: '🐦', category: 'career', rarity: 'common', check: (_r, _f, c) => c.careerBirdies >= 25, progress: (c) => ({ current: c.careerBirdies, target: 25 }) },
  { key: 'career_birdies_50', label: '50 Career Birdies', description: 'Made 50 birdies across all rounds', icon: '🐦', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.careerBirdies >= 50, progress: (c) => ({ current: c.careerBirdies, target: 50 }) },
  { key: 'career_birdies_100', label: '100 Career Birdies', description: 'Made 100 birdies across all rounds', icon: '🐦', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.careerBirdies >= 100, progress: (c) => ({ current: c.careerBirdies, target: 100 }) },
  { key: 'career_birdies_250', label: '250 Career Birdies', description: 'Made 250 birdies across all rounds', icon: '🐦', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.careerBirdies >= 250, progress: (c) => ({ current: c.careerBirdies, target: 250 }) },
  { key: 'career_birdies_500', label: '500 Career Birdies', description: 'Made 500 birdies across all rounds', icon: '🐦', category: 'career', rarity: 'legendary', check: (_r, _f, c) => c.careerBirdies >= 500, progress: (c) => ({ current: c.careerBirdies, target: 500 }) },
  { key: 'career_birdies_1000', label: '1,000 Career Birdies', description: 'Made 1,000 birdies across all rounds', icon: '🐦', category: 'career', rarity: 'mythic', check: (_r, _f, c) => c.careerBirdies >= 1000, progress: (c) => ({ current: c.careerBirdies, target: 1000 }) },
  { key: 'career_eagles_5', label: '5 Career Eagles', description: 'Made 5 eagles across all rounds', icon: '🦅', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.careerEagles >= 5, progress: (c) => ({ current: c.careerEagles, target: 5 }) },
  { key: 'career_eagles_10', label: '10 Career Eagles', description: 'Made 10 eagles across all rounds', icon: '🦅', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.careerEagles >= 10, progress: (c) => ({ current: c.careerEagles, target: 10 }) },
  { key: 'career_eagles_25', label: '25 Career Eagles', description: 'Made 25 eagles across all rounds', icon: '🦅', category: 'career', rarity: 'legendary', check: (_r, _f, c) => c.careerEagles >= 25, progress: (c) => ({ current: c.careerEagles, target: 25 }) },
  { key: 'career_eagles_50', label: '50 Career Eagles', description: 'Made 50 eagles across all rounds', icon: '🦅', category: 'career', rarity: 'mythic', check: (_r, _f, c) => c.careerEagles >= 50, progress: (c) => ({ current: c.careerEagles, target: 50 }) },
  { key: 'career_pars_100', label: '100 Career Pars', description: 'Made 100 pars across all rounds', icon: '⛳', category: 'career', rarity: 'common', check: (_r, _f, c) => c.careerPars >= 100, progress: (c) => ({ current: c.careerPars, target: 100 }) },
  { key: 'career_pars_500', label: '500 Career Pars', description: 'Made 500 pars across all rounds', icon: '⛳', category: 'career', rarity: 'rare', check: (_r, _f, c) => c.careerPars >= 500, progress: (c) => ({ current: c.careerPars, target: 500 }) },
  { key: 'career_pars_1000', label: '1,000 Career Pars', description: 'Made 1,000 pars across all rounds', icon: '⛳', category: 'career', rarity: 'epic', check: (_r, _f, c) => c.careerPars >= 1000, progress: (c) => ({ current: c.careerPars, target: 1000 }) },
  { key: 'career_pars_5000', label: '5,000 Career Pars', description: 'Made 5,000 pars across all rounds', icon: '⛳', category: 'career', rarity: 'legendary', check: (_r, _f, c) => c.careerPars >= 5000, progress: (c) => ({ current: c.careerPars, target: 5000 }) },
];

export const ALL_MILESTONES: MilestoneDefinition[] = [
  ...MILESTONES_18,
  ...MILESTONES_9,
  ...MILESTONES_BIRDIE_EAGLE,
  ...MILESTONES_PUTTING,
  ...MILESTONES_BALL_STRIKING,
  ...MILESTONES_CLEAN_ROUND,
  ...MILESTONES_CAREER,
];

export type BadgeGroup = {
  id: string;
  name: string;
  icon: string;
  category: Category;
  tiers: string[];
};

export const BADGE_GROUPS: BadgeGroup[] = [
  // Score
  { id: 'breaking_barriers', name: 'Breaking Barriers', icon: '🏌️', category: 'score', tiers: ['broke_120', 'broke_110', 'broke_100', 'broke_90', 'broke_80', 'broke_75', 'broke_70'] },
  { id: 'front_nine', name: 'Front Nine', icon: '⛳', category: 'score', tiers: ['broke_50', 'broke_45', 'broke_40', 'broke_35'] },
  { id: 'on_a_roll', name: 'On a Roll', icon: '🔁', category: 'score', tiers: ['back_to_back_100', 'back_to_back_90', 'back_to_back_80'] },
  // Birdie & Eagle
  { id: 'birdie_hunter', name: 'Birdie Hunter', icon: '🐦', category: 'birdie_eagle', tiers: ['first_birdie', 'birdies_3', 'birdies_5'] },
  { id: 'eagle_hunter', name: 'Eagle Hunter', icon: '🦅', category: 'birdie_eagle', tiers: ['first_eagle', 'eagles_2'] },
  { id: 'on_fire', name: 'On Fire', icon: '🔥', category: 'birdie_eagle', tiers: ['back_to_back_birdies', 'birdies_3_row', 'birdies_4_row'] },
  // Putting
  { id: 'putting_machine', name: 'Putting Machine', icon: '🪄', category: 'putting', tiers: ['under_putts_36', 'under_putts_low', 'under_putts_elite', 'under_putts_25'] },
  { id: 'silk_touch', name: 'Silk Touch', icon: '🎯', category: 'putting', tiers: ['career_one_putts_50', 'career_one_putts_200', 'career_one_putts_500'] },
  // Ball Striking
  { id: 'straight_arrow', name: 'Straight Arrow', icon: '🌿', category: 'ball_striking', tiers: ['first_fairway', 'fairways_half', 'fairways_10', 'fairways_12', 'fairways_14', 'fairways_all'] },
  { id: 'fairway_finder', name: 'Fairway Finder', icon: '🍃', category: 'ball_striking', tiers: ['career_fairways_100', 'career_fairways_500', 'career_fairways_1000'] },
  { id: 'green_light', name: 'Green Light', icon: '🟢', category: 'ball_striking', tiers: ['first_gir', 'greens_5', 'greens_half', 'greens_10', 'greens_12', 'greens_15', 'greens_all'] },
  { id: 'green_seeker', name: 'Green Seeker', icon: '🎯', category: 'ball_striking', tiers: ['career_gir_50', 'career_gir_250', 'career_gir_500'] },
  // Clean Rounds
  { id: 'the_shield', name: 'The Shield', icon: '🛡️', category: 'clean_round', tiers: ['double_bogey_free', 'no_worse_than_bogey', 'bogey_free'] },
  { id: 'steady_eddie', name: 'Steady Eddie', icon: '🔗', category: 'clean_round', tiers: ['pars_2_row', 'pars_3_row', 'pars_5_row', 'pars_10_row'] },
  // Career
  { id: 'road_warrior', name: 'Road Warrior', icon: '📋', category: 'career', tiers: ['rounds_10', 'rounds_25', 'rounds_50', 'rounds_100'] },
  { id: 'course_explorer', name: 'Course Explorer', icon: '🗺️', category: 'career', tiers: ['courses_5', 'courses_10', 'courses_25'] },
  { id: 'the_climb', name: 'The Climb', icon: '📊', category: 'career', tiers: ['handicap_established', 'handicap_30', 'handicap_25', 'handicap_20', 'handicap_18', 'handicap_15', 'handicap_12', 'handicap_10', 'handicap_single', 'handicap_8', 'handicap_5', 'handicap_scratch', 'handicap_plus'] },
  { id: 'rising_star', name: 'Rising Star', icon: '📈', category: 'career', tiers: ['handicap_improved_5', 'handicap_improved_10', 'handicap_improved_15', 'handicap_improved_20'] },
  { id: 'birdie_machine', name: 'Birdie Machine', icon: '🐦', category: 'career', tiers: ['career_birdies_10', 'career_birdies_25', 'career_birdies_50', 'career_birdies_100', 'career_birdies_250', 'career_birdies_500', 'career_birdies_1000'] },
  { id: 'eagle_eye', name: 'Eagle Eye', icon: '🦅', category: 'career', tiers: ['career_eagles_5', 'career_eagles_10', 'career_eagles_25', 'career_eagles_50'] },
  { id: 'par_excellence', name: 'Par Excellence', icon: '⛳', category: 'career', tiers: ['career_pars_100', 'career_pars_500', 'career_pars_1000', 'career_pars_5000'] },
];

export async function detectNewMilestones(round: Round, holes: Hole[], userId: string): Promise<MilestoneDefinition[]> {
  const allRounds = getRounds();
  const allHoles = getAllHoles();
  const feats = computeRoundFeats(round, holes);
  const career = computeCareerStats(allRounds, allHoles, round.id);

  const eligible = ALL_MILESTONES.filter((m) => m.check(round, feats, career));
  if (eligible.length === 0) return [];

  const { data: existing } = await supabase
    .from('achievements')
    .select('milestone_key')
    .eq('user_id', userId)
    .in('milestone_key', eligible.map((m) => m.key));
  const existingKeys = new Set((existing ?? []).map((e: any) => e.milestone_key));
  const trulyNew = eligible.filter((m) => !existingKeys.has(m.key));
  if (trulyNew.length === 0) return [];

  await supabase.from('achievements').insert(
    trulyNew.map((m) => ({
      user_id: userId,
      milestone_key: m.key,
      round_score: round.totalScore,
      local_round_id: round.id ?? null,
      shared: false,
    }))
  );

  return trulyNew;
}

export async function shareMilestoneToClubhouse(
  userId: string,
  milestone: MilestoneDefinition,
  round: Round
): Promise<void> {
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      course_name: round.courseName,
      total_score: round.totalScore,
      total_par: round.totalPar,
      total_holes: round.totalHoles,
      date: round.date,
      notes: `🏆 ${milestone.label}! ${milestone.description}.`,
      local_round_id: round.id ?? null,
    })
    .select('id')
    .single();

  if (error || !post) return;

  await supabase
    .from('achievements')
    .update({ shared: true, shared_post_id: post.id })
    .eq('user_id', userId)
    .eq('milestone_key', milestone.key);
}
