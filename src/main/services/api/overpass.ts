// ─── Overpass (OSM) Military Installations Adapter ────────────
// Queries the Overpass API for nodes/ways/relations tagged with
// "military" across continental bounding boxes.

import { MilitaryInstallation } from '@shared/types';
import { BaseApiAdapter, FetchPageResult } from './base-adapter';

// ── Raw OSM element shapes ───────────────────────────────────

interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  version: number;
  generator: string;
  osm3s: { timestamp_osm_base: string; copyright: string };
  elements: OSMElement[];
}

// ── Continental bounding boxes [south, west, north, east] ────

interface BBox {
  label: string;
  south: number;
  west: number;
  north: number;
  east: number;
}

const CONTINENT_BBOXES: BBox[] = [
  { label: 'Europe',        south: 35,  west: -25,  north: 72,  east: 45  },
  { label: 'Asia',          south: -10, west: 25,   north: 55,  east: 180 },
  { label: 'Africa',        south: -35, west: -20,  north: 37,  east: 52  },
  { label: 'North America', south: 5,   west: -170, north: 85,  east: -50 },
  { label: 'South America', south: -56, west: -82,  north: 13,  east: -34 },
  { label: 'Oceania',       south: -50, west: 110,  north: 0,   east: 180 },
];

// ── Adapter ──────────────────────────────────────────────────

export class OverpassAdapter extends BaseApiAdapter<OSMElement, MilitaryInstallation> {
  name = 'overpass';
  baseUrl = 'https://overpass-api.de/api/interpreter';
  rateLimitMs = 30_000; // 30 s — Overpass enforces strict rate limits

  /** Index of the next bbox to query (used by fetchPage). */
  private currentBboxIndex = 0;

  /**
   * Build the Overpass QL query for a bounding box.
   */
  private buildQuery(bbox: BBox): string {
    const { south: s, west: w, north: n, east: e } = bbox;
    return [
      '[out:json][timeout:120];',
      '(',
      `node["military"](${s},${w},${n},${e});`,
      `way["military"](${s},${w},${n},${e});`,
      `relation["military"](${s},${w},${n},${e});`,
      ');',
      'out center tags;',
    ].join('\n');
  }

  /**
   * Fetch one "page" = one continental bounding box.
   *
   * @param params  `bboxIndex` determines which continent to query.
   */
  async fetchPage(
    params: Record<string, string>
  ): Promise<FetchPageResult<OSMElement>> {
    const index = parseInt(params.bboxIndex ?? '0', 10);

    if (index >= CONTINENT_BBOXES.length) {
      return { data: [], hasMore: false };
    }

    const bbox = CONTINENT_BBOXES[index];
    const query = this.buildQuery(bbox);

    console.log(
      `[OverpassAdapter] Querying ${bbox.label} (bbox ${index + 1}/${CONTINENT_BBOXES.length})...`
    );

    // Overpass query requests [timeout:120] server-side — our client timeout
    // must exceed that. 504/503 responses indicate transient server overload
    // and are worth retrying with backoff.
    const MAX_ATTEMPTS = 3;
    const CLIENT_TIMEOUT_MS = 150_000; // 150 s > [timeout:120]

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await this.rateLimitedFetch(
          this.baseUrl,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`,
          },
          CLIENT_TIMEOUT_MS,
        );

        const json: OverpassResponse = await res.json();
        const elements = json.elements ?? [];

        console.log(`[OverpassAdapter] ${bbox.label}: ${elements.length} elements`);

        return {
          data: elements,
          hasMore: index + 1 < CONTINENT_BBOXES.length,
          nextParams: { bboxIndex: String(index + 1) },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isRetryable =
          message.includes('504') || message.includes('503') || message.includes('502');

        if (isRetryable && attempt < MAX_ATTEMPTS) {
          const waitMs = attempt * 60_000; // 60 s, 120 s
          console.warn(
            `[OverpassAdapter] ${bbox.label}: server returned ${message}, ` +
            `retrying in ${waitMs / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})...`
          );
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        throw new Error(`[OverpassAdapter] Error querying ${bbox.label}: ${message}`);
      }
    }

    // Unreachable — loop always returns or throws
    throw new Error(`[OverpassAdapter] Unexpected exit from retry loop for ${bbox.label}`);
  }

  /**
   * Normalize a raw OSM element to a MilitaryInstallation.
   *
   * Note: `iso3` is left empty here because Overpass does not
   * provide country codes. It should be filled later by reverse
   * geocoding with the NaturalEarthAdapter.
   */
  normalize(raw: OSMElement): MilitaryInstallation {
    const lat = raw.lat ?? raw.center?.lat ?? 0;
    const lon = raw.lon ?? raw.center?.lon ?? 0;

    return {
      id: `osm_${raw.type}_${raw.id}`,
      iso3: '', // To be filled by reverse geocoding
      name: raw.tags?.name ?? null,
      type: raw.tags?.military ?? 'unknown',
      latitude: lat,
      longitude: lon,
      operator: raw.tags?.operator ?? null,
      osm_tags: raw.tags ?? {},
    };
  }

  /**
   * High-level entry point: query every continental bounding box
   * and return the full deduplicated set of installations.
   */
  async fetchAllRegions(): Promise<MilitaryInstallation[]> {
    console.log(
      `[OverpassAdapter] Starting global military installation query across ${CONTINENT_BBOXES.length} regions...`
    );

    this.currentBboxIndex = 0;
    const results = await this.fetchAll({ bboxIndex: '0' });

    // Deduplicate by id (overlapping bboxes can return the same element)
    const seen = new Set<string>();
    const deduped: MilitaryInstallation[] = [];
    for (const inst of results) {
      if (!seen.has(inst.id)) {
        seen.add(inst.id);
        deduped.push(inst);
      }
    }

    console.log(
      `[OverpassAdapter] Total: ${deduped.length} unique installations (${results.length} before dedup)`
    );
    return deduped;
  }

  /**
   * Query a custom bounding box (useful for per-country queries).
   */
  async fetchBBox(
    south: number,
    west: number,
    north: number,
    east: number
  ): Promise<MilitaryInstallation[]> {
    const bbox: BBox = { label: 'custom', south, west, north, east };
    const query = this.buildQuery(bbox);

    try {
      const res = await this.rateLimitedFetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });

      const json: OverpassResponse = await res.json();
      return (json.elements ?? []).map(el => this.normalize(el));
    } catch (err) {
      console.error(
        `[OverpassAdapter] Error querying custom bbox [${south},${west},${north},${east}]:`,
        err
      );
      return [];
    }
  }
}
