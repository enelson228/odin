import {
  Country,
  ConflictEvent,
  ArmsTransfer,
  MilitaryInstallation,
  WorldBankIndicator,
  ConflictFilters,
  ArmsFilters,
  SyncStatus,
  SyncLogEntry,
  ExportRequest,
  AppSettingsPublic,
} from '../../shared/types';

interface OdinApi {
  getCountries(): Promise<Country[]>;
  getCountry(iso3: string): Promise<Country | null>;
  getConflicts(filters?: ConflictFilters): Promise<ConflictEvent[]>;
  getArmsTransfers(filters?: ArmsFilters): Promise<ArmsTransfer[]>;
  getInstallations(iso3?: string): Promise<MilitaryInstallation[]>;
  getIndicators(iso3: string): Promise<WorldBankIndicator[]>;
  startSync(adapter?: string): Promise<void>;
  getSyncStatus(): Promise<SyncStatus[]>;
  getSyncLog(): Promise<SyncLogEntry[]>;
  clearSyncLog(): Promise<void>;
  runExport(request: ExportRequest): Promise<{ success: boolean; filePath?: string; error?: string }>;
  chooseSavePath(defaultName: string): Promise<string | null>;
  getSettings(): Promise<AppSettingsPublic>;
  updateSettings(settings: Record<string, unknown>): Promise<void>;
  onSyncProgress(callback: (status: SyncStatus) => void): () => void;
}

declare global {
  interface Window {
    odinApi: OdinApi;
  }
}

export {};
