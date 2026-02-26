// ─── UCDP Conflict Events Adapter ─────────────────────────────
// Fetches georeferenced armed conflict events from the Uppsala
// Conflict Data Program (UCDP) Georeferenced Event Dataset (GED) API.
// Auth: None required — completely open API.
// Docs: https://ucdp.uu.se/apidocs/

import { ConflictEvent } from '@shared/types';
import { BaseApiAdapter, FetchPageResult } from './base-adapter';

// ── Raw shape returned by the UCDP GED API ───────────────────

interface UCDPRawRecord {
  id: number;
  country: string;
  country_id: number;
  region: string;
  date_start: string;
  date_end: string;
  type_of_violence: number; // 1=State-based, 2=Non-state, 3=One-sided
  dyad_name: string;        // "Actor A - Actor B"
  side_a: string;
  side_b: string;
  where_description: string;
  latitude: number;
  longitude: number;
  best: number;             // Best estimate of total deaths
  deaths_a: number;
  deaths_b: number;
  deaths_civilians: number;
  source_article: string;
  source_office: string;
  source_date: string;
  relid: string;            // Release ID
}

interface UCDPApiResponse {
  Result: UCDPRawRecord[];
  TotalCount: number;
  pageSize: number;
  totalPages: number;
  page: number;
  NextPageUrl: string | null;
}

// ── Constants ─────────────────────────────────────────────────

const UCDP_API_BASE = 'https://ucdpapi.pcr.uu.se/api/gedevents/25.1';
const PAGE_SIZE = 1000; // UCDP max per page

const VIOLENCE_TYPE_MAP: Record<number, string> = {
  1: 'State-based conflict',
  2: 'Non-state conflict',
  3: 'One-sided violence',
};

// ── Adapter ──────────────────────────────────────────────────

export class UcdpAdapter extends BaseApiAdapter<UCDPRawRecord, ConflictEvent> {
  name = 'ucdp';
  baseUrl = UCDP_API_BASE;
  rateLimitMs = 500; // UCDP is generous — 500ms between requests is sufficient

  // Map of lowercase country name → iso3, built from the countries table at run time.
  // Populated by the scheduler before calling fetchAll.
  private countryNameToIso3: Map<string, string> = new Map();

  setCountryMap(map: Map<string, string>): void {
    this.countryNameToIso3 = map;
  }

  async fetchPage(params: Record<string, string>): Promise<FetchPageResult<UCDPRawRecord>> {
    const page = parseInt(params.page ?? '1', 10);

    const url = new URL(this.baseUrl);
    url.searchParams.set('pagesize', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));

    if (params.year) {
      url.searchParams.set('year', params.year);
    }

    try {
      const res = await this.rateLimitedFetch(url.toString(), {}, 45_000);
      const json: UCDPApiResponse = await res.json();

      const data = json.Result ?? [];
      return {
        data,
        hasMore: json.NextPageUrl !== null && data.length === PAGE_SIZE,
        nextParams: { page: String(page + 1) },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[UcdpAdapter] Error fetching page ${page}: ${message}`);
    }
  }

  normalize(raw: UCDPRawRecord): ConflictEvent {
    // Split dyad name "Actor A - Actor B" into actor1 / actor2
    const dyadParts = raw.dyad_name?.split(' - ') ?? [];
    const actor1 = raw.side_a || dyadParts[0] || 'Unknown';
    const actor2 = raw.side_b || dyadParts[1] || null;

    // Look up iso3 from the country name (case-insensitive)
    const iso3 = this.countryNameToIso3.get(raw.country?.toLowerCase() ?? '') ?? '';

    return {
      id: `ucdp-${raw.id}`,
      iso3,
      event_date: raw.date_start ? raw.date_start.split(' ')[0] : '', // "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DD"
      event_type: VIOLENCE_TYPE_MAP[raw.type_of_violence] ?? `Type ${raw.type_of_violence}`,
      sub_event_type: '',
      actor1,
      actor2: actor2 || null,
      location: raw.where_description || '',
      latitude: typeof raw.latitude === 'number' ? raw.latitude : parseFloat(String(raw.latitude)) || 0,
      longitude: typeof raw.longitude === 'number' ? raw.longitude : parseFloat(String(raw.longitude)) || 0,
      fatalities: typeof raw.best === 'number' ? raw.best : parseInt(String(raw.best), 10) || 0,
      notes: raw.source_article || null,
      source: raw.source_office || 'UCDP',
      source_scale: null,
    };
  }

  async fetchAllEvents(): Promise<ConflictEvent[]> {
    console.log('[UcdpAdapter] Starting event sync (full dataset)...');
    const results = await this.fetchAll({ page: '1' });
    console.log(`[UcdpAdapter] Fetched ${results.length} conflict events`);
    return results;
  }
}
