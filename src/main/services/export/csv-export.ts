import * as fs from 'fs/promises';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';

/** UTF-8 BOM for Excel compatibility. */
const UTF8_BOM = '\ufeff';

/**
 * Exports data to CSV file(s).
 *
 * - If the data map contains a single key, writes one file at filePath.
 * - If multiple keys exist, writes separate files with a suffix derived from
 *   the data key (e.g., "export_countries.csv", "export_conflicts.csv").
 * - Nested objects are flattened: an object-valued column "foo" becomes "foo_json"
 *   containing the JSON-stringified value.
 * - Column headers are transformed to Title Case.
 * - A UTF-8 BOM is prepended for seamless Excel import.
 */
export async function exportToCsv(
    data: Record<string, unknown[]>,
    filePath: string,
): Promise<void> {
    const keys = Object.keys(data);

    if (keys.length === 0) {
        try {
            await fs.writeFile(filePath, '', { encoding: 'utf-8' });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`CSV export failed: ${message}`);
        }
        return;
    }

    if (keys.length === 1) {
        const rows = data[keys[0]];
        const csvContent = buildCsvString(rows);
        try {
            await fs.writeFile(filePath, csvContent, { encoding: 'utf-8' });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`CSV export failed: ${message}`);
        }
        return;
    }

    // Multiple data types: create separate files
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);

    const writePromises: Promise<void>[] = [];

    for (const key of keys) {
        const rows = data[key];
        const csvContent = buildCsvString(rows);
        const outPath = path.join(dir, `${base}_${key}${ext}`);

        writePromises.push(
            fs.writeFile(outPath, csvContent, { encoding: 'utf-8' }).catch((err) => {
                const message = err instanceof Error ? err.message : String(err);
                throw new Error(`CSV export failed for "${key}": ${message}`);
            }),
        );
    }

    await Promise.all(writePromises);
}

/**
 * Builds a CSV string from an array of row objects.
 * Flattens nested objects and applies Title Case headers.
 */
function buildCsvString(rows: unknown[]): string {
    if (!rows || rows.length === 0) {
        return UTF8_BOM;
    }

    const flatRows = rows.map((row) => flattenRow(row as Record<string, unknown>));

    // Collect all unique column keys across all rows (preserving insertion order)
    const columnSet = new Set<string>();
    for (const row of flatRows) {
        for (const key of Object.keys(row)) {
            columnSet.add(key);
        }
    }
    const columns = Array.from(columnSet);

    // Build header mapping: snake_case key -> Title Case header
    const headerMap: Record<string, string> = {};
    for (const col of columns) {
        headerMap[col] = toTitleCase(col);
    }

    const csvOutput = stringify(flatRows, {
        header: true,
        columns: columns.map((key) => ({ key, header: headerMap[key] })),
    });

    return UTF8_BOM + csvOutput;
}

/**
 * Flatten a row object: nested objects/arrays become JSON-stringified "_json" columns.
 */
function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
    const flat: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            flat[`${key}_json`] = JSON.stringify(value);
        } else if (Array.isArray(value)) {
            flat[`${key}_json`] = JSON.stringify(value);
        } else {
            flat[key] = value;
        }
    }

    return flat;
}

/**
 * Convert a snake_case or camelCase string to Title Case.
 * Examples: "event_type" -> "Event Type", "iso3" -> "Iso3"
 */
function toTitleCase(str: string): string {
    return str
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}
