import { app, BrowserWindow, session, shell } from 'electron';
import * as path from 'path';
import { DatabaseService } from '@main/services/database/db';
import { ExportService } from '@main/services/export/export';
import { SyncScheduler } from '@main/services/sync/scheduler';
import { registerIpcHandlers } from '@main/ipc-handlers';
import { NaturalEarthAdapter } from '@main/services/api/natural-earth';
import { getLogger, LogLevel } from '@main/utils/logger';
import type { Country } from '@shared/types';

const logger = getLogger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
});

// electron-vite sets is.dev or we can check ELECTRON_RENDERER_URL
const isDev = !!process.env.ELECTRON_RENDERER_URL;

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService | null = null;
let syncScheduler: SyncScheduler | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a0e14',
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true, // Renderer does not use native modules; better-sqlite3 runs in main only
    },
  });

  // Show window when renderer is ready to avoid visual flash
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch {
      // Malformed URL — deny silently
    }
    return { action: 'deny' };
  });

  // Load the renderer
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const tileSources = 'https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org';
    const fontSources = 'https://fonts.googleapis.com https://fonts.gstatic.com';
    const githubSources = 'https://raw.githubusercontent.com';
    const apiSources =
      'https://*.worldbank.org https://acleddata.com https://overpass-api.de ' +
      'https://ucdpapi.pcr.uu.se https://armstransfers.sipri.org';
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self'; " +
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
              "style-src 'self' 'unsafe-inline' http://localhost:* " + fontSources + "; " +
              "style-src-elem 'self' 'unsafe-inline' http://localhost:* " + fontSources + "; " +
              "img-src 'self' data: blob: " + tileSources + "; " +
              "connect-src 'self' ws://localhost:* http://localhost:* " + tileSources + " https://unpkg.com " + githubSources + " " + apiSources + "; " +
              "font-src 'self' data: " + fontSources + ";"
            : "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src 'self' 'unsafe-inline' " + fontSources + "; " +
              "img-src 'self' data: blob: " + tileSources + "; " +
              "connect-src 'self' " + tileSources + " " + githubSources + " " + apiSources + "; " +
              "font-src 'self' data: " + fontSources + ";",
        ],
      },
    });
  });
}

/**
 * Seed the countries table from bundled Natural Earth GeoJSON if empty.
 * This provides immediate data without any API calls.
 */
function seedCountriesIfEmpty(db: DatabaseService): void {
  const existing = db.getCountries();
  if (existing.length > 0) {
    logger.info('Database', `Countries table already has ${existing.length} entries, skipping seed.`);
    return;
  }

  logger.info('Database', 'Seeding countries from Natural Earth GeoJSON...');

  // In dev, assets are at project root. In production, extraResources puts them next to the app.
  const assetsDir = isDev
    ? path.join(__dirname, '..', '..', 'assets')
    : path.join(process.resourcesPath, 'assets');

  const ne = new NaturalEarthAdapter(assetsDir);
  const meta = ne.getAllCountryMeta();

  const countries: Country[] = meta.map((m) => ({
    iso3: m.iso3,
    iso2: m.iso2,
    name: m.name,
    region: m.region,
    subregion: m.subregion,
    population: m.population,
    gdp: m.gdp,
    area_sq_km: null,
    capital: null,
    government_type: null,
    military_expenditure_pct_gdp: null,
    active_personnel: null,
    reserve_personnel: null,
    last_updated: new Date().toISOString(),
  }));

  const count = db.upsertCountries(countries);
  logger.info('Database', `Seeded ${count} countries from Natural Earth data.`);
}

function initializeDatabase(): DatabaseService {
  const dbPath = path.join(app.getPath('userData'), 'odin.db');
  logger.info('Database', `Database path: ${dbPath}`);

  const database = new DatabaseService(dbPath);
  database.initSchema();

  return database;
}

// ─── App Lifecycle ──────────────────────────────────────

app.whenReady().then(async () => {
  // Set CSP before creating any windows
  setupContentSecurityPolicy();

  // Initialize database
  db = initializeDatabase();

  // Seed countries from bundled GeoJSON (instant, no API needed)
  seedCountriesIfEmpty(db);

  // Initialize services
  const exportService = new ExportService(db);
  syncScheduler = new SyncScheduler(db);

  // Register IPC handlers
  registerIpcHandlers(db, exportService, syncScheduler);

  // Create the main window
  createWindow();

  // Start periodic sync based on saved settings
  const settings = db.getSettings();
  if (settings.syncIntervalMinutes > 0) {
    syncScheduler.start(settings.syncIntervalMinutes);
  }

  // macOS: re-create window when dock icon is clicked and no windows exist
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  syncScheduler?.stop();
  db?.close();
  logger.shutdown();
});
