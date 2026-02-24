import Database from 'better-sqlite3';
import type { DatabaseService } from '@main/services/database/db';
import type {
    ExportRequest,
    Country,
    ConflictEvent,
    ArmsTransfer,
    MilitaryInstallation,
} from '@shared/types';
import { exportToJson } from './json-export';
import { exportToCsv } from './csv-export';
import { exportToPdf } from './pdf-export';
import { exportToGeoJson } from './geojson-export';

/**
 * Collected export data, keyed by data category name.
 * Each value is an array of typed records.
 */
interface ExportData {
    countries?: Country[];
    conflicts?: ConflictEvent[];
    arms?: ArmsTransfer[];
    installations?: MilitaryInstallation[];
}

/**
 * ExportService orchestrates data export operations.
 *
 * It opens a **separate** read-only better-sqlite3 connection to the database
 * to avoid blocking the main DatabaseService connection during potentially
 * long-running export queries. Data is queried based on the ExportRequest's
 * dataType and filters, then routed to the appropriate format handler.
 */
export class ExportService {
    private dbPath: string;

    constructor(db: DatabaseService) {
        this.dbPath = db.getPath();
    }

    /**
     * Execute an export operation.
     *
     * 1. Opens a separate read-only DB connection.
     * 2. Queries the requested data with applied filters.
     * 3. Routes to the appropriate format handler.
     * 4. Closes the read-only connection.
     */
    async run(request: ExportRequest): Promise<void> {
        const readDb = new Database(this.dbPath, { readonly: true });
        readDb.pragma('journal_mode = WAL');

        try {
            const exportData = this.queryData(readDb, request);
            const dataMap = this.toRecordMap(exportData);

            switch (request.format) {
                case 'json':
                    await exportToJson(dataMap, request.filePath, request.filters);
                    break;

                case 'csv':
                    await exportToCsv(dataMap, request.filePath);
                    break;

                case 'pdf':
                    await exportToPdf(dataMap, request.filePath, request.filters);
                    break;

                case 'geojson':
                    await exportToGeoJson(dataMap, request.filePath);
                    break;

                default:
                    throw new Error(
                        `Unsupported export format: ${(request as ExportRequest).format}`,
                    );
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Export failed (${request.format}): ${message}`);
        } finally {
            readDb.close();
        }
    }

    // ─── Data Querying ──────────────────────────────────────────

    /**
     * Query the correct table(s) based on dataType, applying any filters.
     */
    private queryData(db: Database.Database, request: ExportRequest): ExportData {
        const { dataType, filters } = request;

        switch (dataType) {
            case 'countries':
                return { countries: this.queryCountries(db, filters?.iso3) };

            case 'conflicts':
                return {
                    conflicts: this.queryConflicts(db, filters?.iso3, filters?.dateRange, filters?.eventTypes),
                };

            case 'arms':
                return { arms: this.queryArms(db, filters?.iso3, filters?.dateRange) };

            case 'installations':
                return { installations: this.queryInstallations(db, filters?.iso3) };

            case 'all':
                return {
                    countries: this.queryCountries(db, filters?.iso3),
                    conflicts: this.queryConflicts(db, filters?.iso3, filters?.dateRange, filters?.eventTypes),
                    arms: this.queryArms(db, filters?.iso3, filters?.dateRange),
                    installations: this.queryInstallations(db, filters?.iso3),
                };

            default:
                throw new Error(`Unknown data type: ${dataType}`);
        }
    }

    /**
     * Convert ExportData to a generic Record<string, unknown[]> map,
     * omitting any undefined categories.
     */
    private toRecordMap(exportData: ExportData): Record<string, unknown[]> {
        const map: Record<string, unknown[]> = {};

        if (exportData.countries) map.countries = exportData.countries;
        if (exportData.conflicts) map.conflicts = exportData.conflicts;
        if (exportData.arms) map.arms = exportData.arms;
        if (exportData.installations) map.installations = exportData.installations;

        return map;
    }

    // ─── Individual Table Queries ────────────────────────────────

    private queryCountries(
        db: Database.Database,
        iso3Filter?: string[],
    ): Country[] {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (iso3Filter && iso3Filter.length > 0) {
            const placeholders = iso3Filter.map(() => '?').join(', ');
            conditions.push(`iso3 IN (${placeholders})`);
            params.push(...iso3Filter);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT * FROM countries ${where} ORDER BY name`;

        return db.prepare(sql).all(params) as Country[];
    }

    private queryConflicts(
        db: Database.Database,
        iso3Filter?: string[],
        dateRange?: { start: string; end: string },
        eventTypes?: string[],
    ): ConflictEvent[] {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (iso3Filter && iso3Filter.length > 0) {
            const placeholders = iso3Filter.map(() => '?').join(', ');
            conditions.push(`iso3 IN (${placeholders})`);
            params.push(...iso3Filter);
        }

        if (dateRange?.start) {
            conditions.push('event_date >= ?');
            params.push(dateRange.start);
        }

        if (dateRange?.end) {
            conditions.push('event_date <= ?');
            params.push(dateRange.end);
        }

        if (eventTypes && eventTypes.length > 0) {
            const placeholders = eventTypes.map(() => '?').join(', ');
            conditions.push(`event_type IN (${placeholders})`);
            params.push(...eventTypes);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT * FROM conflict_events ${where} ORDER BY event_date DESC`;

        return db.prepare(sql).all(params) as ConflictEvent[];
    }

    private queryArms(
        db: Database.Database,
        iso3Filter?: string[],
        dateRange?: { start: string; end: string },
    ): ArmsTransfer[] {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (iso3Filter && iso3Filter.length > 0) {
            const placeholders = iso3Filter.map(() => '?').join(', ');
            // Match either supplier or recipient against the iso3 filter
            conditions.push(`(supplier_iso3 IN (${placeholders}) OR recipient_iso3 IN (${placeholders}))`);
            params.push(...iso3Filter, ...iso3Filter);
        }

        if (dateRange?.start) {
            const yearStart = parseInt(dateRange.start.slice(0, 4), 10);
            if (!isNaN(yearStart)) {
                conditions.push('year >= ?');
                params.push(yearStart);
            }
        }

        if (dateRange?.end) {
            const yearEnd = parseInt(dateRange.end.slice(0, 4), 10);
            if (!isNaN(yearEnd)) {
                conditions.push('year <= ?');
                params.push(yearEnd);
            }
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT * FROM arms_transfers ${where} ORDER BY year DESC`;

        return db.prepare(sql).all(params) as ArmsTransfer[];
    }

    private queryInstallations(
        db: Database.Database,
        iso3Filter?: string[],
    ): MilitaryInstallation[] {
        const conditions: string[] = [];
        const params: unknown[] = [];

        if (iso3Filter && iso3Filter.length > 0) {
            const placeholders = iso3Filter.map(() => '?').join(', ');
            conditions.push(`iso3 IN (${placeholders})`);
            params.push(...iso3Filter);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT * FROM military_installations ${where} ORDER BY name`;

        const rows = db.prepare(sql).all(params) as Array<Record<string, unknown>>;

        // Parse osm_tags from JSON string to object
        return rows.map((row) => ({
            ...row,
            osm_tags: parseOsmTags(row.osm_tags as string | null),
        })) as MilitaryInstallation[];
    }
}

// ─── Helpers ────────────────────────────────────────────────────

function parseOsmTags(raw: string | null): Record<string, string> {
    if (!raw) return {};
    try {
        return JSON.parse(raw) as Record<string, string>;
    } catch {
        return {};
    }
}
