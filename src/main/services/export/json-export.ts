import * as fs from 'fs/promises';

/**
 * Exports structured data to a pretty-printed JSON file with metadata envelope.
 *
 * Output format:
 * {
 *   "metadata": { exportDate, source, filters, recordCounts },
 *   "data": { countries: [...], conflicts: [...], ... }
 * }
 */
export async function exportToJson(
    data: Record<string, unknown[]>,
    filePath: string,
    filters?: object,
): Promise<void> {
    const recordCounts: Record<string, number> = {};
    for (const [key, rows] of Object.entries(data)) {
        recordCounts[key] = rows.length;
    }

    const envelope = {
        metadata: {
            exportDate: new Date().toISOString(),
            source: 'ODIN - Open Defense Intelligence Network',
            filters: filters ?? null,
            recordCounts,
        },
        data,
    };

    try {
        const json = JSON.stringify(envelope, null, 2);
        await fs.writeFile(filePath, json, { encoding: 'utf-8' });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`JSON export failed: ${message}`);
    }
}
