export const ROUTES = {
  DASHBOARD: '/',
  MAP: '/map',
  COUNTRIES: '/countries',
  COUNTRY_DETAIL: '/countries/:iso3',
  SETTINGS: '/settings',
} as const;

export const SEVERITY_COLORS: Record<string, string> = {
  'Battles': 'red',
  'Explosions/Remote violence': 'amber',
  'Violence against civilians': 'red',
  'Protests': 'cyan',
  'Riots': 'purple',
  'Strategic developments': 'green',
};

export const WEAPON_CATEGORY_ICONS: Record<string, string> = {
  'Aircraft': '✈',
  'Armoured vehicles': '⬛',
  'Artillery': '⚔',
  'Missiles': '➤',
  'Naval': '⚓',
  'Sensors': '◉',
  'Air defence systems': '⌇',
  'Engines': '⚙',
  'Other': '◆',
};

export const WEAPON_CATEGORY_COLORS: Record<string, string> = {
  'Aircraft': 'cyan',
  'Armoured vehicles': 'amber',
  'Artillery': 'red',
  'Missiles': 'purple',
  'Naval': 'cyan',
  'Sensors': 'green',
  'Air defence systems': 'amber',
  'Engines': 'green',
  'Other': 'cyan',
};

export const SYNC_INTERVAL_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '6 hours', value: 360 },
  { label: '24 hours', value: 1440 },
];
