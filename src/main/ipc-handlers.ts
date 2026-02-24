import { ipcMain, dialog, app } from 'electron';
import * as path from 'path';
import type { DatabaseService } from '@main/services/database/db';
import type { ExportService } from '@main/services/export/export';
import type { SyncScheduler } from '@main/services/sync/scheduler';
import type {
  ConflictFilters,
  ArmsFilters,
  ExportRequest,
  AppSettings,
  AppSettingsPublic,
} from '@shared/types';

// ─── Security Helpers ─────────────────────────────────────

/** Validates and resolves an export file path to a safe location. */
function validateExportPath(filePath: unknown): string {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('Invalid export path');
  }
  const resolved = path.resolve(filePath);
  const allowedBases = [
    app.getPath('downloads'),
    app.getPath('desktop'),
    app.getPath('documents'),
    app.getPath('home'),
  ];
  const isAllowed = allowedBases.some(base => resolved.startsWith(base));
  if (!isAllowed) {
    throw new Error(`Export path not in allowed directory: ${resolved}`);
  }
  const allowedExts = ['.json', '.csv', '.pdf', '.geojson'];
  const ext = path.extname(resolved).toLowerCase();
  if (!allowedExts.includes(ext)) {
    throw new Error(`Disallowed export extension: ${ext}`);
  }
  return resolved;
}

const KNOWN_ADAPTERS = new Set([
  'acled', 'worldbank', 'overpass', 'cia-factbook', 'sipri', 'natural-earth',
]);

// Token fields are managed internally by the sync scheduler — not writable from renderer.
const WRITABLE_SETTINGS_KEYS = new Set<keyof AppSettings>([
  'acledEmail', 'acledPassword', 'syncIntervalMinutes', 'mapDefaultCenter', 'mapDefaultZoom',
]);

// ─── IPC Registration ─────────────────────────────────────

/**
 * Register all IPC handlers that bridge the renderer to main-process services.
 * Called once at app startup after database initialization.
 */
export function registerIpcHandlers(
  db: DatabaseService,
  exportService: ExportService,
  syncScheduler: SyncScheduler,
): void {
  // ─── Data Queries ─────────────────────────────────────

  ipcMain.handle('db:get-countries', () => {
    return db.getCountries();
  });

  ipcMain.handle('db:get-country', (_event, iso3: unknown) => {
    if (typeof iso3 !== 'string' || iso3.length < 2 || iso3.length > 3) {
      throw new Error('Invalid iso3 parameter');
    }
    return db.getCountry(iso3.toUpperCase());
  });

  ipcMain.handle('db:get-conflicts', (_event, filters?: ConflictFilters) => {
    return db.getConflicts(filters);
  });

  ipcMain.handle('db:get-arms-transfers', (_event, filters?: ArmsFilters) => {
    return db.getArmsTransfers(filters);
  });

  ipcMain.handle('db:get-installations', (_event, iso3?: string) => {
    return db.getInstallations(iso3);
  });

  ipcMain.handle('db:get-indicators', (_event, iso3: string) => {
    return db.getIndicators(iso3);
  });

  // ─── Sync ─────────────────────────────────────────────

  ipcMain.handle('sync:start', async (_event, adapter?: unknown) => {
    if (adapter !== undefined) {
      if (typeof adapter !== 'string' || !KNOWN_ADAPTERS.has(adapter)) {
        throw new Error(`Unknown adapter: ${String(adapter)}`);
      }
      await syncScheduler.syncAdapter(adapter);
    } else {
      await syncScheduler.syncAll();
    }
  });

  ipcMain.handle('sync:status', () => {
    return db.getSyncStatus();
  });

  // ─── Export ───────────────────────────────────────────

  ipcMain.handle('export:run', async (_event, request: unknown) => {
    try {
      if (typeof request !== 'object' || request === null) {
        throw new Error('Invalid export request');
      }
      const req = request as Record<string, unknown>;
      const validatedPath = validateExportPath(req.filePath);
      const exportRequest = { ...(req as ExportRequest), filePath: validatedPath };
      await exportService.run(exportRequest);
      return { success: true, filePath: validatedPath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('export:choose-path', async (_event, defaultName: string) => {
    const filters = buildDialogFilters(defaultName);

    const result = await dialog.showSaveDialog({
      title: 'Export Data',
      defaultPath: defaultName,
      filters,
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  // ─── Settings ─────────────────────────────────────────

  ipcMain.handle('settings:get', () => {
    const s = db.getSettings();
    // Return only the public subset — never send credentials or tokens to renderer
    const pub: AppSettingsPublic = {
      acledEmail: s.acledEmail,
      acledHasPassword: Boolean(s.acledPassword),
      syncIntervalMinutes: s.syncIntervalMinutes,
      mapDefaultCenter: s.mapDefaultCenter,
      mapDefaultZoom: s.mapDefaultZoom,
    };
    return pub;
  });

  ipcMain.handle('settings:set', (_event, partial: unknown) => {
    if (typeof partial !== 'object' || partial === null || Array.isArray(partial)) {
      throw new Error('Invalid settings payload');
    }
    const raw = partial as Record<string, unknown>;
    const filtered: Partial<AppSettings> = {};

    for (const key of WRITABLE_SETTINGS_KEYS) {
      if (key in raw && raw[key] !== undefined) {
        (filtered as Record<string, unknown>)[key] = raw[key];
      }
    }

    db.updateSettings(filtered);
  });
}

/**
 * Build Electron file dialog filters based on the default filename extension.
 */
function buildDialogFilters(
  defaultName: string,
): Electron.FileFilter[] {
  const ext = defaultName.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'json':
      return [{ name: 'JSON', extensions: ['json'] }];
    case 'csv':
      return [{ name: 'CSV', extensions: ['csv'] }];
    case 'pdf':
      return [{ name: 'PDF', extensions: ['pdf'] }];
    case 'geojson':
      return [{ name: 'GeoJSON', extensions: ['geojson', 'json'] }];
    default:
      return [{ name: 'All Files', extensions: ['*'] }];
  }
}
