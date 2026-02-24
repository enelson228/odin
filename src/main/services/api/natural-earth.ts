// ─── Natural Earth Boundaries Adapter ─────────────────────────
// Reads the bundled Natural Earth GeoJSON file and provides
// country boundary lookup, ISO3 enumeration, and point-in-polygon
// reverse geocoding.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';

// ── GeoJSON type definitions ─────────────────────────────────

interface GeoJsonProperties {
  ISO_A3: string;
  ISO_A2: string;
  NAME: string;
  NAME_LONG: string;
  REGION_UN: string;
  SUBREGION: string;
  POP_EST: number;
  GDP_MD: number;
  CONTINENT: string;
  SOVEREIGNT: string;
  ADMIN: string;
  [key: string]: unknown;
}

interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

interface GeoJsonFeature {
  type: 'Feature';
  properties: GeoJsonProperties;
  geometry: GeoJsonGeometry;
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// ── Adapter ──────────────────────────────────────────────────

export class NaturalEarthAdapter {
  private geojson: GeoJsonFeatureCollection | null = null;
  private iso3Index: Map<string, GeoJsonFeature> = new Map();
  private geojsonPath: string;

  /**
   * @param assetsDir  Absolute path to the assets directory.
   *                   Defaults to `<project>/assets`.
   */
  constructor(assetsDir?: string) {
    // In Electron production builds the assets path differs from dev.
    // Allow callers to override; default assumes standard project layout.
    const base = assetsDir ?? join(__dirname, '..', '..', '..', '..', 'assets');
    this.geojsonPath = join(base, 'geojson', 'ne_countries.geojson');
  }

  // ── Loading ──────────────────────────────────────────────

  /**
   * Read and parse the GeoJSON file from disk. Caches the result
   * in memory for subsequent calls.
   */
  loadBoundaries(): GeoJsonFeatureCollection {
    if (this.geojson) return this.geojson;

    try {
      console.log(
        `[NaturalEarthAdapter] Loading boundaries from ${this.geojsonPath}...`
      );
      const raw = readFileSync(this.geojsonPath, 'utf-8');
      this.geojson = JSON.parse(raw) as GeoJsonFeatureCollection;

      // Build the ISO3 index
      this.iso3Index.clear();
      for (const feature of this.geojson.features) {
        const iso3 = feature.properties?.ISO_A3;
        if (iso3 && iso3 !== '-99' && iso3 !== '-1') {
          this.iso3Index.set(iso3, feature);
        }
      }

      console.log(
        `[NaturalEarthAdapter] Loaded ${this.geojson.features.length} features, ` +
          `${this.iso3Index.size} with valid ISO3 codes`
      );

      return this.geojson;
    } catch (err) {
      console.error(
        '[NaturalEarthAdapter] Failed to load GeoJSON:',
        err
      );
      // Return an empty collection so callers don't crash
      this.geojson = { type: 'FeatureCollection', features: [] };
      return this.geojson;
    }
  }

  /**
   * Ensure the data has been loaded. Call this internally before
   * any lookup method.
   */
  private ensureLoaded(): void {
    if (!this.geojson) {
      this.loadBoundaries();
    }
  }

  // ── Queries ──────────────────────────────────────────────

  /**
   * Return the GeoJSON Feature for a single country by ISO3 code.
   * Returns `null` if not found.
   */
  getCountryFeature(iso3: string): GeoJsonFeature | null {
    this.ensureLoaded();
    return this.iso3Index.get(iso3.toUpperCase()) ?? null;
  }

  /**
   * Return the array of all valid ISO3 codes present in the
   * dataset.
   */
  getAllIso3Codes(): string[] {
    this.ensureLoaded();
    return Array.from(this.iso3Index.keys()).sort();
  }

  /**
   * Reverse-geocode a lat/lng point to an ISO3 country code.
   *
   * Iterates all country polygons and checks point-in-polygon.
   * Returns the ISO3 code of the first matching country, or
   * an empty string if no match is found.
   *
   * Performance note: For bulk lookups, consider building a
   * spatial index. This naive iteration is acceptable for
   * moderate volumes (< 10 000 points).
   */
  reverseGeocode(lat: number, lng: number): string {
    this.ensureLoaded();

    if (!this.geojson) return '';

    // turf expects [longitude, latitude]
    const pt = turfPoint([lng, lat]);

    for (const feature of this.geojson.features) {
      const iso3 = feature.properties?.ISO_A3;
      if (!iso3 || iso3 === '-99' || iso3 === '-1') continue;

      try {
        // booleanPointInPolygon handles both Polygon and MultiPolygon
        if (booleanPointInPolygon(pt, feature as any)) {
          return iso3;
        }
      } catch {
        // Some features may have invalid geometry; skip them
        continue;
      }
    }

    return '';
  }

  /**
   * Batch reverse-geocode an array of points. Returns a Map from
   * the original index to the resolved ISO3 code.
   */
  batchReverseGeocode(
    points: Array<{ lat: number; lng: number }>
  ): Map<number, string> {
    this.ensureLoaded();

    const results = new Map<number, string>();
    for (let i = 0; i < points.length; i++) {
      const { lat, lng } = points[i];
      results.set(i, this.reverseGeocode(lat, lng));
    }
    return results;
  }

  /**
   * Return basic metadata for every country in the dataset.
   * Useful for populating an initial country table.
   */
  getAllCountryMeta(): Array<{
    iso3: string;
    iso2: string;
    name: string;
    region: string;
    subregion: string;
    population: number | null;
    gdp: number | null;
  }> {
    this.ensureLoaded();

    const results: Array<{
      iso3: string;
      iso2: string;
      name: string;
      region: string;
      subregion: string;
      population: number | null;
      gdp: number | null;
    }> = [];

    for (const [iso3, feature] of this.iso3Index) {
      const props = feature.properties;
      results.push({
        iso3,
        iso2: props.ISO_A2 ?? '',
        name: props.NAME ?? props.NAME_LONG ?? '',
        region: props.REGION_UN ?? props.CONTINENT ?? '',
        subregion: props.SUBREGION ?? '',
        population: props.POP_EST ?? null,
        gdp: props.GDP_MD != null ? props.GDP_MD * 1_000_000 : null, // NE stores GDP in millions
      });
    }

    return results;
  }
}
