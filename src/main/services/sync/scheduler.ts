import { BrowserWindow } from 'electron';
import type { DatabaseService } from '@main/services/database/db';
import type { SyncStatus } from '@shared/types';
import { AcledAdapter, AcledToken } from '@main/services/api/acled';
import { WorldBankAdapter } from '@main/services/api/world-bank';
import { OverpassAdapter } from '@main/services/api/overpass';
import { CiaFactbookAdapter } from '@main/services/api/cia-factbook';
import { UcdpAdapter } from '@main/services/api/ucdp';

/**
 * A sync adapter bridges an API adapter to the database.
 * Each adapter knows how to fetch data and upsert it.
 */
interface SyncAdapterRunner {
  readonly name: string;
  run(db: DatabaseService): Promise<{ fetched: number; upserted: number }>;
}

/**
 * SyncScheduler manages periodic and on-demand data synchronization
 * across all registered API adapters.
 */
export class SyncScheduler {
  private db: DatabaseService;
  private adapters: Map<string, SyncAdapterRunner> = new Map();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Initialize all built-in adapter runners.
   * Call this after settings are available so API keys can be read.
   */
  initAdapters(): void {
    const settings = this.db.getSettings();

    // ACLED conflict events adapter (OAuth2 resource-owner password grant → Bearer token)
    this.adapters.set('acled', {
      name: 'acled',
      async run(db: DatabaseService) {
        const s = db.getSettings();
        const acledEmail = process.env.ACLED_EMAIL || s.acledEmail;
        const acledPassword = process.env.ACLED_PASSWORD || s.acledPassword;
        if (!acledEmail || !acledPassword) {
          throw new Error(
            'ACLED email and password not configured. ' +
            'Set them in Settings (register at acleddata.com).',
          );
        }

        // Pass any previously stored OAuth2 token to avoid re-authenticating every sync
        const existingToken: AcledToken | undefined =
          s.acledAccessToken
            ? {
                accessToken: s.acledAccessToken,
                refreshToken: s.acledRefreshToken,
                expiresAt: s.acledTokenExpiry,
                refreshTokenExpiresAt: s.acledRefreshTokenExpiry,
              }
            : undefined;

        // Incremental sync: only fetch events since the last successful ACLED sync.
        // First run (no prior completed sync) fetches the full historical dataset.
        const lastSync = db.getLastSuccessfulSync('acled');
        const sinceDate = lastSync ? lastSync.split('T')[0] : undefined;

        const adapter = new AcledAdapter(acledEmail, acledPassword, existingToken);
        const events = await adapter.fetchAllEvents(sinceDate);
        const upserted = db.upsertConflicts(events);

        // Persist any updated OAuth2 token so the next sync can reuse it
        const newToken = adapter.getToken();
        if (newToken) {
          db.updateSettings({
            acledAccessToken: newToken.accessToken,
            acledRefreshToken: newToken.refreshToken,
            acledTokenExpiry: newToken.expiresAt,
            acledRefreshTokenExpiry: newToken.refreshTokenExpiresAt,
          });
        }

        return { fetched: events.length, upserted };
      },
    });

    // World Bank indicators adapter
    this.adapters.set('worldbank', {
      name: 'worldbank',
      async run(db: DatabaseService) {
        const adapter = new WorldBankAdapter();
        const indicators = await adapter.fetchAllIndicators();
        const upserted = db.upsertIndicators(indicators);
        return { fetched: indicators.length, upserted };
      },
    });

    // Overpass military installations adapter
    this.adapters.set('overpass', {
      name: 'overpass',
      async run(db: DatabaseService) {
        const adapter = new OverpassAdapter();
        const installations = await adapter.fetchAllRegions();
        const upserted = db.upsertInstallations(installations);
        return { fetched: installations.length, upserted };
      },
    });

    // CIA Factbook country profiles adapter
    this.adapters.set('cia-factbook', {
      name: 'cia-factbook',
      async run(db: DatabaseService) {
        const adapter = new CiaFactbookAdapter();
        const profiles = await adapter.fetchAllCountries();

        // The Factbook returns Partial<Country> records.
        // We need to merge them with existing country data or insert new stubs.
        let upserted = 0;
        for (const profile of profiles) {
          if (!profile.iso3) continue;

          const existing = db.getCountry(profile.iso3);
          if (existing) {
            // Merge Factbook fields into existing country record
            const merged = {
              ...existing,
              area_sq_km: profile.area_sq_km ?? existing.area_sq_km,
              capital: profile.capital ?? existing.capital,
              government_type: profile.government_type ?? existing.government_type,
              last_updated: profile.last_updated ?? existing.last_updated,
            };
            db.upsertCountries([merged]);
            upserted++;
          } else {
            // Create a minimal country record from the Factbook data
            db.upsertCountries([
              {
                iso3: profile.iso3,
                iso2: '',
                name: profile.iso3, // Placeholder — will be enriched by WorldBank
                region: '',
                subregion: '',
                population: null,
                gdp: null,
                area_sq_km: profile.area_sq_km ?? null,
                capital: profile.capital ?? null,
                government_type: profile.government_type ?? null,
                military_expenditure_pct_gdp: null,
                active_personnel: null,
                reserve_personnel: null,
                last_updated: profile.last_updated ?? new Date().toISOString(),
              },
            ]);
            upserted++;
          }
        }

        return { fetched: profiles.length, upserted };
      },
    });

    // UCDP Georeferenced Events Dataset adapter (no credentials required)
    this.adapters.set('ucdp', {
      name: 'ucdp',
      async run(db: DatabaseService) {
        // Build a country name → iso3 map so the adapter can resolve iso3 codes
        const countries = db.getCountries();
        const countryMap = new Map<string, string>(
          countries.map(c => [c.name.toLowerCase(), c.iso3]),
        );

        const adapter = new UcdpAdapter();
        adapter.setCountryMap(countryMap);
        const events = await adapter.fetchAllEvents();
        const upserted = db.upsertConflicts(events);
        return { fetched: events.length, upserted };
      },
    });
  }

  /**
   * Register a custom adapter runner (for testing or extensions).
   */
  registerAdapter(adapter: SyncAdapterRunner): void {
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Start the periodic sync timer.
   * @param intervalMinutes How often to run a full sync (in minutes).
   */
  start(intervalMinutes: number): void {
    this.stop();

    // Initialize adapters with current settings
    this.initAdapters();

    const intervalMs = intervalMinutes * 60 * 1000;

    this.intervalHandle = setInterval(() => {
      this.syncAll().catch((err) => {
        console.error('[SyncScheduler] Periodic sync error:', err);
      });
    }, intervalMs);

    console.log(
      `[SyncScheduler] Started with interval of ${intervalMinutes} minute(s).`,
    );
  }

  /**
   * Stop the periodic sync timer.
   */
  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('[SyncScheduler] Stopped.');
    }
  }

  /**
   * Run all registered adapters sequentially.
   * One adapter failure does not prevent the others from running.
   */
  async syncAll(): Promise<void> {
    if (this.running) {
      console.warn('[SyncScheduler] Sync already in progress, skipping.');
      return;
    }

    this.running = true;

    // Re-initialize adapters to pick up any settings changes
    this.initAdapters();

    try {
      for (const [name] of this.adapters) {
        await this.syncAdapterInternal(name);
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * Run a single named adapter.
   */
  async syncAdapter(name: string): Promise<void> {
    if (this.running) {
      console.warn(`[SyncScheduler] Sync already in progress, skipping adapter: ${name}`);
      return;
    }

    if (!this.adapters.has(name)) {
      // Try initializing adapters in case they haven't been set up
      this.initAdapters();
    }

    if (!this.adapters.has(name)) {
      console.warn(`[SyncScheduler] Unknown adapter: ${name}`);
      return;
    }

    await this.syncAdapterInternal(name);
  }

  // ─── Internal ─────────────────────────────────────────

  private async syncAdapterInternal(name: string): Promise<void> {
    const adapter = this.adapters.get(name);
    if (!adapter) return;

    // Log sync start — this creates a "running" entry so the UI shows progress immediately
    this.db.logSyncStart(name);

    // Notify renderer that sync has started for this adapter
    this.emitSyncProgress({
      adapter: name,
      lastSync: null,
      status: 'syncing',
      recordCount: 0,
    });

    try {
      console.log(`[SyncScheduler] Starting sync for adapter: ${name}`);
      const result = await adapter.run(this.db);

      this.db.logSync(name, 'completed', result.fetched, result.upserted);

      this.emitSyncProgress({
        adapter: name,
        lastSync: new Date().toISOString(),
        status: 'idle',
        recordCount: result.upserted,
      });

      console.log(
        `[SyncScheduler] Completed ${name}: fetched=${result.fetched}, upserted=${result.upserted}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[SyncScheduler] Error syncing ${name}:`, message);

      this.db.logSync(name, 'error', 0, 0, message);

      this.emitSyncProgress({
        adapter: name,
        lastSync: null,
        status: 'error',
        recordCount: 0,
        errorMessage: message,
      });
    }
  }

  /**
   * Send sync progress updates to all renderer windows.
   */
  private emitSyncProgress(status: SyncStatus): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('sync:progress', status);
      }
    }
  }
}
