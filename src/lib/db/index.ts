import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'mapannai.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
    if (_db) return _db
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    initSchema(_db)
    return _db
}

function initSchema(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS trips (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            description TEXT,
            start_date  TEXT NOT NULL,
            end_date    TEXT NOT NULL,
            cover_image TEXT,
            emoji       TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS trip_days (
            id          TEXT PRIMARY KEY,
            trip_id     TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
            date        TEXT NOT NULL,
            title       TEXT,
            marker_ids  TEXT NOT NULL DEFAULT '[]'
        );

        CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON trip_days(trip_id);
    `)
}
