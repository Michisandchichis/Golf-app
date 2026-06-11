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
};

export type Round = {
  id?: number;
  date: string;
  courseName: string;
  totalHoles: number;
  totalScore: number;
  totalPar: number;
  notes: string;
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
      notes TEXT DEFAULT ''
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
  `);
}

export function createRound(courseName: string, totalHoles: number): number {
  const date = new Date().toISOString().split('T')[0];
  const result = db.runSync(
    'INSERT INTO rounds (date, courseName, totalHoles) VALUES (?, ?, ?)',
    [date, courseName, totalHoles]
  );
  return result.lastInsertRowId;
}

export function saveHole(hole: Omit<Hole, 'id'>) {
  db.runSync(
    `INSERT OR REPLACE INTO holes
      (roundId, holeNumber, par, score, putts, fairwayHit, greenInRegulation)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      hole.roundId,
      hole.holeNumber,
      hole.par,
      hole.score,
      hole.putts,
      hole.fairwayHit ? 1 : 0,
      hole.greenInRegulation ? 1 : 0,
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
