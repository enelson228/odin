import Database from 'better-sqlite3';

export interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
}

/**
 * All schema migrations in order.
 * Version 1 is the initial schema (created by schema.sql).
 * Add new migrations here as the schema evolves.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — created by schema.sql',
    up: (_db) => {
      // No-op: initial schema is applied separately via schema.sql
    },
  },
  {
    version: 2,
    description: 'Remove FK constraint from conflict_events.iso3 to allow disputed territories',
    up: (db) => {
      // SQLite does not support DROP CONSTRAINT — must recreate the table.
      // This allows ACLED events for Kosovo, Taiwan, Palestinian State, etc.
      // to be stored even if those territories are not in the countries table.
      db.exec(`
        CREATE TABLE IF NOT EXISTS conflict_events_v2 (
          id TEXT PRIMARY KEY,
          iso3 TEXT NOT NULL,
          event_date TEXT NOT NULL,
          event_type TEXT NOT NULL,
          sub_event_type TEXT,
          actor1 TEXT,
          actor2 TEXT,
          location TEXT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          fatalities INTEGER DEFAULT 0,
          notes TEXT,
          source TEXT,
          source_scale TEXT
        );
        INSERT OR IGNORE INTO conflict_events_v2
          SELECT id, iso3, event_date, event_type, sub_event_type,
                 actor1, actor2, location, latitude, longitude,
                 fatalities, notes, source, source_scale
          FROM conflict_events;
        DROP TABLE conflict_events;
        ALTER TABLE conflict_events_v2 RENAME TO conflict_events;
        CREATE INDEX IF NOT EXISTS idx_conflicts_iso3 ON conflict_events(iso3);
        CREATE INDEX IF NOT EXISTS idx_conflicts_date ON conflict_events(event_date);
        CREATE INDEX IF NOT EXISTS idx_conflicts_type ON conflict_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_conflicts_geo ON conflict_events(latitude, longitude);
      `);
    },
  },
];

/**
 * Gets the current schema version from the database.
 * Returns 0 if schema_version table exists but is empty, or -1 if table doesn't exist.
 */
export function getCurrentVersion(db: Database.Database): number {
  try {
    const row = db
      .prepare('SELECT MAX(version) as v FROM schema_version')
      .get() as { v: number | null } | undefined;
    return row?.v ?? 0;
  } catch {
    return -1;
  }
}

/**
 * Runs all pending migrations up to the latest version.
 * Wraps each migration in a transaction for safety.
 */
export function runMigrations(db: Database.Database): void {
  const currentVersion = getCurrentVersion(db);
  const pending = MIGRATIONS.filter(m => m.version > currentVersion);

  if (pending.length === 0) return;

  console.log(`[Migrations] Running ${pending.length} pending migration(s) from v${currentVersion}`);

  for (const migration of pending) {
    const applyMigration = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(migration.version);
    });

    try {
      applyMigration();
      console.log(`[Migrations] Applied v${migration.version}: ${migration.description}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Migrations] Failed to apply v${migration.version}: ${message}`);
      throw new Error(`Migration v${migration.version} failed: ${message}`);
    }
  }

  const latestVersion = MIGRATIONS[MIGRATIONS.length - 1].version;
  console.log(`[Migrations] Database is now at schema version ${latestVersion}`);
}
