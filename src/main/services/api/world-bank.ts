// ─── World Bank Development Indicators Adapter ───────────────
// Fetches socioeconomic and military indicators from the World
// Bank Open Data API v2 for all countries.

import { WorldBankIndicator } from '@shared/types';
import { BaseApiAdapter, FetchPageResult } from './base-adapter';

// ── Raw types from the World Bank JSON response ──────────────

interface WBMetadata {
  page: number;
  pages: number;
  per_page: string;
  total: number;
}

interface WBRawRecord {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
  unit: string;
  obs_status: string;
  decimal: number;
}

/** The WB API returns a tuple: [metadata, data[]] */
type WBResponse = [WBMetadata, WBRawRecord[] | null];

// ── Indicator codes we track ─────────────────────────────────

const INDICATOR_CODES = [
  'MS.MIL.XPND.GD.ZS',   // Military expenditure (% of GDP)
  'MS.MIL.XPND.CD',       // Military expenditure (current USD)
  'MS.MIL.TOTL.P1',       // Armed forces personnel, total
  'SP.POP.TOTL',           // Population, total
  'NY.GDP.MKTP.CD',       // GDP (current US$)
  'SP.DYN.LE00.IN',       // Life expectancy at birth, total (years)
] as const;

export type TrackedIndicatorCode = (typeof INDICATOR_CODES)[number];

// ── Adapter ──────────────────────────────────────────────────

export class WorldBankAdapter extends BaseApiAdapter<WBRawRecord, WorldBankIndicator> {
  name = 'world-bank';
  baseUrl = 'https://api.worldbank.org/v2';
  rateLimitMs = 500;

  /** Currently active indicator code (set before fetchPage calls). */
  private activeIndicator: string = INDICATOR_CODES[0];
  private defaultDateRange(): string {
    return `2010:${new Date().getFullYear()}`;
  }

  /**
   * Fetch one page of data for the currently active indicator.
   *
   * @param params  Must include `page` (string). The `indicator` param
   *                is set automatically from `this.activeIndicator`.
   */
  async fetchPage(
    params: Record<string, string>
  ): Promise<FetchPageResult<WBRawRecord>> {
    const page = parseInt(params.page ?? '1', 10);
    const indicator = params.indicator ?? this.activeIndicator;
    const dateRange = params.date ?? this.defaultDateRange();

    const url =
      `${this.baseUrl}/country/all/indicator/${indicator}` +
      `?format=json&per_page=1000&date=${dateRange}&page=${page}`;

    try {
      const res = await this.rateLimitedFetch(url);
      const json: WBResponse = await res.json();

      const [meta, data] = json;

      if (!data || data.length === 0) {
        return { data: [], hasMore: false };
      }

      return {
        data,
        hasMore: meta.page < meta.pages,
        nextParams: {
          page: String(meta.page + 1),
          indicator,
          date: dateRange,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[WorldBankAdapter] Error fetching indicator ${indicator} page ${page}: ${message}`,
      );
    }
  }

  /**
   * Normalize a raw World Bank record into the shared
   * WorldBankIndicator shape.
   */
  normalize(raw: WBRawRecord): WorldBankIndicator {
    return {
      iso3: raw.countryiso3code,
      indicator_code: raw.indicator.id,
      indicator_name: raw.indicator.value,
      year: parseInt(raw.date, 10),
      value: raw.value,
    };
  }

  /**
   * Convenience: fetch every tracked indicator for all countries
   * across all pages and return a single flat array of normalized
   * records.
   */
  async fetchAllIndicators(
    dateRange?: string
  ): Promise<WorldBankIndicator[]> {
    const range = dateRange ?? this.defaultDateRange();
    const allResults: WorldBankIndicator[] = [];

    for (const code of INDICATOR_CODES) {
      console.log(`[WorldBankAdapter] Fetching indicator ${code}...`);
      this.activeIndicator = code;

      try {
        const records = await this.fetchAll({
          page: '1',
          indicator: code,
          date: range,
        });
        allResults.push(...records);
        console.log(
          `[WorldBankAdapter] ${code}: ${records.length} records`
        );
      } catch (err) {
        console.error(
          `[WorldBankAdapter] Failed to fetch indicator ${code}:`,
          err
        );
      }
    }

    console.log(
      `[WorldBankAdapter] Total: ${allResults.length} indicator records`
    );
    return allResults;
  }
}
