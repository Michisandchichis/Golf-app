import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('golf.db');

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

export function initDb() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      courseName TEXT NOT NULL,
      totalHoles INTEGER NOT NULL,
      totalScore INTEGER DEFAULT 0,
      totalPar INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      courseRating REAL DEFAULT 0,
      slopeRating INTEGER DEFAULT 113
    );

    CREATE TABLE IF NOT EXISTS holes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roundId INTEGER NOT NULL,
      holeNumber INTEGER NOT NULL,
      par INTEGER NOT NULL,
      score INTEGER NOT NULL,
      putts INTEGER DEFAULT 0,
      fairwayHit INTEGER DEFAULT 0,
      greenInRegulation INTEGER DEFAULT 0,
      FOREIGN KEY (roundId) REFERENCES rounds(id)
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      rating REAL NOT NULL,
      slope INTEGER NOT NULL
    );
  `);
  try { db.execSync('ALTER TABLE rounds ADD COLUMN remoteId TEXT'); } catch {}
  try { db.execSync('ALTER TABLE rounds ADD COLUMN courseRating REAL DEFAULT 0'); } catch {}
  try { db.execSync('ALTER TABLE rounds ADD COLUMN slopeRating INTEGER DEFAULT 113'); } catch {}
  try { db.execSync('ALTER TABLE holes ADD COLUMN girMiss TEXT'); } catch {}
  try { db.execSync('ALTER TABLE holes ADD COLUMN fairwayMiss TEXT'); } catch {}
  try { db.execSync('ALTER TABLE holes ADD COLUMN penalties INTEGER DEFAULT 0'); } catch {}
}

export function markRoundShared(roundId: number, remoteId: string) {
  db.runSync('UPDATE rounds SET remoteId = ? WHERE id = ?', [remoteId, roundId]);
}

export function createRound(
  courseName: string,
  totalHoles: number,
  courseRating = 0,
  slopeRating = 113
): number {
  const date = new Date().toISOString().split('T')[0];
  const result = db.runSync(
    'INSERT INTO rounds (date, courseName, totalHoles, courseRating, slopeRating) VALUES (?, ?, ?, ?, ?)',
    [date, courseName, totalHoles, courseRating, slopeRating]
  );
  if (courseRating > 0) {
    try {
      db.runSync(
        'INSERT OR REPLACE INTO courses (name, rating, slope) VALUES (?, ?, ?)',
        [courseName.toLowerCase().trim(), courseRating, slopeRating]
      );
    } catch {}
  }
  return result.lastInsertRowId;
}

export function getCourse(name: string): { rating: number; slope: number } | null {
  const result = db.getFirstSync<{ rating: number; slope: number }>(
    'SELECT rating, slope FROM courses WHERE name = ?',
    [name.toLowerCase().trim()]
  );
  return result ?? null;
}

export function saveHole(hole: Omit<Hole, 'id'>) {
  db.runSync(
    `INSERT OR REPLACE INTO holes
      (roundId, holeNumber, par, score, putts, fairwayHit, greenInRegulation, girMiss, fairwayMiss, penalties)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hole.roundId,
      hole.holeNumber,
      hole.par,
      hole.score,
      hole.putts,
      hole.fairwayHit ? 1 : 0,
      hole.greenInRegulation ? 1 : 0,
      hole.girMiss ?? null,
      hole.fairwayMiss ?? null,
      hole.penalties ?? 0,
    ]
  );
}

export function finalizeRound(roundId: number) {
  const holes = db.getAllSync<Hole>(
    'SELECT * FROM holes WHERE roundId = ?',
    [roundId]
  );
  const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
  db.runSync(
    'UPDATE rounds SET totalScore = ?, totalPar = ? WHERE id = ?',
    [totalScore, totalPar, roundId]
  );
}

export function getRounds(): Round[] {
  return db.getAllSync<Round>('SELECT * FROM rounds ORDER BY date DESC');
}

export function getHoles(roundId: number): Hole[] {
  return db.getAllSync<Hole>(
    'SELECT * FROM holes WHERE roundId = ? ORDER BY holeNumber',
    [roundId]
  );
}

export function deleteRound(roundId: number) {
  db.runSync('DELETE FROM holes WHERE roundId = ?', [roundId]);
  db.runSync('DELETE FROM rounds WHERE id = ?', [roundId]);
}

// No-op stubs — native uses SQLite directly, cloud sync not needed here
export async function loadFromCloud(_userId: string): Promise<void> {}
export function getCloudReady(): Promise<void> { return Promise.resolve(); }
