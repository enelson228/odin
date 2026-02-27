// ─── UCDP Conflict Events Adapter ─────────────────────────────
// Fetches georeferenced armed conflict events from the Uppsala
// Conflict Data Program (UCDP) Georeferenced Event Dataset (GED) API.
// Auth: None required — completely open API.
// Used as a fallback when ACLED credentials are not configured.
// Docs: https://ucdpapi.pcr.uu.se/

import { ConflictEvent } from '@shared/types';
import { BaseApiAdapter, FetchPageResult } from './base-adapter';

// ── Raw shape returned by UCDP API ───────────────────────────

interface UCDPRawEvent {
  id: string;
  year: number;
  active_year: number;
  type_of_violence: 1 | 2 | 3;
  conflict_name: string;
  dyad_name: string;
  side_a: string;
  side_b: string;
  country: string;
  country_id: number;
  region: string;
  latitude: number;
  longitude: number;
  geom_wkt: string;
  priogrid_gid: number;
  date_start: string;
  date_end: string;
  deaths_a: number | null;
  deaths_b: number | null;
  deaths_civilians: number | null;
  deaths_unknown: number | null;
  best: number | null;
  high: number | null;
  low: number | null;
  source_article: string;
  source_office: string;
  source_date: string;
  source_headline: string;
  source_original: string;
  where_prec: number;
  where_description: string;
  where_coordinates: string;
  adm_1: string;
  adm_2: string;
  relid: string;
}

interface UCDPResponse {
  Result: UCDPRawEvent[];
  pagesize: number;
  totalpages: number;
  page: number;
  TotalCount: number;
}

// ── Violence type → event type mapping ───────────────────────

const VIOLENCE_TYPE_MAP: Record<number, string> = {
  1: 'State-based conflict',
  2: 'Non-state conflict',
  3: 'One-sided violence',
};

// ── Adapter ──────────────────────────────────────────────────

export class UCDPAdapter extends BaseApiAdapter<UCDPRawEvent, ConflictEvent> {
  name = 'ucdp';
  baseUrl = 'https://ucdpapi.pcr.uu.se/api/gedevents/25.1';
  rateLimitMs = 500;
  private apiKey: string = '';

  private static readonly PAGE_SIZE = 1000;

  /**
   * Set the UCDP API key for authenticated requests.
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Map from country name (as returned by UCDP) to ISO3 code.
   * Must be set before syncing via setCountryMap().
   */
  private countryMap: Map<string, string> = new Map();

  /**
   * Provide the country name → ISO3 mapping for reverse lookup.
   * Typically built from the countries table.
   */
  setCountryMap(map: Map<string, string>): void {
    this.countryMap = map;
  }

  async fetchPage(
    params: Record<string, string>,
  ): Promise<FetchPageResult<UCDPRawEvent>> {
    const page = parseInt(params.page ?? '1', 10);

    const url = new URL(this.baseUrl);
    url.searchParams.set('pagesize', String(UCDPAdapter.PAGE_SIZE));
    url.searchParams.set('page', String(page));

    // Add API key if configured
    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    try {
      const res = await this.rateLimitedFetch(url.toString());
      const json: UCDPResponse = await res.json();

      const data = json.Result ?? [];
      const hasMore = page < (json.totalpages ?? 1);

      return {
        data,
        hasMore,
        nextParams: { page: String(page + 1) },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[UCDPAdapter] Error fetching page ${page}: ${message}`);
    }
  }

  normalize(raw: UCDPRawEvent): ConflictEvent {
    // Look up ISO3 from country name
    const iso3 = this.countryMap.get(raw.country) ?? '';

    const eventType = VIOLENCE_TYPE_MAP[raw.type_of_violence] ?? 'Unknown';

    // Best estimate of fatalities (deaths from all sides + civilians + unknown)
    const fatalities = raw.best ?? 0;

    return {
      id: `ucdp_${raw.id}`,
      iso3,
      event_date: raw.date_start,
      event_type: eventType,
      sub_event_type: raw.conflict_name,
      actor1: raw.side_a,
      actor2: raw.side_b || null,
      location: raw.where_description || raw.adm_1 || raw.country,
      latitude: raw.latitude,
      longitude: raw.longitude,
      fatalities,
      notes: raw.source_headline || null,
      source: raw.source_office || 'UCDP',
      source_scale: null,
    };
  }

  async fetchAllEvents(): Promise<ConflictEvent[]> {
    console.log('[UCDPAdapter] Starting conflict event sync...');
    const results = await this.fetchAll({ page: '1' });
    console.log(`[UCDPAdapter] Fetched ${results.length} conflict events`);
    return results;
  }
}

/** @deprecated Use UCDPAdapter instead */
export const UcdpAdapter = UCDPAdapter;
