import {
  Country,
  ConflictEvent,
  ArmsTransfer,
  MilitaryInstallation,
  WorldBankIndicator,
  ConflictFilters,
  ArmsFilters,
  SyncStatus,
  ExportRequest,
  AppSettings,
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
  runExport(request: ExportRequest): Promise<{ success: boolean; filePath?: string; error?: string }>;
  chooseSavePath(defaultName: string): Promise<string | null>;
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: Partial<AppSettings>): Promise<void>;
  onSyncProgress(callback: (status: SyncStatus) => void): () => void;
}

declare global {
  interface Window {
    odinApi: OdinApi;
  }
}

export {};
