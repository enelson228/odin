import Database from 'better-sqlite3';
import type {
  Country,
  ConflictEvent,
  ArmsTransfer,
  MilitaryInstallation,
  WorldBankIndicator,
  ConflictFilters,
  ArmsFilters,
  SyncStatus,
  SyncLogEntry,
  AppSettings,
} from '@shared/types';
import schemaSql from './schema.sql?raw';

const DEFAULT_SETTINGS: AppSettings = {
  acledEmail: '',
  acledPassword: '',
  acledAccessToken: '',
  acledRefreshToken: '',
  acledTokenExpiry: 0,
  acledRefreshTokenExpiry: 0,
  syncIntervalMinutes: 360,
  mapDefaultCenter: [20, 0],
  mapDefaultZoom: 3,
  displayTimezone: '',
};

const CURRENT_SCHEMA_VERSION = 1;

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Initialize the database schema.
   * The SQL is bundled at build time via Vite's ?raw import.
   */
  initSchema(): void {
    this.db.exec(schemaSql);

    // Record schema version if not already present
    const row = this.db
      .prepare('SELECT version FROM schema_version WHERE version = ?')
      .get(CURRENT_SCHEMA_VERSION) as { version: number } | undefined;

    if (!row) {
      this.db
        .prepare('INSERT INTO schema_version (version) VALUES (?)')
        .run(CURRENT_SCHEMA_VERSION);
    }

    // Seed default settings if settings table is empty
    const settingsCount = this.db
      .prepare('SELECT COUNT(*) as cnt FROM settings')
      .get() as { cnt: number };

    if (settingsCount.cnt === 0) {
      const insert = this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
      const seedSettings = this.db.transaction(() => {
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
          insert.run(key, JSON.stringify(value));
        }
      });
      seedSettings();
    }
  }

  // ─── Country Queries ────────────────────────────────────

  getCountries(): Country[] {
    return this.db.prepare('SELECT * FROM countries ORDER BY name').all() as Country[];
  }

  getCountry(iso3: string): Country | null {
    const row = this.db.prepare('SELECT * FROM countries WHERE iso3 = ?').get(iso3);
    return (row as Country) ?? null;
  }

  // ─── Conflict Queries ───────────────────────────────────

  getConflicts(filters?: ConflictFilters): ConflictEvent[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.iso3 && filters.iso3.length > 0) {
      const placeholders = filters.iso3.map(() => '?').join(', ');
      conditions.push(`iso3 IN (${placeholders})`);
      params.push(...filters.iso3);
    }

    if (filters?.dateStart) {
      conditions.push('event_date >= ?');
      params.push(filters.dateStart);
    }

    if (filters?.dateEnd) {
      conditions.push('event_date <= ?');
      params.push(filters.dateEnd);
    }

    if (filters?.eventTypes && filters.eventTypes.length > 0) {
      const placeholders = filters.eventTypes.map(() => '?').join(', ');
      conditions.push(`event_type IN (${placeholders})`);
      params.push(...filters.eventTypes);
    }

    if (filters?.minFatalities !== undefined && filters.minFatalities !== null) {
      conditions.push('fatalities >= ?');
      params.push(filters.minFatalities);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM conflict_events ${where} ORDER BY event_date DESC`;

    return this.db.prepare(sql).all(params) as ConflictEvent[];
  }

  // ─── Arms Transfer Queries ──────────────────────────────

  getArmsTransfers(filters?: ArmsFilters): ArmsTransfer[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.supplierIso3 && filters.supplierIso3.length > 0) {
      const placeholders = filters.supplierIso3.map(() => '?').join(', ');
      conditions.push(`supplier_iso3 IN (${placeholders})`);
      params.push(...filters.supplierIso3);
    }

    if (filters?.recipientIso3 && filters.recipientIso3.length > 0) {
      const placeholders = filters.recipientIso3.map(() => '?').join(', ');
      conditions.push(`recipient_iso3 IN (${placeholders})`);
      params.push(...filters.recipientIso3);
    }

    if (filters?.yearStart !== undefined && filters.yearStart !== null) {
      conditions.push('year >= ?');
      params.push(filters.yearStart);
    }

    if (filters?.yearEnd !== undefined && filters.yearEnd !== null) {
      conditions.push('year <= ?');
      params.push(filters.yearEnd);
    }

    if (filters?.weaponCategories && filters.weaponCategories.length > 0) {
      const placeholders = filters.weaponCategories.map(() => '?').join(', ');
      conditions.push(`weapon_category IN (${placeholders})`);
      params.push(...filters.weaponCategories);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM arms_transfers ${where} ORDER BY year DESC`;

    return this.db.prepare(sql).all(params) as ArmsTransfer[];
  }

  // ─── Military Installation Queries ──────────────────────

  getInstallations(iso3?: string): MilitaryInstallation[] {
    let rows: Record<string, unknown>[];

    if (iso3) {
      rows = this.db
        .prepare('SELECT * FROM military_installations WHERE iso3 = ? ORDER BY name')
        .all(iso3) as Record<string, unknown>[];
    } else {
      rows = this.db
        .prepare('SELECT * FROM military_installations ORDER BY name')
        .all() as Record<string, unknown>[];
    }

    return rows.map((row) => ({
      ...row,
      osm_tags: DatabaseService.parseOsmTags(row.osm_tags as string | null),
    })) as MilitaryInstallation[];
  }

  // ─── World Bank Indicator Queries ───────────────────────

  getIndicators(iso3: string): WorldBankIndicator[] {
    return this.db
      .prepare('SELECT * FROM wb_indicators WHERE iso3 = ? ORDER BY indicator_code, year')
      .all(iso3) as WorldBankIndicator[];
  }

  // ─── Sync Status ────────────────────────────────────────

  /**
   * Returns the completed_at timestamp of the most recent successful sync
   * for the given adapter, or null if no successful sync exists.
   */
  getLastSuccessfulSync(adapter: string): string | null {
    const row = this.db
      .prepare(
        `SELECT completed_at FROM sync_log
         WHERE adapter = ? AND status = 'completed'
         ORDER BY completed_at DESC LIMIT 1`,
      )
      .get(adapter) as { completed_at: string } | undefined;
    return row?.completed_at ?? null;
  }

  getSyncStatus(): SyncStatus[] {
    const adapters = ['acled', 'worldbank', 'overpass', 'cia-factbook', 'ucdp'];
    const result: SyncStatus[] = [];

    for (const adapter of adapters) {
      const lastEntry = this.db
        .prepare(
          `SELECT * FROM sync_log WHERE adapter = ? ORDER BY started_at DESC LIMIT 1`,
        )
        .get(adapter) as
        | {
            adapter: string;
            started_at: string;
            completed_at: string | null;
            status: string;
            records_fetched: number;
            records_upserted: number;
            error_message: string | null;
          }
        | undefined;

      if (lastEntry) {
        result.push({
          adapter: lastEntry.adapter,
          lastSync: lastEntry.completed_at ?? lastEntry.started_at,
          status: lastEntry.status as SyncStatus['status'],
          recordCount: lastEntry.records_upserted,
          errorMessage: lastEntry.error_message ?? undefined,
        });
      } else {
        result.push({
          adapter,
          lastSync: null,
          status: 'idle',
          recordCount: 0,
        });
      }
    }

    return result;
  }

  // ─── Settings ───────────────────────────────────────────

  getSettings(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];

    const settings: Record<string, unknown> = { ...DEFAULT_SETTINGS };

    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    return settings as unknown as AppSettings;
  }

  updateSettings(partial: Partial<AppSettings>): void {
    const upsert = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );

    const update = this.db.transaction(() => {
      for (const [key, value] of Object.entries(partial)) {
        if (value !== undefined) {
          upsert.run(key, JSON.stringify(value));
        }
      }
    });

    update();
  }

  // ─── Upsert Methods (for API adapters) ──────────────────

  upsertCountries(countries: Country[]): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO countries
        (iso3, iso2, name, region, subregion, population, gdp, area_sq_km,
         capital, government_type, military_expenditure_pct_gdp,
         active_personnel, reserve_personnel, last_updated)
      VALUES
        (@iso3, @iso2, @name, @region, @subregion, @population, @gdp, @area_sq_km,
         @capital, @government_type, @military_expenditure_pct_gdp,
         @active_personnel, @reserve_personnel, @last_updated)
    `);

    let count = 0;
    const upsert = this.db.transaction(() => {
      for (const country of countries) {
        stmt.run({
          iso3: country.iso3,
          iso2: country.iso2,
          name: country.name,
          region: country.region,
          subregion: country.subregion,
          population: country.population,
          gdp: country.gdp,
          area_sq_km: country.area_sq_km,
          capital: country.capital,
          government_type: country.government_type,
          military_expenditure_pct_gdp: country.military_expenditure_pct_gdp,
          active_personnel: country.active_personnel,
          reserve_personnel: country.reserve_personnel,
          last_updated: country.last_updated,
        });
        count++;
      }
    });

    upsert();
    return count;
  }

  upsertConflicts(events: ConflictEvent[]): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conflict_events
        (id, iso3, event_date, event_type, sub_event_type, actor1, actor2,
         location, latitude, longitude, fatalities, notes, source, source_scale)
      VALUES
        (@id, @iso3, @event_date, @event_type, @sub_event_type, @actor1, @actor2,
         @location, @latitude, @longitude, @fatalities, @notes, @source, @source_scale)
    `);

    let count = 0;
    let skipped = 0;
    const upsert = this.db.transaction(() => {
      for (const event of events) {
        // Skip events without iso3 — they violate the NOT NULL constraint
        if (!event.iso3 || event.iso3.trim() === '') {
          skipped++;
          continue;
        }
        try {
          stmt.run({
            id: event.id,
            iso3: event.iso3,
            event_date: event.event_date,
            event_type: event.event_type,
            sub_event_type: event.sub_event_type,
            actor1: event.actor1,
            actor2: event.actor2,
            location: event.location,
            latitude: event.latitude,
            longitude: event.longitude,
            fatalities: event.fatalities,
            notes: event.notes,
            source: event.source,
            source_scale: event.source_scale,
          });
          count++;
        } catch {
          skipped++;
        }
      }
    });

    upsert();
    if (skipped > 0) {
      console.warn(`[db.upsertConflicts] Skipped ${skipped} events (null iso3 or constraint violation)`);
    }
    return count;
  }

  upsertArmsTransfers(transfers: ArmsTransfer[]): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO arms_transfers
        (id, supplier_iso3, recipient_iso3, year, weapon_category, weapon_description,
         quantity, tiv_delivered, order_date, delivery_date, status, comments)
      VALUES
        (@id, @supplier_iso3, @recipient_iso3, @year, @weapon_category, @weapon_description,
         @quantity, @tiv_delivered, @order_date, @delivery_date, @status, @comments)
    `);

    let count = 0;
    const upsert = this.db.transaction(() => {
      for (const transfer of transfers) {
        stmt.run({
          id: transfer.id,
          supplier_iso3: transfer.supplier_iso3,
          recipient_iso3: transfer.recipient_iso3,
          year: transfer.year,
          weapon_category: transfer.weapon_category,
          weapon_description: transfer.weapon_description,
          quantity: transfer.quantity,
          tiv_delivered: transfer.tiv_delivered,
          order_date: transfer.order_date,
          delivery_date: transfer.delivery_date,
          status: transfer.status,
          comments: transfer.comments,
        });
        count++;
      }
    });

    upsert();
    return count;
  }

  upsertInstallations(installations: MilitaryInstallation[]): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO military_installations
        (id, iso3, name, type, latitude, longitude, operator, osm_tags)
      VALUES
        (@id, @iso3, @name, @type, @latitude, @longitude, @operator, @osm_tags)
    `);

    let count = 0;
    const upsert = this.db.transaction(() => {
      for (const inst of installations) {
        stmt.run({
          id: inst.id,
          iso3: inst.iso3,
          name: inst.name,
          type: inst.type,
          latitude: inst.latitude,
          longitude: inst.longitude,
          operator: inst.operator,
          osm_tags:
            typeof inst.osm_tags === 'string'
              ? inst.osm_tags
              : JSON.stringify(inst.osm_tags ?? {}),
        });
        count++;
      }
    });

    upsert();
    return count;
  }

  upsertIndicators(indicators: WorldBankIndicator[]): number {
    // INSERT OR IGNORE does NOT suppress FK violations in SQLite — only
    // UNIQUE/NOT NULL/CHECK conflicts. Instead we use a SELECT-form INSERT
    // with a WHERE EXISTS guard so rows for unknown iso3 codes (e.g. World Bank
    // aggregate regions: WLD, EAP, SSA, OED) are never attempted.
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO wb_indicators
        (iso3, indicator_code, indicator_name, year, value)
      SELECT @iso3, @indicator_code, @indicator_name, @year, @value
       WHERE EXISTS (SELECT 1 FROM countries WHERE iso3 = @iso3)
    `);

    let count = 0;
    const upsert = this.db.transaction(() => {
      for (const ind of indicators) {
        const info = insertStmt.run({
          iso3: ind.iso3,
          indicator_code: ind.indicator_code,
          indicator_name: ind.indicator_name,
          year: ind.year,
          value: ind.value,
        });
        if (info.changes > 0) count++;
      }
    });

    upsert();
    return count;
  }

  // ─── Sync Logging ───────────────────────────────────────

  /**
   * Log the start of a sync for an adapter.
   * This creates an entry with status='running' so the UI can show progress immediately.
   */
  logSyncStart(adapter: string): void {
    this.db
      .prepare(
        `INSERT INTO sync_log (adapter, status, records_fetched, records_upserted, error_message)
         VALUES (?, 'running', 0, 0, NULL)`,
      )
      .run(adapter);
  }

  /**
   * Log the completion or failure of a sync for an adapter.
   * This creates a final entry with the results and status.
   */
  logSync(
    adapter: string,
    status: string,
    fetched: number,
    upserted: number,
    error?: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO sync_log (adapter, status, records_fetched, records_upserted, error_message, completed_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(adapter, status, fetched, upserted, error ?? null);
  }

  getSyncLog(limit = 100): SyncLogEntry[] {
    return this.db
      .prepare('SELECT * FROM sync_log ORDER BY started_at DESC LIMIT ?')
      .all(limit) as SyncLogEntry[];
  }

  clearSyncLog(): void {
    this.db.prepare('DELETE FROM sync_log').run();
  }

  // ─── Helpers ────────────────────────────────────────────

  private static parseOsmTags(raw: string | null): Record<string, string> {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }

  close(): void {
    this.db.close();
  }

  getPath(): string {
    return this.db.name;
  }
}
