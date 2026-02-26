// ─── Overpass (OSM) Military Installations Adapter ────────────
// Queries the Overpass API for military nodes/ways/relations
// using a single global typed query.
//
// IMPORTANT: Uses Node's https.request() directly — NOT fetch() or net.fetch().
// Both undici and Chromium negotiate HTTP/2 with overpass-api.de and fail
// silently. https.request() always uses HTTP/1.1 and matches curl behavior.

import * as https from 'node:https';
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

// ── Constants ─────────────────────────────────────────────────

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Client timeout must exceed the server's [timeout:300] (300s).
const CLIENT_TIMEOUT_MS = 360_000; // 6 minutes

// Single global query — no per-continent bboxes which time out.
const GLOBAL_MILITARY_QUERY = `[out:json][timeout:300][maxsize:536870912];
(
  node["military"~"^(base|airfield|naval_base|barracks|training_area|range|checkpoint|fort|camp|bunker|launchpad|storage)$"];
  way["military"~"^(base|airfield|naval_base|barracks|training_area|range|fort|camp)$"];
  relation["military"~"^(base|airfield|naval_base|training_area)$"];
);
out center tags;`;

// ── Adapter ──────────────────────────────────────────────────

export class OverpassAdapter extends BaseApiAdapter<OSMElement, MilitaryInstallation> {
  name = 'overpass';
  baseUrl = OVERPASS_URL;
  rateLimitMs = 0; // Single request — no rate limiting needed

  /**
   * fetchPage is implemented for interface compliance.
   * In practice, use fetchAllRegions() which issues a single global query.
   */
  async fetchPage(
    _params: Record<string, string>,
  ): Promise<FetchPageResult<OSMElement>> {
    const elements = await this.issueGlobalQuery();
    return { data: elements, hasMore: false };
  }

  /**
   * Normalize a raw OSM element to a MilitaryInstallation.
   * iso3 is left empty — to be filled by reverse geocoding later.
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
   * Issue the single global military installation query.
   * Uses Node's https.request() to force HTTP/1.1 — Chromium/undici fail
   * with HTTP/2 negotiation against overpass-api.de.
   */
  private issueGlobalQuery(): Promise<OSMElement[]> {
    return new Promise((resolve, reject) => {
      const postData = `data=${encodeURIComponent(GLOBAL_MILITARY_QUERY)}`;

      const options: https.RequestOptions = {
        hostname: 'overpass-api.de',
        path: '/api/interpreter',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      console.log('[OverpassAdapter] Issuing single global military query (timeout: 6 min)...');

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => chunks.push(chunk));

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`[OverpassAdapter] HTTP ${res.statusCode}`));
              return;
            }
            const body = Buffer.concat(chunks).toString('utf-8');
            const json: OverpassResponse = JSON.parse(body);
            const elements = json.elements ?? [];
            console.log(`[OverpassAdapter] Received ${elements.length} elements`);
            resolve(elements);
          } catch (err) {
            reject(new Error(`[OverpassAdapter] Failed to parse response: ${err}`));
          }
        });
      });

      req.setTimeout(CLIENT_TIMEOUT_MS, () => {
        req.destroy(
          new Error(`[OverpassAdapter] Request timed out after ${CLIENT_TIMEOUT_MS / 1000}s`),
        );
      });

      req.on('error', (err) => {
        reject(new Error(`[OverpassAdapter] Request error: ${err.message}`));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * High-level entry point: issue the global query and return
   * deduplicated military installations.
   */
  async fetchAllRegions(): Promise<MilitaryInstallation[]> {
    console.log('[OverpassAdapter] Starting global military installation query...');

    const elements = await this.issueGlobalQuery();
    const installations = elements.map((el) => this.normalize(el));

    // Deduplicate by id
    const seen = new Set<string>();
    const deduped: MilitaryInstallation[] = [];
    for (const inst of installations) {
      if (!seen.has(inst.id)) {
        seen.add(inst.id);
        deduped.push(inst);
      }
    }

    console.log(`[OverpassAdapter] Total: ${deduped.length} unique installations`);
    return deduped;
  }
}
