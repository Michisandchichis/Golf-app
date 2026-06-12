// Web version of the database — uses in-memory storage instead of SQLite
// (SQLite is phone-only; this file is automatically used when running in a browser)

export type Hole = {
  id?: number;
  roundId: number;
  holeNumber: number;
  par: number;
  score: number;
  putts: number;
  fairwayHit: boolean;
  greenInRegulation: boolean;
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

export function initDb() {}

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
  return id;
}

export function getCourse(name: string): { rating: number; slope: number } | null {
  return courses[name.toLowerCase().trim()] ?? null;
}

export function saveHole(hole: Omit<Hole, 'id'>) {
  const idx = holes.findIndex(
    (h) => h.roundId === hole.roundId && h.holeNumber === hole.holeNumber
  );
  if (idx >= 0) {
    holes[idx] = { ...holes[idx], ...hole };
  } else {
    holes.push({ ...hole, id: nextHoleId++ });
  }
}

export function finalizeRound(roundId: number) {
  const roundHoles = holes.filter((h) => h.roundId === roundId);
  const totalScore = roundHoles.reduce((sum, h) => sum + h.score, 0);
  const totalPar = roundHoles.reduce((sum, h) => sum + h.par, 0);
  const round = rounds.find((r) => r.id === roundId);
  if (round) {
    round.totalScore = totalScore;
    round.totalPar = totalPar;
  }
}

export function getRounds(): Round[] {
  return [...rounds].sort((a, b) => b.date.localeCompare(a.date));
}

export function getHoles(roundId: number): Hole[] {
  return holes
    .filter((h) => h.roundId === roundId)
    .sort((a, b) => a.holeNumber - b.holeNumber);
}

export function deleteRound(roundId: number) {
  rounds = rounds.filter((r) => r.id !== roundId);
  holes = holes.filter((h) => h.roundId !== roundId);
}

export function markRoundShared(roundId: number, remoteId: string) {
  const round = rounds.find((r) => r.id === roundId);
  if (round) round.remoteId = remoteId;
}
