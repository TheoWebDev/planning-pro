import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Ouvre (ou crée) le fichier SQLite qui contient l'unique état de l'application.
 * WAL + synchronous FULL : un arrêt du conteneur ne perd pas la dernière saisie.
 */
export function openDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA synchronous = FULL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return database;
}

/** @returns {unknown | null} */
export function readState(database) {
  const row = database.prepare('SELECT payload FROM app_state WHERE id = 1').get();
  if (!row) {
    return null;
  }
  return JSON.parse(row.payload);
}

/** @param {unknown} state */
export function writeState(database, state) {
  database
    .prepare(
      `INSERT INTO app_state (id, payload, updated_at)
       VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
    )
    .run(JSON.stringify(state), new Date().toISOString());
}
