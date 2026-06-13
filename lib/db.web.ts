// Web version of the database — in-memory cache + Supabase cloud sync
// (SQLite is phone-only; this file is automatically used in a browser)

import { supabase } from './supabase';

export type Hole = {
  id?: number;
  roundId: number;
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fairwayHit: boolean;
  greenInRegulation: boolean;
  girMiss?: 'long' | 'short' | 'left' | 'right' | null;
  fairwayMiss?: 'left' | 'right' | null;
  penalties?: number;
};

export type Round = {
  id?: number;
  date: string;
  courseName: string;
  totalHoles: number;
  totalScore: number;
  totalPar: number;
  notes: string;
  remoteId?: string;
  courseRating?: number;
  slopeRating?: number;
};

let rounds: Round[] = [];
let holes: Hole[] = [];
let courses: Record<string, { rating: number; slope: number }> = {};
let nextRoundId = 1;
let nextHoleId = 1;
let cloudUserId: string | null = null;

// Promise that resolves when the initial cloud load is complete
let _cloudResolve: (() => void) | null = null;
let _cloudReady: Promise<void> = new Promise(r => { _cloudResolve = r; });

export function getCloudReady() { return _cloudReady; }

export function initDb() {}

export async function loadFromCloud(userId: string): Promise<void> {
  // If switching users, reset the ready promise
  if (cloudUserId && cloudUserId !== userId) {
    _cloudReady = new Promise(r => { _cloudResolve = r; });
    rounds = []; holes = []; courses = {};
    nextRoundId = 1; nextHoleId = 1;
  }
  cloudUserId = userId;
  try {
    const { data } = await supabase
      .from('user_data')
      .select('rounds, holes, courses')
      .eq('user_id', userId)
      .single();
    if (data) {
      rounds = (data.rounds as Round[]) ?? [];
      holes = (data.holes as Hole[]) ?? [];
      courses = (data.courses as Record<string, { rating: number; slope: number }>) ?? {};
      nextRoundId = rounds.length > 0 ? Math.max(...rounds.map(r => r.id ?? 0)) + 1 : 1;
      nextHoleId = holes.length > 0 ? Math.max(...holes.map(h => h.id ?? 0)) + 1 : 1;
    }
  } catch {
    // No row yet (first use) or offline — start with empty data
  } finally {
    _cloudResolve?.();
  }
}

function syncToCloud() {
  if (!cloudUserId) return;
  supabase.from('user_data').upsert({
    user_id: cloudUserId,
    rounds,
    holes,
    courses,
    updated_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.warn('Cloud sync failed:', error.message);
  });
}

export function createRound(
  courseName: string,
  totalHoles: number,
  courseRating = 0,
  slopeRating = 113
): number {
  const id = nextRoundId++;
  const date = new Date().toISOString().split('T')[0];
  rounds.push({ id, date, courseName, totalHoles, totalScore: 0, totalPar: 0, notes: '', courseRating, slopeRating });
  if (courseRating > 0) {
    courses[courseName.toLowerCase().trim()] = { rating: courseRating, slope: slopeRating };
  }
  syncToCloud();
  return id;
}

export function getCourse(name: string): { rating: number; slope: number } | null {
  return courses[name.toLowerCase().trim()] ?? null;
}

export function saveHole(hole: Omit<Hole, 'id'>) {
  const idx = holes.findIndex(
    h => h.roundId === hole.roundId && h.holeNumber === hole.holeNumber
  );
  if (idx >= 0) {
    holes[idx] = { ...holes[idx], ...hole };
  } else {
    holes.push({ ...hole, id: nextHoleId++ });
  }
  syncToCloud();
}

export function finalizeRound(roundId: number) {
  const roundHoles = holes.filter(h => h.roundId === roundId);
  const totalScore = roundHoles.reduce((s, h) => s + h.score, 0);
  const totalPar = roundHoles.reduce((s, h) => s + h.par, 0);
  const round = rounds.find(r => r.id === roundId);
  if (round) { round.totalScore = totalScore; round.totalPar = totalPar; }
  syncToCloud();
}

export function getRounds(): Round[] {
  return [...rounds].sort((a, b) => b.date.localeCompare(a.date));
}

export function getHoles(roundId: number): Hole[] {
  return holes
    .filter(h => h.roundId === roundId)
    .sort((a, b) => a.holeNumber - b.holeNumber);
}

export function deleteRound(roundId: number) {
  rounds = rounds.filter(r => r.id !== roundId);
  holes = holes.filter(h => h.roundId !== roundId);
  syncToCloud();
}

export function markRoundShared(roundId: number, remoteId: string) {
  const round = rounds.find(r => r.id === roundId);
  if (round) { round.remoteId = remoteId; syncToCloud(); }
}
