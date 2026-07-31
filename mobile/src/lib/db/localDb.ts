// ---------------------------------------------------------------------------
// expo-sqlite v14 database singleton
// ---------------------------------------------------------------------------
// Opens 'society_guard.db' and runs schema migrations on first call.
// Idempotent — safe to call on every app launch.
// ---------------------------------------------------------------------------

import * as SQLite from 'expo-sqlite';
import { SCHEMA_STATEMENTS } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the shared SQLiteDatabase instance, opening it and running all
 * CREATE TABLE IF NOT EXISTS migrations the first time it is called.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;

  const db = await SQLite.openDatabaseAsync('society_guard.db');
  await runMigrations(db);
  _db = db;
  return db;
}

/**
 * Executes every schema statement sequentially.
 * Uses execAsync which accepts a single SQL string or multiple statements
 * separated by semicolons; we iterate to be explicit about each DDL step.
 */
export async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const sql of SCHEMA_STATEMENTS) {
    await db.execAsync(sql);
  }
}

/**
 * Resets the singleton — intended for unit tests only.
 * @internal
 */
export function _resetDbSingleton(): void {
  _db = null;
}
