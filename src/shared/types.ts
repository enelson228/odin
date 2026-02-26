// ─── Core Entities ────────────────────────────────────────

export interface Country {
  iso3: string;
  iso2: string;
  name: string;
  region: string;
  subregion: string;
  population: number | null;
  gdp: number | null;
  area_sq_km: number | null;
  capital: string | null;
  government_type: string | null;
  military_expenditure_pct_gdp: number | null;
  active_personnel: number | null;
  reserve_personnel: number | null;
  last_updated: string;
}

export interface ConflictEvent {
  id: string;
  iso3: string;
  event_date: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  actor2: string | null;
  location: string;
  latitude: number;
  longitude: number;
  fatalities: number;
  notes: string | null;
  source: string;
  source_scale: string | null;
}

export interface ArmsTransfer {
  id: string;
  supplier_iso3: string;
  recipient_iso3: string;
  year: number;
  weapon_category: string;
  weapon_description: string;
  quantity: number | null;
  tiv_delivered: number | null;
  order_date: string | null;
  delivery_date: string | null;
  status: string;
  comments: string | null;
}

export interface MilitaryInstallation {
  id: string;
  iso3: string;
  name: string | null;
  type: string;
  latitude: number;
  longitude: number;
  operator: string | null;
  osm_tags: Record<string, string>;
}

export interface WorldBankIndicator {
  iso3: string;
  indicator_code: string;
  indicator_name: string;
  year: number;
  value: number | null;
}

// ─── API Adapter Types ────────────────────────────────────

export interface ApiAdapterConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  rateLimitMs: number;
  cacheMaxAgeMs: number;
}

export interface SyncStatus {
  adapter: string;
  lastSync: string | null;
  status: 'idle' | 'syncing' | 'error';
  recordCount: number;
  errorMessage?: string;
}

export interface SyncLogEntry {
  id: number;
  adapter: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  records_fetched: number;
  records_upserted: number;
  error_message: string | null;
}

// ─── Map Types ────────────────────────────────────────────

export interface MapLayer {
  id: string;
  label: string;
  visible: boolean;
  type: 'choropleth' | 'marker' | 'cluster' | 'heatmap' | 'flow';
}

export interface MapViewport {
  center: [number, number];
  zoom: number;
}

// ─── Export Types ──────────────────────────────────────────

export type ExportFormat = 'json' | 'csv' | 'pdf' | 'geojson';

export interface ExportRequest {
  format: ExportFormat;
  dataType: 'countries' | 'conflicts' | 'arms' | 'installations' | 'all';
  filters?: {
    iso3?: string[];
    dateRange?: { start: string; end: string };
    eventTypes?: string[];
  };
  filePath: string;
}

// ─── Filter Types ─────────────────────────────────────────

export interface ConflictFilters {
  iso3?: string[];
  dateStart?: string;
  dateEnd?: string;
  eventTypes?: string[];
  minFatalities?: number;
}

export interface ArmsFilters {
  supplierIso3?: string[];
  recipientIso3?: string[];
  yearStart?: number;
  yearEnd?: number;
  weaponCategories?: string[];
}

// ─── Settings ─────────────────────────────────────────────

export interface AppSettings {
  acledEmail: string;
  acledPassword: string;              // ACLED account password (OAuth2 resource-owner grant)
  acledAccessToken: string;           // OAuth2 access token (managed automatically, 24h TTL)
  acledRefreshToken: string;          // OAuth2 refresh token (managed automatically, 14d TTL)
  acledTokenExpiry: number;           // Access token expiry as Unix timestamp ms
  acledRefreshTokenExpiry: number;    // Refresh token expiry as Unix timestamp ms
  syncIntervalMinutes: number;
  mapDefaultCenter: [number, number];
  mapDefaultZoom: number;
  displayTimezone: string;            // IANA timezone name, e.g. 'America/New_York'. Empty = system local.
}

/**
 * Safe subset of AppSettings for the renderer process.
 * Credentials and tokens are NEVER sent over IPC — only boolean presence flags.
 */
export interface AppSettingsPublic {
  acledEmail: string;
  acledHasPassword: boolean;    // true if a password is stored; never the actual value
  syncIntervalMinutes: number;
  mapDefaultCenter: [number, number];
  mapDefaultZoom: number;
  displayTimezone: string;      // IANA timezone name. Empty string = system local.
}
