// ─── Overpass (OSM) Military Installations Adapter ────────────
// Queries the Overpass API for military-tagged nodes/ways/relations.
// Uses a single global query with a type regex to target only
// meaningful installation categories, avoiding per-continent bbox
// queries that exceed server timeouts on large regions.

import * as https from 'https';
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

// ── Adapter ──────────────────────────────────────────────────

export class OverpassAdapter extends BaseApiAdapter<OSMElement, MilitaryInstallation> {
  name = 'overpass';
  baseUrl = 'https://overpass-api.de/api/interpreter';

  // Single global query — rate limiting between pages is not applicable.
  rateLimitMs = 0;

  // Server-side timeout in the query (seconds)
  private static readonly SERVER_TIMEOUT_S = 300;

  // Client-side timeout must exceed the server timeout
  private static readonly CLIENT_TIMEOUT_MS = 360_000; // 6 minutes

  /**
   * Build the global Overpass QL query.
   *
   * Uses a regex filter to target only main military installation types,
   * which dramatically reduces result set size vs. querying any military tag.
   * Nodes cover individual buildings/positions; ways cover airfields/bases;
   * relations cover large compound installations.
   */
  private buildQuery(): string {
    const types = [
      'base', 'airfield', 'naval_base', 'barracks',
      'training_area', 'range', 'checkpoint', 'fort',
      'camp', 'bunker', 'launchpad', 'storage',
    ].join('|');

    const nodeTypes   = `^(${types})$`;
    const wayTypes    = '^(base|airfield|naval_base|barracks|training_area|range|fort|camp)$';
    const relTypes    = '^(base|airfield|naval_base|training_area)$';

    return [
      `[out:json][timeout:${OverpassAdapter.SERVER_TIMEOUT_S}][maxsize:536870912];`,
      '(',
      `  node["military"~"${nodeTypes}"];`,
      `  way["military"~"${wayTypes}"];`,
      `  relation["military"~"${relTypes}"];`,
      ');',
      'out center tags;',
    ].join('\n');
  }

  /**
   * POST to the Overpass API using Node's https.request() directly.
   *
   * Both undici (global fetch) and Chromium (net.fetch) negotiate HTTP/2 with
   * overpass-api.de, which causes connection failures. Node's https.request()
   * always uses HTTP/1.1 over TLS, matching curl's behaviour.
   */
  private httpsPost(url: string, body: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const bodyBuf = Buffer.from(body, 'utf8');

      const req = https.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': bodyBuf.length,
          },
          timeout: timeoutMs,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`overpass: HTTP ${res.statusCode}`));
            } else {
              resolve(Buffer.concat(chunks).toString('utf8'));
            }
          });
          res.on('error', reject);
        },
      );

      req.on('timeout', () => {
        req.destroy(new Error(`overpass: request timed out after ${timeoutMs}ms`));
      });
      req.on('error', reject);

      req.write(bodyBuf);
      req.end();
    });
  }

  /**
   * Single-page fetch — the global query returns all results in one response.
   * hasMore is always false; withRetry in fetchAll handles transient failures.
   */
  async fetchPage(
    _params: Record<string, string>
  ): Promise<FetchPageResult<OSMElement>> {
    const query = this.buildQuery();
    const body = `data=${encodeURIComponent(query)}`;

    const text = await this.httpsPost(this.baseUrl, body, OverpassAdapter.CLIENT_TIMEOUT_MS);
    const json: OverpassResponse = JSON.parse(text);
    const elements = json.elements ?? [];

    console.log(`[OverpassAdapter] Global query returned ${elements.length} elements`);

    return {
      data: elements,
      hasMore: false, // Single query — no pagination needed
    };
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
   * High-level entry point: issue the global query and return
   * the deduplicated set of installations.
   */
  async fetchAllRegions(): Promise<MilitaryInstallation[]> {
    console.log('[OverpassAdapter] Starting global military installation query...');

    const results = await this.fetchAll({});

    // Deduplicate by id (should not be needed with a single query, but kept as a safeguard)
    const seen = new Set<string>();
    const deduped: MilitaryInstallation[] = [];
    for (const inst of results) {
      if (!seen.has(inst.id)) {
        seen.add(inst.id);
        deduped.push(inst);
      }
    }

    console.log(`[OverpassAdapter] Total: ${deduped.length} unique installations`);
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
    const { south: s, west: w, north: n, east: e } = { south, west, north, east };
    const query = [
      `[out:json][timeout:${OverpassAdapter.SERVER_TIMEOUT_S}];`,
      '(',
      `  node["military"](${s},${w},${n},${e});`,
      `  way["military"](${s},${w},${n},${e});`,
      `  relation["military"](${s},${w},${n},${e});`,
      ');',
      'out center tags;',
    ].join('\n');

    try {
      const res = await this.rateLimitedFetch(this.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      }, OverpassAdapter.CLIENT_TIMEOUT_MS);

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
