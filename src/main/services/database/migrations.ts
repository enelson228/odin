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
  // Future migrations go here:
  // {
  //   version: 2,
  //   description: 'Add index on conflict_events.fatalities',
  //   up: (db) => {
  //     db.exec('CREATE INDEX IF NOT EXISTS idx_conflicts_fatalities ON conflict_events(fatalities)');
  //   },
  // },
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
