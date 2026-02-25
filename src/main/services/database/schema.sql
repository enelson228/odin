CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS countries (
  iso3 TEXT PRIMARY KEY,
  iso2 TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  subregion TEXT,
  population INTEGER,
  gdp REAL,
  area_sq_km REAL,
  capital TEXT,
  government_type TEXT,
  military_expenditure_pct_gdp REAL,
  active_personnel INTEGER,
  reserve_personnel INTEGER,
  last_updated TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_countries_region ON countries(region);
CREATE INDEX IF NOT EXISTS idx_countries_name ON countries(name);

CREATE TABLE IF NOT EXISTS conflict_events (
  id TEXT PRIMARY KEY,
  iso3 TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  sub_event_type TEXT,
  actor1 TEXT,
  actor2 TEXT,
  location TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  fatalities INTEGER DEFAULT 0,
  notes TEXT,
  source TEXT,
  source_scale TEXT
  -- No FK on iso3: disputed territories (Kosovo XKX, Taiwan TWN, Palestinian State PSE)
  -- appear in ACLED data but may not be in the countries table.
);
CREATE INDEX IF NOT EXISTS idx_conflicts_iso3 ON conflict_events(iso3);
CREATE INDEX IF NOT EXISTS idx_conflicts_date ON conflict_events(event_date);
CREATE INDEX IF NOT EXISTS idx_conflicts_type ON conflict_events(event_type);
CREATE INDEX IF NOT EXISTS idx_conflicts_geo ON conflict_events(latitude, longitude);

CREATE TABLE IF NOT EXISTS arms_transfers (
  id TEXT PRIMARY KEY,
  supplier_iso3 TEXT NOT NULL,
  recipient_iso3 TEXT NOT NULL,
  year INTEGER NOT NULL,
  weapon_category TEXT,
  weapon_description TEXT,
  quantity INTEGER,
  tiv_delivered REAL,
  order_date TEXT,
  delivery_date TEXT,
  status TEXT,
  comments TEXT,
  FOREIGN KEY (supplier_iso3) REFERENCES countries(iso3),
  FOREIGN KEY (recipient_iso3) REFERENCES countries(iso3)
);
CREATE INDEX IF NOT EXISTS idx_arms_supplier ON arms_transfers(supplier_iso3);
CREATE INDEX IF NOT EXISTS idx_arms_recipient ON arms_transfers(recipient_iso3);
CREATE INDEX IF NOT EXISTS idx_arms_year ON arms_transfers(year);

CREATE TABLE IF NOT EXISTS military_installations (
  id TEXT PRIMARY KEY,
  iso3 TEXT NOT NULL,
  name TEXT,
  type TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  operator TEXT,
  osm_tags TEXT,
  FOREIGN KEY (iso3) REFERENCES countries(iso3)
);
CREATE INDEX IF NOT EXISTS idx_installations_iso3 ON military_installations(iso3);
CREATE INDEX IF NOT EXISTS idx_installations_geo ON military_installations(latitude, longitude);

CREATE TABLE IF NOT EXISTS wb_indicators (
  iso3 TEXT NOT NULL,
  indicator_code TEXT NOT NULL,
  indicator_name TEXT,
  year INTEGER NOT NULL,
  value REAL,
  PRIMARY KEY (iso3, indicator_code, year),
  FOREIGN KEY (iso3) REFERENCES countries(iso3)
);
CREATE INDEX IF NOT EXISTS idx_wb_iso3 ON wb_indicators(iso3);
CREATE INDEX IF NOT EXISTS idx_wb_indicator ON wb_indicators(indicator_code);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adapter TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  records_fetched INTEGER DEFAULT 0,
  records_upserted INTEGER DEFAULT 0,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_adapter ON sync_log(adapter);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
