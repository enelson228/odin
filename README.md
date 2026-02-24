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
