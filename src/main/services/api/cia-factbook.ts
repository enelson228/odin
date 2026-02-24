// ─── CIA World Factbook Adapter ───────────────────────────────
// Fetches country profile data from the GitHub JSON mirror of
// the CIA World Factbook, extracting government, geography, and
// military metadata that supplement World Bank indicators.

import { Country } from '@shared/types';
import { BaseApiAdapter, FetchPageResult } from './base-adapter';

// ── Raw shape of a single Factbook JSON file ─────────────────

interface FactbookRaw {
  slug: string;
  iso3: string;
  Government?: {
    'Government type'?: { text?: string };
    Capital?: { name?: { text?: string } };
  };
  Geography?: {
    Area?: {
      total?: { text?: string };
    };
  };
  'Military and Security'?: {
    'Military and security forces'?: { text?: string };
    'Military service age and obligation'?: { text?: string };
    'Military - note'?: { text?: string };
  };
  'People and Society'?: {
    Population?: {
      total?: { text?: string };
    };
  };
}

// ── Region / slug mapping ────────────────────────────────────
// The factbook.json repo organizes files as {region}/{slug}.json

interface SlugEntry {
  slug: string;
  region: string;
  iso3: string;
}

/**
 * At least 50 major countries mapped to their factbook.json
 * region folder and slug filename (without .json extension).
 */
const ISO3_SLUG_MAP: SlugEntry[] = [
  { iso3: 'USA', region: 'north-america', slug: 'us' },
  { iso3: 'CAN', region: 'north-america', slug: 'ca' },
  { iso3: 'MEX', region: 'north-america', slug: 'mx' },
  { iso3: 'GBR', region: 'europe', slug: 'uk' },
  { iso3: 'FRA', region: 'europe', slug: 'fr' },
  { iso3: 'DEU', region: 'europe', slug: 'gm' },
  { iso3: 'ITA', region: 'europe', slug: 'it' },
  { iso3: 'ESP', region: 'europe', slug: 'sp' },
  { iso3: 'PRT', region: 'europe', slug: 'po' },
  { iso3: 'NLD', region: 'europe', slug: 'nl' },
  { iso3: 'BEL', region: 'europe', slug: 'be' },
  { iso3: 'CHE', region: 'europe', slug: 'sz' },
  { iso3: 'AUT', region: 'europe', slug: 'au' },
  { iso3: 'POL', region: 'europe', slug: 'pl' },
  { iso3: 'SWE', region: 'europe', slug: 'sw' },
  { iso3: 'NOR', region: 'europe', slug: 'no' },
  { iso3: 'DNK', region: 'europe', slug: 'da' },
  { iso3: 'FIN', region: 'europe', slug: 'fi' },
  { iso3: 'GRC', region: 'europe', slug: 'gr' },
  { iso3: 'TUR', region: 'middle-east', slug: 'tu' },
  { iso3: 'ROU', region: 'europe', slug: 'ro' },
  { iso3: 'UKR', region: 'europe', slug: 'up' },
  { iso3: 'RUS', region: 'central-asia', slug: 'rs' },
  { iso3: 'CHN', region: 'east-n-southeast-asia', slug: 'ch' },
  { iso3: 'JPN', region: 'east-n-southeast-asia', slug: 'ja' },
  { iso3: 'KOR', region: 'east-n-southeast-asia', slug: 'ks' },
  { iso3: 'PRK', region: 'east-n-southeast-asia', slug: 'kn' },
  { iso3: 'IND', region: 'south-asia', slug: 'in' },
  { iso3: 'PAK', region: 'south-asia', slug: 'pk' },
  { iso3: 'BGD', region: 'south-asia', slug: 'bg' },
  { iso3: 'LKA', region: 'south-asia', slug: 'ce' },
  { iso3: 'IDN', region: 'east-n-southeast-asia', slug: 'id' },
  { iso3: 'MYS', region: 'east-n-southeast-asia', slug: 'my' },
  { iso3: 'THA', region: 'east-n-southeast-asia', slug: 'th' },
  { iso3: 'VNM', region: 'east-n-southeast-asia', slug: 'vm' },
  { iso3: 'PHL', region: 'east-n-southeast-asia', slug: 'rp' },
  { iso3: 'MMR', region: 'east-n-southeast-asia', slug: 'bm' },
  { iso3: 'TWN', region: 'east-n-southeast-asia', slug: 'tw' },
  { iso3: 'SGP', region: 'east-n-southeast-asia', slug: 'sn' },
  { iso3: 'AUS', region: 'australia-oceania', slug: 'as' },
  { iso3: 'NZL', region: 'australia-oceania', slug: 'nz' },
  { iso3: 'BRA', region: 'south-america', slug: 'br' },
  { iso3: 'ARG', region: 'south-america', slug: 'ar' },
  { iso3: 'COL', region: 'south-america', slug: 'co' },
  { iso3: 'CHL', region: 'south-america', slug: 'ci' },
  { iso3: 'PER', region: 'south-america', slug: 'pe' },
  { iso3: 'VEN', region: 'south-america', slug: 've' },
  { iso3: 'EGY', region: 'africa', slug: 'eg' },
  { iso3: 'ZAF', region: 'africa', slug: 'sf' },
  { iso3: 'NGA', region: 'africa', slug: 'ni' },
  { iso3: 'KEN', region: 'africa', slug: 'ke' },
  { iso3: 'ETH', region: 'africa', slug: 'et' },
  { iso3: 'GHA', region: 'africa', slug: 'gh' },
  { iso3: 'TZA', region: 'africa', slug: 'tz' },
  { iso3: 'DZA', region: 'africa', slug: 'ag' },
  { iso3: 'MAR', region: 'africa', slug: 'mo' },
  { iso3: 'SAU', region: 'middle-east', slug: 'sa' },
  { iso3: 'IRN', region: 'middle-east', slug: 'ir' },
  { iso3: 'IRQ', region: 'middle-east', slug: 'iz' },
  { iso3: 'ISR', region: 'middle-east', slug: 'is' },
  { iso3: 'ARE', region: 'middle-east', slug: 'ae' },
  { iso3: 'QAT', region: 'middle-east', slug: 'qa' },
  { iso3: 'KWT', region: 'middle-east', slug: 'ku' },
  { iso3: 'JOR', region: 'middle-east', slug: 'jo' },
  { iso3: 'LBN', region: 'middle-east', slug: 'le' },
  { iso3: 'SYR', region: 'middle-east', slug: 'sy' },
  { iso3: 'AFG', region: 'south-asia', slug: 'af' },
  { iso3: 'KAZ', region: 'central-asia', slug: 'kz' },
  { iso3: 'UZB', region: 'central-asia', slug: 'uz' },
];

// ── Adapter ──────────────────────────────────────────────────

export class CiaFactbookAdapter extends BaseApiAdapter<FactbookRaw, Partial<Country>> {
  name = 'cia-factbook';
  baseUrl = 'https://raw.githubusercontent.com/factbook/factbook.json/master';
  rateLimitMs = 500;

  /**
   * fetchPage is implemented for interface compliance but is not the
   * primary entry point. Use `fetchAllCountries()` instead.
   *
   * When called, `params.index` is the cursor into ISO3_SLUG_MAP and
   * one country is fetched per "page".
   */
  async fetchPage(
    params: Record<string, string>
  ): Promise<FetchPageResult<FactbookRaw>> {
    const index = parseInt(params.index ?? '0', 10);

    if (index >= ISO3_SLUG_MAP.length) {
      return { data: [], hasMore: false };
    }

    const entry = ISO3_SLUG_MAP[index];
    const url = `${this.baseUrl}/${entry.region}/${entry.slug}.json`;

    try {
      const res = await this.rateLimitedFetch(url);
      const json = await res.json();

      const raw: FactbookRaw = {
        slug: entry.slug,
        iso3: entry.iso3,
        Government: json.Government,
        Geography: json.Geography,
        'Military and Security': json['Military and Security'],
        'People and Society': json['People and Society'],
      };

      return {
        data: [raw],
        hasMore: index + 1 < ISO3_SLUG_MAP.length,
        nextParams: { index: String(index + 1) },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[CiaFactbookAdapter] Failed to fetch ${entry.iso3} (${entry.slug}): ${message}`,
      );
    }
  }

  /**
   * Normalize the nested Factbook JSON into a flat Partial<Country>.
   */
  normalize(raw: FactbookRaw): Partial<Country> {
    const gov = raw.Government;
    const geo = raw.Geography;
    const mil = raw['Military and Security'];

    // Parse area — the text is usually like "total: 9,833,517 sq km"
    let areaSqKm: number | null = null;
    const areaText = geo?.Area?.total?.text ?? '';
    const areaMatch = areaText.match(/([\d,]+)\s*sq\s*km/i);
    if (areaMatch) {
      areaSqKm = parseInt(areaMatch[1].replace(/,/g, ''), 10);
    }

    // Extract capital name — may contain " ; " annotations
    let capital: string | null = null;
    const capitalText = gov?.Capital?.name?.text ?? '';
    if (capitalText) {
      capital = capitalText.split(';')[0].trim().split('\n')[0].trim();
    }

    // Government type
    const governmentType = gov?.['Government type']?.text?.trim() ?? null;

    // Military branches (concatenate what is available)
    const militaryNotes: string[] = [];
    if (mil?.['Military and security forces']?.text) {
      militaryNotes.push(mil['Military and security forces'].text.trim());
    }
    if (mil?.['Military - note']?.text) {
      militaryNotes.push(mil['Military - note'].text.trim());
    }

    return {
      iso3: raw.iso3,
      area_sq_km: areaSqKm,
      capital,
      government_type: governmentType,
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * High-level entry point: fetch profiles for every country in
   * the slug map and return normalized partial Country records.
   */
  async fetchAllCountries(): Promise<Partial<Country>[]> {
    console.log(
      `[CiaFactbookAdapter] Fetching ${ISO3_SLUG_MAP.length} countries...`
    );
    const results = await this.fetchAll({ index: '0' });
    console.log(
      `[CiaFactbookAdapter] Successfully fetched ${results.length} countries`
    );
    return results;
  }

  /**
   * Return the static slug map so callers can see which countries
   * this adapter covers.
   */
  static getSlugMap(): SlugEntry[] {
    return [...ISO3_SLUG_MAP];
  }
}
