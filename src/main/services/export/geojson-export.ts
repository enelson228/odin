import * as fs from 'fs/promises';

// ─── GeoJSON Types ──────────────────────────────────────────────

interface GeoJsonFeatureCollection {
    type: 'FeatureCollection';
    features: GeoJsonFeature[];
}

interface GeoJsonFeature {
    type: 'Feature';
    geometry: GeoJsonGeometry | null;  // null is valid per RFC 7946
    properties: Record<string, unknown>;
}

type GeoJsonGeometry =
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'LineString'; coordinates: Array<[number, number]> };

// ─── Country Centroids ──────────────────────────────────────────
// Approximate geographic centroids for major countries, keyed by ISO 3166-1 alpha-3.
// Coordinates are [longitude, latitude] to match GeoJSON convention.

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
    AFG: [67.71, 33.94],
    AGO: [17.87, -11.20],
    ALB: [20.17, 41.15],
    ARE: [53.85, 23.42],
    ARG: [-63.62, -38.42],
    ARM: [45.04, 40.07],
    AUS: [133.78, -25.27],
    AUT: [14.55, 47.52],
    AZE: [47.58, 40.14],
    BDI: [29.92, -3.37],
    BEL: [4.47, 50.50],
    BEN: [2.32, 9.31],
    BFA: [-1.56, 12.24],
    BGD: [90.36, 23.68],
    BGR: [25.49, 42.73],
    BHR: [50.56, 26.07],
    BIH: [17.68, 43.92],
    BLR: [27.95, 53.71],
    BOL: [-63.59, -16.29],
    BRA: [-51.93, -14.24],
    BRN: [114.73, 4.54],
    BWA: [24.68, -22.33],
    CAF: [20.94, 6.61],
    CAN: [-106.35, 56.13],
    CHE: [8.23, 46.82],
    CHL: [-71.54, -35.68],
    CHN: [104.20, 35.86],
    CIV: [-5.55, 7.54],
    CMR: [12.35, 7.37],
    COD: [21.76, -4.04],
    COG: [15.83, -0.23],
    COL: [-74.30, 4.57],
    CRI: [-83.75, 9.75],
    CUB: [-77.78, 21.52],
    CYP: [33.43, 35.13],
    CZE: [15.47, 49.82],
    DEU: [10.45, 51.17],
    DJI: [42.59, 11.83],
    DNK: [9.50, 56.26],
    DOM: [-70.16, 18.74],
    DZA: [1.66, 28.03],
    ECU: [-78.18, -1.83],
    EGY: [30.80, 26.82],
    ERI: [39.78, 15.18],
    ESP: [-3.75, 40.46],
    EST: [25.01, 58.60],
    ETH: [40.49, 9.15],
    FIN: [25.75, 61.92],
    FRA: [2.21, 46.23],
    GAB: [11.61, -0.80],
    GBR: [-3.44, 55.38],
    GEO: [43.36, 42.32],
    GHA: [-1.02, 7.95],
    GIN: [-9.95, 9.95],
    GMB: [-15.31, 13.44],
    GNB: [-15.18, 12.28],
    GNQ: [10.27, 1.65],
    GRC: [21.82, 39.07],
    GTM: [-90.23, 15.78],
    GUY: [-58.93, 4.86],
    HND: [-86.24, 15.20],
    HRV: [15.20, 45.10],
    HTI: [-72.29, 18.97],
    HUN: [19.50, 47.16],
    IDN: [113.92, -0.79],
    IND: [78.96, 20.59],
    IRL: [-8.24, 53.41],
    IRN: [53.69, 32.43],
    IRQ: [43.68, 33.22],
    ISL: [-19.02, 64.96],
    ISR: [34.85, 31.05],
    ITA: [12.57, 41.87],
    JAM: [-77.30, 18.11],
    JOR: [36.24, 30.59],
    JPN: [138.25, 36.20],
    KAZ: [66.92, 48.02],
    KEN: [37.91, -0.02],
    KGZ: [74.77, 41.20],
    KHM: [104.99, 12.57],
    KOR: [127.77, 35.91],
    KWT: [47.48, 29.31],
    LAO: [102.50, 19.86],
    LBN: [35.86, 33.85],
    LBR: [-9.43, 6.43],
    LBY: [17.23, 26.34],
    LKA: [80.77, 7.87],
    LTU: [23.88, 55.17],
    LUX: [6.13, 49.82],
    LVA: [24.60, 56.88],
    MAR: [-7.09, 31.79],
    MDA: [28.37, 47.41],
    MDG: [46.87, -18.77],
    MEX: [-102.55, 23.63],
    MLI: [-3.99, 17.57],
    MMR: [95.96, 21.91],
    MNE: [19.37, 42.71],
    MNG: [103.85, 46.86],
    MOZ: [35.53, -18.67],
    MRT: [-10.94, 21.01],
    MWI: [34.30, -13.25],
    MYS: [101.98, 4.21],
    NAM: [18.49, -22.96],
    NER: [8.08, 17.61],
    NGA: [8.68, 9.08],
    NIC: [-85.21, 12.87],
    NLD: [5.29, 52.13],
    NOR: [8.47, 60.47],
    NPL: [84.12, 28.39],
    NZL: [174.89, -40.90],
    OMN: [55.92, 21.47],
    PAK: [69.35, 30.38],
    PAN: [-80.78, 8.54],
    PER: [-75.02, -9.19],
    PHL: [121.77, 12.88],
    PNG: [143.96, -6.31],
    POL: [19.15, 51.92],
    PRK: [127.51, 40.34],
    PRT: [-8.22, 39.40],
    PRY: [-58.44, -23.44],
    PSE: [35.23, 31.95],
    QAT: [51.18, 25.35],
    ROU: [24.97, 45.94],
    RUS: [105.32, 61.52],
    RWA: [29.87, -1.94],
    SAU: [45.08, 23.89],
    SDN: [30.22, 12.86],
    SEN: [-14.45, 14.50],
    SGP: [103.82, 1.35],
    SLE: [-11.78, 8.46],
    SLV: [-88.90, 13.79],
    SOM: [46.20, 5.15],
    SRB: [21.01, 44.02],
    SSD: [31.31, 6.88],
    SVK: [19.70, 48.67],
    SVN: [14.99, 46.15],
    SWE: [18.64, 60.13],
    SWZ: [31.47, -26.52],
    SYR: [38.99, 34.80],
    TCD: [18.73, 15.45],
    TGO: [0.82, 8.62],
    THA: [100.99, 15.87],
    TJK: [71.28, 38.86],
    TKM: [59.56, 38.97],
    TTO: [-61.22, 10.69],
    TUN: [9.54, 33.89],
    TUR: [35.24, 38.96],
    TWN: [120.96, 23.69],
    TZA: [34.89, -6.37],
    UGA: [32.29, 1.37],
    UKR: [31.17, 48.38],
    URY: [-55.77, -32.52],
    USA: [-95.71, 37.09],
    UZB: [64.59, 41.38],
    VEN: [-66.59, 6.42],
    VNM: [108.28, 14.06],
    YEM: [48.52, 15.55],
    ZAF: [22.94, -30.56],
    ZMB: [27.85, -13.13],
    ZWE: [29.15, -19.02],
};

/**
 * Exports data as a GeoJSON FeatureCollection.
 *
 * - Conflicts and installations: Point features at [longitude, latitude].
 * - Arms transfers: LineString features from supplier centroid to recipient centroid.
 * - Countries: included as properties-only features (no geometry) unless we
 *   have a centroid, in which case they become Point features at the centroid.
 * - Each feature includes a `_dataType` property for downstream filtering.
 */
export async function exportToGeoJson(
    data: Record<string, unknown[]>,
    filePath: string,
): Promise<void> {
    const features: GeoJsonFeature[] = [];

    for (const [dataType, rows] of Object.entries(data)) {
        for (const row of rows) {
            const record = row as Record<string, unknown>;
            const feature = buildFeature(dataType, record);
            if (feature) {
                features.push(feature);
            }
        }
    }

    const featureCollection: GeoJsonFeatureCollection = {
        type: 'FeatureCollection',
        features,
    };

    try {
        const json = JSON.stringify(featureCollection, null, 2);
        await fs.writeFile(filePath, json, { encoding: 'utf-8' });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`GeoJSON export failed: ${message}`);
    }
}

/**
 * Build a GeoJSON Feature from a data record, based on data type.
 */
function buildFeature(
    dataType: string,
    record: Record<string, unknown>,
): GeoJsonFeature | null {
    switch (dataType) {
        case 'conflicts':
            return buildPointFeature(record, 'conflict');

        case 'installations':
            return buildPointFeature(record, 'installation');

        case 'arms':
            return buildArmsFeature(record);

        case 'countries':
            return buildCountryFeature(record);

        default:
            // Attempt point feature if lat/lng exist
            if (hasCoordinates(record)) {
                return buildPointFeature(record, dataType);
            }
            return null;
    }
}

/**
 * Build a Point feature from a record that has latitude/longitude fields.
 */
function buildPointFeature(
    record: Record<string, unknown>,
    featureType: string,
): GeoJsonFeature | null {
    const lat = record.latitude as number | null | undefined;
    const lng = record.longitude as number | null | undefined;

    if (lat == null || lng == null || !isFinite(lat) || !isFinite(lng)) {
        return null;
    }

    const properties = { ...record, _dataType: featureType };
    delete properties.latitude;
    delete properties.longitude;

    return {
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [lng, lat],
        },
        properties,
    };
}

/**
 * Build a LineString feature for an arms transfer, connecting supplier
 * and recipient country centroids.
 */
function buildArmsFeature(record: Record<string, unknown>): GeoJsonFeature | null {
    const supplierIso3 = record.supplier_iso3 as string | undefined;
    const recipientIso3 = record.recipient_iso3 as string | undefined;

    if (!supplierIso3 || !recipientIso3) {
        return null;
    }

    const supplierCoords = COUNTRY_CENTROIDS[supplierIso3];
    const recipientCoords = COUNTRY_CENTROIDS[recipientIso3];

    if (!supplierCoords || !recipientCoords) {
        // If we cannot resolve both centroids, skip the geometry but still
        // include the record as a properties-only feature with null geometry.
        return {
            type: 'Feature',
            geometry: null,
            properties: { ...record, _dataType: 'arms_transfer' },
        };
    }

    const properties = { ...record, _dataType: 'arms_transfer' };

    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [supplierCoords, recipientCoords],
        },
        properties,
    };
}

/**
 * Build a feature for a country record. Uses the centroid from our
 * lookup table if available, otherwise creates a geometry-less feature.
 */
function buildCountryFeature(record: Record<string, unknown>): GeoJsonFeature | null {
    const iso3 = record.iso3 as string | undefined;

    if (!iso3) {
        return null;
    }

    const centroid = COUNTRY_CENTROIDS[iso3];

    if (centroid) {
        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: centroid,
            },
            properties: { ...record, _dataType: 'country' },
        };
    }

    // No geometry available — include as null-geometry feature
    return {
        type: 'Feature',
        geometry: null,
        properties: { ...record, _dataType: 'country' },
    };
}

function hasCoordinates(record: Record<string, unknown>): boolean {
    return (
        typeof record.latitude === 'number' &&
        typeof record.longitude === 'number' &&
        isFinite(record.latitude) &&
        isFinite(record.longitude)
    );
}
