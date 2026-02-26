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

/** Approximate lat/lng centroids for major countries. Used for map centering. */
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AFG: [33.93, 67.71],  ARG: [-38.42, -63.62], AUS: [-25.27, 133.78],
  AUT: [47.52, 14.55],  BEL: [50.50, 4.47],    BGD: [23.68, 90.36],
  BRA: [-14.24, -51.93],CAN: [56.13, -106.35], CHE: [46.82, 8.23],
  CHL: [-35.68, -71.54],CHN: [35.86, 104.20],  COL: [4.57, -74.30],
  DEU: [51.17, 10.45],  DNK: [56.26, 9.50],    DZA: [28.03, 1.66],
  EGY: [26.82, 30.80],  ESP: [40.46, -3.75],   ETH: [9.14, 40.49],
  FIN: [61.92, 25.75],  FRA: [46.23, 2.21],    GBR: [55.38, -3.44],
  GHA: [7.95, -1.02],   GRC: [39.07, 21.82],   IDN: [-0.79, 113.92],
  IND: [20.59, 78.96],  IRN: [32.43, 53.69],   IRQ: [33.22, 43.68],
  ISR: [31.05, 34.85],  ITA: [41.87, 12.57],   JOR: [30.59, 36.24],
  JPN: [36.20, 138.25], KAZ: [48.02, 66.92],   KEN: [-0.02, 37.91],
  KOR: [35.91, 127.77], KWT: [29.31, 47.48],   LBN: [33.85, 35.86],
  LKA: [7.87, 80.77],   MAR: [31.79, -7.09],   MEX: [23.63, -102.55],
  MMR: [16.87, 96.08],  MYS: [4.21, 101.98],   NGA: [9.08, 8.68],
  NLD: [52.13, 5.29],   NOR: [60.47, 8.47],    NZL: [-40.90, 174.89],
  PAK: [30.38, 69.35],  PER: [-9.19, -75.02],  PHL: [12.88, 121.77],
  POL: [51.92, 19.15],  PRK: [40.34, 127.51],  PRT: [39.40, -8.22],
  QAT: [25.35, 51.18],  ROU: [45.94, 24.97],   RUS: [61.52, 105.32],
  SAU: [23.89, 45.08],  SGP: [1.35, 103.82],   SWE: [60.13, 18.64],
  SYR: [34.80, 38.99],  THA: [15.87, 100.99],  TUR: [38.96, 35.24],
  TWN: [23.70, 120.96], TZA: [-6.37, 34.89],   UKR: [48.38, 31.17],
  URY: [-32.52, -55.77],USA: [37.09, -95.71],  UZB: [41.38, 64.59],
  VEN: [6.42, -66.59],  VNM: [14.06, 108.28],  ZAF: [-30.56, 22.94],
  ARE: [23.42, 53.85],  AFR: [2.0, 21.0],
};

export const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export const SYNC_INTERVAL_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '6 hours', value: 360 },
  { label: '24 hours', value: 1440 },
];
