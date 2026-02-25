# ODIN — Open Defense Intelligence Network

A cross-platform OSINT desktop application for geopolitical and defense intelligence analysis. ODIN aggregates open-source data from multiple public APIs into a unified, offline-capable interface for analysts.

## Features

- **Interactive Map** — Leaflet-based world map with toggleable layers: conflict event heatmaps, military installation markers, country choropleth, and arms transfer flow lines
- **Country Intelligence** — Per-country profiles with population, GDP, military expenditure, personnel data, conflict history, and trend charts
- **Conflict Events** — ACLED armed conflict and demonstration data with date/type/fatality filtering
- **Arms Transfers** — SIPRI global arms transfer database with supplier/recipient flow visualization
- **Military Installations** — OpenStreetMap Overpass-derived global military facility database
- **Economic Indicators** — World Bank macroeconomic indicators (military spend, GDP, population)
- **Data Export** — Export any dataset as JSON, CSV, GeoJSON, or PDF
- **Automatic Sync** — Configurable background data refresh across all adapters

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 29 |
| Frontend | React 18 + TypeScript 5 |
| Build | electron-vite + Vite 5 |
| State | Zustand |
| Map | Leaflet + react-leaflet |
| Charts | Recharts |
| Database | SQLite via better-sqlite3 |
| Styling | Tailwind CSS v3 |
| Geo utils | Turf.js |

## Data Sources

| Adapter | Source | Auth |
|---|---|---|
| ACLED | [acleddata.com](https://acleddata.com) | Account credentials (session) |
| World Bank | [data.worldbank.org](https://data.worldbank.org) | None (public API) |
| Overpass / OSM | [overpass-api.de](https://overpass-api.de) | None (public API) |
| CIA World Factbook | GitHub mirror | None (public) |
| SIPRI | GitHub mirror (CSV) | None (public) |
| Natural Earth | GitHub mirror (GeoJSON) | None (public) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# macOS (current arch)
npm run package

# macOS Universal (Intel + Apple Silicon)
npm run package:universal
```

### Other commands

```bash
npm run build       # Compile only (no package)
npm run typecheck   # TypeScript type check
npm run lint        # ESLint
npm run test        # Vitest unit tests
```

## Configuration

On first launch, open **Settings** and enter:

1. **ACLED Email** — your acleddata.com account email
2. **ACLED Password** — your acleddata.com account password

ACLED session cookies are managed automatically (re-login on expiry). All other adapters require no credentials.

### Sync Interval

Default sync interval is 6 hours. Configurable per-install in Settings. Manual per-adapter sync is also available from the Settings page.

### Map Defaults

Default map center and zoom level are configurable in Settings.

## Project Structure

```
src/
├── main/                        # Electron main process (Node.js)
│   ├── index.ts                 # App entry, window creation
│   ├── ipc-handlers.ts          # IPC bridge (main ↔ renderer)
│   ├── preload.ts               # Context bridge (window.odinApi)
│   ├── data/
│   │   └── country-mapping.ts   # Country name → ISO3 lookup
│   ├── services/
│   │   ├── api/                 # Data adapter layer
│   │   │   ├── base-adapter.ts  # Rate limiting, pagination, timeout
│   │   │   ├── acled.ts         # ACLED conflict events
│   │   │   ├── world-bank.ts    # World Bank indicators
│   │   │   ├── overpass.ts      # OSM military installations
│   │   │   ├── cia-factbook.ts  # CIA Factbook country profiles
│   │   │   ├── sipri.ts         # SIPRI arms transfers
│   │   │   └── natural-earth.ts # Country boundaries / reverse geocoding
│   │   ├── database/
│   │   │   ├── db.ts            # DatabaseService (better-sqlite3)
│   │   │   ├── schema.sql       # Table definitions
│   │   │   └── migrations.ts    # Schema migrations
│   │   ├── export/              # JSON / CSV / GeoJSON / PDF exporters
│   │   └── sync/
│   │       └── scheduler.ts     # Periodic + manual sync orchestration
│   └── utils/
│       ├── query-builder.ts     # SQL query builder helper
│       ├── osm.ts               # OSM tag utilities
│       └── errors.ts            # Error helpers
├── renderer/                    # React renderer process
│   ├── views/                   # Page-level components
│   │   ├── Dashboard.tsx        # Overview stats
│   │   ├── MapView.tsx          # Interactive map
│   │   ├── CountryList.tsx      # Searchable country table
│   │   ├── CountryDetail.tsx    # Per-country intelligence profile
│   │   └── Settings.tsx         # App configuration
│   ├── components/
│   │   ├── map/                 # Map layers (conflict, military, arms flow, choropleth)
│   │   ├── charts/              # TrendLine, BarChart
│   │   ├── cards/               # StatCard
│   │   ├── tables/              # DataTable
│   │   ├── common/              # Spinner, Badge, SearchInput, ExportMenu
│   │   └── layout/              # Shell, Sidebar, TopBar
│   ├── stores/                  # Zustand stores (app, country, map)
│   ├── hooks/                   # use-countries, use-map-data, use-ipc
│   └── lib/                     # constants, format helpers
└── shared/
    └── types.ts                 # Shared TypeScript interfaces
```

## Security Notes

- Credentials are stored in SQLite on the local filesystem and never transmitted over IPC to the renderer process
- The renderer only receives boolean presence flags (e.g. `acledHasPassword: true`)
- All export file paths are validated against an allowlist of user directories
- IPC adapter names are validated against a known-adapters allowlist

## License

ISC

### New Prompt
```bash
Build "Odin" (Open Defense Intelligence Network) — an Electron + React + TypeScript 
desktop application for tracking global military conflict data. It is a dark-themed 
intelligence dashboard that syncs data from multiple open-source APIs and displays 
it on an interactive map and data tables.

────────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────────
- Electron 29 (main + renderer + preload)
- React 18 + React Router v6 (SPA renderer)
- TypeScript strict mode throughout
- Tailwind CSS v3 (dark custom palette)
- Zustand stores (app, country, map)
- SQLite via better-sqlite3 (main process only)
- Vite + electron-vite build system
- Leaflet + React Leaflet + MarkerCluster + Heatmap plugins
- Recharts for dashboard charts

Custom color palette (add to tailwind.config):
  odin-cyan:   #00e5ff
  odin-red:    #ff3d3d
  odin-amber:  #ffab00
  odin-green:  #00ff88
  odin-purple: #b388ff
  odin-bg:     #0a0e14
  odin-surface:#0f1923
  odin-border: #1e2d3d
Font: JetBrains Mono (monospace throughout)

────────────────────────────────────────────────
DATA ENTITIES (src/shared/types.ts)
────────────────────────────────────────────────
Country         { iso3, iso2, name, region, subregion, population, gdp,
                  area_sq_km, capital, government_type,
                  military_expenditure_pct_gdp, active_personnel,
                  reserve_personnel, last_updated }

ConflictEvent   { id, iso3, event_date, event_type, sub_event_type,
                  actor1, actor2, location, latitude, longitude,
                  fatalities, notes, source, source_scale }

ArmsTransfer    { id, supplier_iso3, recipient_iso3, year,
                  weapon_category, weapon_description, quantity,
                  tiv_delivered, order_date, delivery_date, status, comments }

MilitaryInstallation { id, iso3, name, type, latitude, longitude,
                       operator, osm_tags: Record<string,string> }

WorldBankIndicator { iso3, indicator_code, indicator_name, year, value }

SyncStatus      { adapter, lastSync, status: 'idle'|'syncing'|'error',
                  recordCount, errorMessage? }

AppSettings     { acledEmail, acledPassword, acledAccessToken,
                  acledRefreshToken, acledTokenExpiry, acledRefreshTokenExpiry,
                  syncIntervalMinutes, mapDefaultCenter: [lat,lng],
                  mapDefaultZoom, displayTimezone }

AppSettingsPublic — same as AppSettings but replaces password + tokens 
                    with acledHasPassword: boolean (never send credentials 
                    over IPC to renderer)

────────────────────────────────────────────────
DATABASE (SQLite, main process, WAL mode, foreign_keys ON)
────────────────────────────────────────────────
Tables: countries, conflict_events, arms_transfers,
        military_installations, wb_indicators, sync_log, settings

conflict_events.iso3 is NOT NULL but has NO foreign key constraint 
(disputed territories like Kosovo, Taiwan, Palestinian State must be 
stored even if not in the countries table).

All other tables use FOREIGN KEY (iso3) REFERENCES countries(iso3).

sync_log tracks: adapter, started_at, completed_at, status 
('running'|'completed'|'error'), records_fetched, records_upserted, error_message.

settings table is a key-value store for AppSettings fields.

Migrations system: MIGRATIONS[] array, each { version, description, up(db) }.
Version 1 = initial schema (no-op, schema.sql applied separately).
Run runMigrations() on every startup.

────────────────────────────────────────────────
IPC SECURITY BOUNDARY
────────────────────────────────────────────────
Preload (src/main/preload.ts) exposes window.odinApi typed as OdinApi.
NEVER send passwords, access tokens, or refresh tokens to renderer.
Renderer only receives AppSettingsPublic with acledHasPassword: boolean.

IPC channels:
  db:get-countries             → Country[]
  db:get-country(iso3)         → Country | null
  db:get-conflicts(filters?)   → ConflictEvent[]
  db:get-arms-transfers(f?)    → ArmsTransfer[]
  db:get-installations(iso3?)  → MilitaryInstallation[]
  db:get-indicators(iso3)      → WorldBankIndicator[]
  sync:start(adapter?)         → { success: boolean }  (awaited, not fire-and-forget)
  sync:status()                → SyncStatus[]
  sync:get-log()               → SyncLogEntry[]
  sync:clear-log()             → void
  sync:progress                → push event from main (SyncStatus)
  export:run(request)          → { success, filePath?, error? }
  export:choose-path(name)     → string | null
  settings:get()               → AppSettingsPublic
  settings:set(partial)        → void

ConflictFilters: { iso3?, dateStart?, dateEnd?, eventTypes?, minFatalities? }
ArmsFilters:     { supplierIso3?, recipientIso3?, yearStart?, yearEnd?, weaponCategories? }
ExportRequest:   { format: 'json'|'csv'|'pdf'|'geojson', 
                   dataType: 'countries'|'conflicts'|'arms'|'installations'|'all',
                   filters?, filePath }

────────────────────────────────────────────────
API ADAPTERS (src/main/services/api/)
────────────────────────────────────────────────
All extend BaseApiAdapter<TRaw, TNormalized> which provides:
  - rateLimitedFetch() with configurable ms delay between requests
  - withRetry(fn, maxRetries=3, baseDelayMs=2000) with exponential backoff
  - fetchAll(initialParams) — paginates until hasMore=false, retrying each page

7 Adapters:

1. ACLED — Conflict events
   Endpoint: https://acleddata.com/api/acled/read
   Auth: OAuth2 password grant → Bearer token
     POST https://acleddata.com/oauth/token
     body: grant_type=password, username, password, client_id=acled
   Token management:
     - Access token: 24h TTL, stored in settings table
     - Refresh token: 14d TTL, stored in settings table
     - Auto-refresh 60s before expiry; fall back to re-auth if refresh expired
     - After sync completes, persist new token to settings
   Params: _format=json, limit=5000, page, event_date (filter >date), iso3
   First sync cap: if no sinceDate, default to 2 years ago to avoid 
                   pulling 500k+ records from 1997 to present
   Incremental: subsequent syncs pass last completed sync date as sinceDate
   Rate limit: 1000ms

2. UCDP — Conflict events (fallback, no auth)
   Endpoint: https://ucdpapi.pcr.uu.se/api/gedevents/25.1
   Params: pagesize=1000, page
   Map: type_of_violence → { 1:'State-based conflict', 2:'Non-state conflict', 
                               3:'One-sided violence' }
   Requires setCountryMap(Map<string,string>) before syncing for iso3 lookup
   Rate limit: 500ms

3. World Bank — Development indicators
   Endpoint: https://api.worldbank.org/v2/country/all/indicator/{code}
   Indicators: MS.MIL.XPND.GD.ZS, MS.MIL.XPND.CD, MS.MIL.TOTL.P1,
               SP.POP.TOTL, NY.GDP.MKTP.CD, SP.DYN.LE00.IN
   Fetch years 2010 to current year, 1000 per page
   Rate limit: 500ms

4. Overpass/OSM — Military installations
   Endpoint: https://overpass-api.de/api/interpreter
   IMPORTANT: Use Node's https.request() directly — NOT fetch() or net.fetch().
   Both undici and Chromium negotiate HTTP/2 with this server and fail silently.
   https.request() always uses HTTP/1.1 and matches curl behavior.
   Single global typed query (NOT per-continent bboxes which time out):
     [out:json][timeout:300][maxsize:536870912];
     (
       node["military"~"^(base|airfield|naval_base|barracks|training_area|
                           range|checkpoint|fort|camp|bunker|launchpad|storage)$"];
       way["military"~"^(base|airfield|naval_base|barracks|training_area|
                          range|fort|camp)$"];
       relation["military"~"^(base|airfield|naval_base|training_area)$"];
     );
     out center tags;
   iso3 field left empty — to be filled by reverse geocoding later
   Client timeout: 360,000ms (6 minutes, must exceed 300s server timeout)
   Rate limit: 0ms

5. SIPRI — Arms transfers
   Source: CSV from SIPRI TIV database
   Parse with csv-parse, map supplier/recipient country names to iso3
   Generate deterministic IDs via SHA256 hash to deduplicate
   Rate limit: N/A (file import)

6. CIA World Factbook — Country metadata enrichment
   Source: JSON mirror from GitHub (fetched at sync time)
   Returns: capital, government_type, area_sq_km
   Fetches ~50 major countries only (hardcoded ISO3 → slug mapping)
   Rate limit: 300ms

7. Natural Earth — Country base data + GeoJSON
   Source: GeoJSON bundled in app at assets/geojson/ne_countries.geojson
   Seeds the countries table on first run (if empty)
   Also provides: point-in-polygon for reverse geocoding, country GeoJSON for map

SyncScheduler:
  - Stores Map<string, SyncAdapterRunner> keyed by adapter name
  - syncAll() runs all adapters sequentially
  - syncAdapter(name) runs one adapter
  - Each adapter: logSyncStart → run → logSyncComplete or logSyncError
  - Emits sync:progress push event at start and end of each adapter
  - Configurable interval (default 360 min), timer restarted when settings change

────────────────────────────────────────────────
VIEWS (React Router, src/renderer/views/)
────────────────────────────────────────────────

/ — Dashboard
  4 StatCards: Total Countries, Conflict Events (last 30 days), 
               Military Installations, Arms Transfers
  TrendLine chart: conflict events per month (last 12 months, from conflicts store)
  BarChart: top 10 countries by military expenditure % GDP
  Recent Events table: last 20 conflict events with date, country, type, fatalities

/countries — Countries List
  SearchInput with debounce
  Sortable DataTable: flag, name, region, population, GDP, mil spending %, last updated
  Click row → navigate to /countries/:iso3

/countries/:iso3 — Country Detail
  5 tabs: Overview | Conflicts | Military | Arms | Indicators
  Overview: Capital, government type, area, active/reserve personnel, stat cards
  Conflicts: Filtered DataTable of conflict events
  Military: DataTable of military installations with type/coordinates
  Arms: Arms transfers where this country is recipient
  Indicators: Time series data from World Bank

/map — Intelligence Map
  React Leaflet full-screen map with CartoDB dark tile layer
  Layer Controls panel (top-right): 5 toggleable layers
  
  Layer 1: Countries Choropleth
    GeoJSON polygons colored by selectable metric
    Metrics: military spending %, population, GDP, active personnel
    Hover tooltip shows country name + metric value
  
  Layer 2: Conflict Clusters
    LeafletMarkerCluster with custom cluster icons
    Individual markers color-coded by event_type:
      Battles → red, Explosions/Remote violence → amber
      Protests → cyan, Riots → purple, Strategic → green
    Popup: event_date, type, actors, fatalities, location
  
  Layer 3: Conflict Heatmap
    Leaflet.heat plugin, intensity based on fatality count
  
  Layer 4: Military Installations
    Green circle markers (radius 5)
    Popup: name, type, operator
  
  Layer 5: Arms Flow
    Bezier curved polylines between country centroids
    Line weight proportional to total TIV delivered
    Hardcoded centroid coordinates for ~100 countries
    Click → popup showing supplier, recipient, total TIV, latest year

/settings — Configuration
  ACLED OAuth: email field, password field (masked), status badge
  Sync interval: dropdown (15/30/60/360/1440 minutes)
  Map defaults: lat/lng inputs, zoom slider
  Timezone: select from Intl.supportedValuesOf('timeZone')
  Manual Sync grid: one button per adapter with live progress bar
  Sync Log: paginated table of last 100 entries

────────────────────────────────────────────────
UI SHELL
────────────────────────────────────────────────
Sidebar (left, collapsible):
  - Expanded: 224px | Collapsed: 56px
  - Logo: "ODIN" + subtitle "OSINT Platform" (hidden when collapsed)
  - Nav items: Dashboard, Map, Countries, Settings
    Active item: odin-cyan left border + odin-bg/10 background
  - Status dot (bottom): green pulse=idle, amber pulse=syncing, red=error
  - Collapse toggle button (bottom)

TopBar (top):
  - Current view label (from app-store.currentView)
  - Total record count across all adapters
  - Last sync timestamp
  - Active adapter name with pulsing animation (when syncing)
  - "SYNC ALL" button (triggers sync:start with no arg)
  - Export dropdown button (JSON/CSV/PDF/GeoJSON for all data)

────────────────────────────────────────────────
STATE (Zustand, src/renderer/stores/)
────────────────────────────────────────────────
app-store:
  sidebarCollapsed, currentView, syncStatuses, displayTimezone
  initSettings() — loads AppSettingsPublic via IPC on mount
  
country-store:
  countries[], selectedCountry, searchQuery, sortField, sortDirection
  getFilteredCountries() — filtered + sorted computed view

map-store:
  viewport {center, zoom}, layers [{id, label, visible, type}], choroplethMetric
  Layer visibility persisted to localStorage

Subscribe to sync:progress in App.tsx root (not in each component):
  window.odinApi.onSyncProgress(status => updateSyncStatus(status))
  Return cleanup in useEffect to avoid double-subscription

────────────────────────────────────────────────
EXPORT SERVICE
────────────────────────────────────────────────
Formats: JSON (pretty), CSV (csv-stringify), 
         PDF (pdfkit with table layout), GeoJSON (conflict events as Feature points)
Data types: countries, conflicts, arms, installations, all
File dialog restricted to safe paths: Downloads, Desktop, Documents, Home
Validate export path extension before writing

────────────────────────────────────────────────
KEY IMPLEMENTATION NOTES
────────────────────────────────────────────────
1. IPC Security: credentials NEVER cross the IPC boundary. Store password 
   and tokens in main process only (SQLite settings table). Renderer gets 
   acledHasPassword: boolean flag only.

2. Overpass HTTP/2 bug: always use https.request() for Overpass, not fetch().
   Both undici and Chromium net.fetch() fail with HTTP/2 negotiation against 
   overpass-api.de.

3. upsertConflicts must use per-row try/catch inside the transaction — 
   ACLED returns ~400k rows and some may have null iso3 or violate 
   other constraints. One bad row must not abort the entire transaction.

4. conflict_events has NO FOREIGN KEY on iso3 — disputed territories 
   (Kosovo XKX, Taiwan TWN, Palestinian State PSE, etc.) appear in ACLED 
   data but may not be in the 175-country countries table.

5. ACLED first sync: default to last 2 years. Fetching all ACLED data 
   since 1997 is 500k+ events and will timeout. Subsequent syncs are 
   incremental (pass last completed sync date).

6. sync:start IPC handler must AWAIT the sync to completion and return 
   {success: true} — do NOT fire-and-forget. Real-time updates come 
   via sync:progress push events.

7. Window dimensions: 1400×900 default, 1024×700 minimum.
   Show DevTools in development, hide in production.

8. Content Security Policy: restrictive in production 
   (script-src 'self', style-src 'self' 'unsafe-inline',
    connect-src 'self' https://*.worldbank.org https://acleddata.com 
                https://overpass-api.de https://ucdpapi.pcr.uu.se).
```
