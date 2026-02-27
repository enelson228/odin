// ─── GDELT Conflict Events Adapter ─────────────────────────────
// Fetches georeferenced conflict events from the GDELT API.
// Docs: https://www.gdeltproject.org/

import { ConflictEvent } from '@shared/types';
import { BaseApiAdapter, FetchPageResult } from './base-adapter';

// GDELT API returns events in CSV format
interface GDELTRawEvent {
  GLOBALEVENTID: string;
  SQLDATE: string;
  EventDate: string;
  Year: string;
  MonthYear: string;
  Actor1Code: string;
  Actor1Name: string;
  Actor1CountryCode: string;
  Actor2Code: string;
  Actor2Name: string;
  Actor2CountryCode: string;
  EventCode: string;
  EventBaseCode: string;
  RootEventCode: string;
  QuadClass: string;
  GoldsteinScale: string;
  NumMentions: string;
  NumSources: string;
  NumArticles: string;
  AvgTone: string;
  Actor1Geo_Type: string;
  Actor1Geo_FullName: string;
  Actor1Geo_CountryCode: string;
  Actor1Geo_Lat: string;
  Actor1Geo_Long: string;
  Actor2Geo_Type: string;
  Actor2Geo_FullName: string;
  Actor2Geo_CountryCode: string;
  Actor2Geo_Lat: string;
  Actor2Geo_Long: string;
  ActionGeo_Type: string;
  ActionGeo_FullName: string;
  ActionGeo_CountryCode: string;
  ActionGeo_Lat: string;
  ActionGeo_Long: string;
  DATEADDED: string;
  SOURCEURL: string;
}

// Mapping from GDELT event codes to ACLED-like event types
const EVENT_CODE_MAP: Record<string, string> = {
  // Violence against civilians
  '18': 'Violent attack',
  '19': 'Violent attack',
  '20': 'Violent attack',
  // Strategic developments
  '01': 'Strategic development',
  '02': 'Strategic development',
  // Protests
  '14': 'Peaceful protest',
  '15': 'Protest with intervention',
  // Battles
  '03': 'Armed battle',
  '04': 'Armed battle',
  '05': 'Armed battle',
};

// Violence types (simplified)
function mapEventType(eventCode: string): string {
  const code = eventCode?.substring(0, 2);
  return EVENT_CODE_MAP[code] || 'Other';
}

// Map country code to ISO3
const ISO3_MAP: Record<string, string> = {
  US: 'USA', UK: 'GBR', RU: 'RUS', CN: 'CHN', IN: 'IND',
  PK: 'PAK', IR: 'IRN', IQ: 'IRQ', AF: 'AFG', SY: 'SYR',
  UA: 'UKR', SUA: 'SDN', EG: 'EGY', LY: 'LBY', YE: 'YEM',
  SO: 'SOM', ET: 'ETH', KE: 'KEN', TZ: 'TZA', ZA: 'ZAF',
  CO: 'COL', PE: 'PER', VE: 'VEN', BR: 'BRA', AR: 'ARG',
  MX: 'MEX', FR: 'FRA', DE: 'DEU', ES: 'ESP', IT: 'ITA',
  TR: 'TUR', SA: 'SAU', IL: 'ISR', PS: 'PSE', LB: 'LBN',
};

function getIso3(countryCode: string): string | null {
  if (!countryCode) return null;
  return ISO3_MAP[countryCode.toUpperCase()] || countryCode;
}

export class GDELTAdapter extends BaseApiAdapter<GDELTRawEvent, ConflictEvent> {
  name = 'gdelt';
  baseUrl = 'https://api.gdeltproject.org/api/v2/doc/doc';
  rateLimitMs = 2000;

  private static readonly PAGE_SIZE = 250;
  private static readonly MAX_RECORDS = 25000; // 100 pages max

  private countryMap: Map<string, string> = new Map();

  setCountryMap(map: Map<string, string>): void {
    this.countryMap = map;
  }

  async fetchPage(params: Record<string, string>): Promise<FetchPageResult<GDELTRawEvent>> {
    const page = parseInt(params.page ?? '1', 10);
    const format = 'csv';
    const mode = 'artlist';
    const sort = 'DateDesc';

    const url = new URL(this.baseUrl);
    url.searchParams.set('format', format);
    url.searchParams.set('mode', mode);
    url.searchParams.set('sort', sort);
    url.searchParams.set('maxrecords', String(GDELTAdapter.PAGE_SIZE));
    url.searchParams.set('page', String(page));
    
    // Query for conflict/violence events (CAMEO codes 18-20, 03-05)
    // Also include protests (14-15) and strategic developments (01-02)
    url.searchParams.set('query', 
      '(eventcode:18 OR eventcode:19 OR eventcode:20 OR eventcode:03 OR eventcode:04 OR eventcode:05) AND (-isrootevent:1)'
    );

    try {
      const res = await this.rateLimitedFetch(url.toString());
      
      // GDELT returns CSV as plain text
      const text = await res.text();
      
      if (!text || text.trim() === '') {
        return { data: [], hasMore: false, nextParams: {} };
      }

      // Parse CSV
      const lines = text.trim().split('\n');
      const data: GDELTRawEvent[] = [];
      
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        if (values.length >= 50) {
          const event: GDELTRawEvent = {
            GLOBALEVENTID: values[0],
            SQLDATE: values[1],
            EventDate: values[2],
            Year: values[3],
            MonthYear: values[4],
            Actor1Code: values[5],
            Actor1Name: values[6],
            Actor1CountryCode: values[7],
            Actor2Code: values[8],
            Actor2Name: values[9],
            Actor2CountryCode: values[10],
            EventCode: values[11],
            EventBaseCode: values[12],
            RootEventCode: values[13],
            QuadClass: values[14],
            GoldsteinScale: values[15],
            NumMentions: values[16],
            NumSources: values[17],
            NumArticles: values[18],
            AvgTone: values[19],
            Actor1Geo_Type: values[20],
            Actor1Geo_FullName: values[21],
            Actor1Geo_CountryCode: values[22],
            Actor1Geo_Lat: values[23],
            Actor1Geo_Long: values[24],
            Actor2Geo_Type: values[25],
            Actor2Geo_FullName: values[26],
            Actor2Geo_CountryCode: values[27],
            Actor2Geo_Lat: values[28],
            Actor2Geo_Long: values[29],
            ActionGeo_Type: values[30],
            ActionGeo_FullName: values[31],
            ActionGeo_CountryCode: values[32],
            ActionGeo_Lat: values[33],
            ActionGeo_Long: values[34],
            DATEADDED: values[35],
            SOURCEURL: values[36],
          };
          data.push(event);
        }
      }

      const hasMore = data.length === GDELTAdapter.PAGE_SIZE && 
                      (page * GDELTAdapter.PAGE_SIZE) < GDELTAdapter.MAX_RECORDS;

      return {
        data,
        hasMore,
        nextParams: { page: String(page + 1) },
      };
    } catch (err) {
      console.error('[GDELTAdapter] Error fetching page:', err);
      return { data: [], hasMore: false, nextParams: {} };
    }
  }

  normalize(raw: GDELTRawEvent): ConflictEvent {
    const lat = parseFloat(raw.ActionGeo_Lat || raw.Actor1Geo_Lat || '0');
    const lng = parseFloat(raw.ActionGeo_Long || raw.Actor1Geo_Long || '0');
    
    // Default to 0,0 if no coordinates (will be filtered out)
    const validLat = isNaN(lat) ? 0 : lat;
    const validLng = isNaN(lng) ? 0 : lng;

    // Use action country or actor1 country
    let iso3 = getIso3(raw.ActionGeo_CountryCode || raw.Actor1CountryCode || '');
    
    // Try country name lookup if code failed
    if (!iso3 && raw.ActionGeo_FullName) {
      const countryName = raw.ActionGeo_FullName.split(',').pop()?.trim();
      if (countryName && this.countryMap.has(countryName.toLowerCase())) {
        iso3 = this.countryMap.get(countryName.toLowerCase()) || 'XXX';
      }
    }

    // Default if still not found
    if (!iso3) iso3 = 'XXX';

    const eventDate = raw.EventDate || raw.SQLDATE || '';
    const fatalities = parseInt(raw.NumMentions || '0', 10);

    return {
      id: `gdelt-${raw.GLOBALEVENTID}`,
      iso3,
      event_date: eventDate,
      event_type: mapEventType(raw.EventCode || ''),
      sub_event_type: '',
      actor1: raw.Actor1Name || '',
      actor2: raw.Actor2Name || null,
      location: raw.ActionGeo_FullName || '',
      latitude: validLat,
      longitude: validLng,
      fatalities,
      notes: raw.SOURCEURL || null,
      source: 'GDELT',
      source_scale: raw.SOURCEURL ? new URL(raw.SOURCEURL).hostname : null,
    };
  }

  async fetchAllEvents(sinceDate?: string): Promise<ConflictEvent[]> {
    const events: ConflictEvent[] = [];
    let params: Record<string, string> = { page: '1' };
    let pageCount = 0;
    const maxPages = 100;

    while (pageCount < maxPages) {
      const result = await this.fetchPage(params);
      
      for (const raw of result.data) {
        const event = this.normalize(raw);
        if (event) {
          // Filter by date if sinceDate provided
          if (sinceDate && event.event_date < sinceDate) {
            return events;
          }
          events.push(event);
        }
      }

      if (!result.hasMore || !result.nextParams) break;
      params = result.nextParams;
      pageCount++;
    }

    return events;
  }
}
