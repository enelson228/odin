import { contextBridge, ipcRenderer } from 'electron';
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
  AppSettingsPublic,
  ExportRequest,
} from '@shared/types';

/**
 * The typed API exposed to the renderer process via contextBridge.
 * Access in renderer via `window.odinApi`.
 *
 * Security note: getSettings() returns AppSettingsPublic — credentials
 * (tokens, passwords) are NEVER sent from main → renderer.
 */
export interface OdinApi {
  // ─── Data Queries ─────────────────────────────────────
  getCountries(): Promise<Country[]>;
  getCountry(iso3: string): Promise<Country | null>;
  getConflicts(filters?: ConflictFilters): Promise<ConflictEvent[]>;
  getArmsTransfers(filters?: ArmsFilters): Promise<ArmsTransfer[]>;
  getInstallations(iso3?: string): Promise<MilitaryInstallation[]>;
  getIndicators(iso3: string): Promise<WorldBankIndicator[]>;

  // ─── Sync ─────────────────────────────────────────────
  startSync(adapter?: string): Promise<{ success: boolean }>;
  getSyncStatus(): Promise<SyncStatus[]>;
  getSyncLog(limit?: number): Promise<SyncLogEntry[]>;
  clearSyncLog(): Promise<void>;

  // ─── Export ───────────────────────────────────────────
  runExport(request: ExportRequest): Promise<{ success: boolean; filePath?: string; error?: string }>;
  chooseSavePath(defaultName: string): Promise<string | null>;

  // ─── Settings ─────────────────────────────────────────
  getSettings(): Promise<AppSettingsPublic>;
  updateSettings(partial: Partial<AppSettings>): Promise<void>;

  // ─── Sync Event Listener ──────────────────────────────
  onSyncProgress(callback: (status: SyncStatus) => void): () => void;
}

const odinApi: OdinApi = {
  // ─── Data Queries ─────────────────────────────────────

  getCountries: () => ipcRenderer.invoke('db:get-countries'),

  getCountry: (iso3: string) => ipcRenderer.invoke('db:get-country', iso3),

  getConflicts: (filters?: ConflictFilters) =>
    ipcRenderer.invoke('db:get-conflicts', filters),

  getArmsTransfers: (filters?: ArmsFilters) =>
    ipcRenderer.invoke('db:get-arms-transfers', filters),

  getInstallations: (iso3?: string) =>
    ipcRenderer.invoke('db:get-installations', iso3),

  getIndicators: (iso3: string) => ipcRenderer.invoke('db:get-indicators', iso3),

  // ─── Sync ─────────────────────────────────────────────

  startSync: (adapter?: string) => ipcRenderer.invoke('sync:start', adapter),

  getSyncStatus: () => ipcRenderer.invoke('sync:status'),

  getSyncLog: (limit?: number) => ipcRenderer.invoke('sync:get-log', limit),

  clearSyncLog: () => ipcRenderer.invoke('sync:clear-log'),

  // ─── Export ───────────────────────────────────────────

  runExport: (request: ExportRequest) => ipcRenderer.invoke('export:run', request),

  chooseSavePath: (defaultName: string) =>
    ipcRenderer.invoke('export:choose-path', defaultName),

  // ─── Settings ─────────────────────────────────────────

  getSettings: () => ipcRenderer.invoke('settings:get'),

  updateSettings: (partial: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:set', partial),

  // ─── Sync Event Listener ──────────────────────────────

  onSyncProgress: (callback: (status: SyncStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: SyncStatus): void => {
      callback(status);
    };
    ipcRenderer.on('sync:progress', handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('sync:progress', handler);
    };
  },
};

contextBridge.exposeInMainWorld('odinApi', odinApi);
