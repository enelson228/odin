import * as fs from 'fs';
import PDFDocument from 'pdfkit';

// ─── Color Palette ──────────────────────────────────────────────
const COLOR = {
    pageBg: '#0a0e14',
    text: '#e0e6ed',
    textMuted: '#8b98a8',
    accent: '#00e5ff',
    headerBg: '#1a2332',
    rowEven: '#111822',
    rowOdd: '#0a0e14',
    rule: '#1a2332',
} as const;

// ─── Layout Constants ───────────────────────────────────────────
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = PAGE_HEIGHT - 35;
const TABLE_ROW_HEIGHT = 18;
const TABLE_HEADER_HEIGHT = 22;
const PAGE_BREAK_THRESHOLD = PAGE_HEIGHT - 80;

/** Column definitions for each data type: [header, key, width fraction]. */
const TABLE_COLUMNS: Record<string, Array<[string, string, number]>> = {
    countries: [
        ['Name', 'name', 0.25],
        ['Region', 'region', 0.18],
        ['Population', 'population', 0.15],
        ['GDP ($)', 'gdp', 0.17],
        ['Mil. Spend %', 'military_expenditure_pct_gdp', 0.12],
        ['Active Pers.', 'active_personnel', 0.13],
    ],
    conflicts: [
        ['Date', 'event_date', 0.13],
        ['Location', 'location', 0.20],
        ['Event Type', 'event_type', 0.17],
        ['Actor 1', 'actor1', 0.22],
        ['Actor 2', 'actor2', 0.16],
        ['Fatal.', 'fatalities', 0.12],
    ],
    arms: [
        ['Supplier', 'supplier_iso3', 0.12],
        ['Recipient', 'recipient_iso3', 0.12],
        ['Year', 'year', 0.10],
        ['Category', 'weapon_category', 0.22],
        ['Description', 'weapon_description', 0.28],
        ['TIV', 'tiv_delivered', 0.16],
    ],
    installations: [
        ['Name', 'name', 0.28],
        ['Type', 'type', 0.18],
        ['Country', 'iso3', 0.12],
        ['Operator', 'operator', 0.22],
        ['Lat', 'latitude', 0.10],
        ['Lng', 'longitude', 0.10],
    ],
};

/**
 * Exports data to a dark-themed, tactical-styled PDF intelligence report.
 *
 * Layout:
 *   1. Title page with report name, date, and filter summary.
 *   2. Summary statistics section.
 *   3. Data tables per data type with the most relevant columns.
 *   4. Running footer with source attribution and page number.
 */
export async function exportToPdf(
    data: Record<string, unknown[]>,
    filePath: string,
    filters?: object,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margin: MARGIN,
                info: {
                    Title: 'ODIN Intelligence Report',
                    Author: 'ODIN - Open Defense Intelligence Network',
                    Creator: 'ODIN Export System',
                },
            });

            const stream = fs.createWriteStream(filePath);
            stream.on('finish', resolve);
            stream.on('error', (err) => {
                reject(new Error(`PDF export stream error: ${err.message}`));
            });

            doc.on('error', (err) => {
                reject(err);
            });

            doc.pipe(stream);

            let pageNum = 1;

            // ── Helper: draw dark page background ───────────────
            const drawPageBg = (): void => {
                doc.save();
                doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLOR.pageBg);
                doc.restore();
            };

            // ── Helper: draw footer ─────────────────────────────
            const drawFooter = (): void => {
                doc.save();
                doc.fontSize(7)
                    .fillColor(COLOR.textMuted)
                    .text(
                        'ODIN - Open Defense Intelligence Network',
                        MARGIN,
                        FOOTER_Y,
                        { width: CONTENT_WIDTH * 0.7, align: 'left' },
                    );
                doc.text(
                    `Page ${pageNum}`,
                    MARGIN,
                    FOOTER_Y,
                    { width: CONTENT_WIDTH, align: 'right' },
                );
                doc.restore();
            };

            // ── Helper: add a new page with bg + footer ─────────
            const addPage = (): void => {
                drawFooter();
                doc.addPage();
                pageNum++;
                drawPageBg();
            };

            // ── Helper: check if we need a page break ───────────
            const ensureSpace = (requiredHeight: number): void => {
                if (doc.y + requiredHeight > PAGE_BREAK_THRESHOLD) {
                    addPage();
                    doc.y = MARGIN;
                }
            };

            // ══════════════════════════════════════════════════════
            // PAGE 1: Title Page
            // ══════════════════════════════════════════════════════
            drawPageBg();

            doc.y = 200;

            // Main title
            doc.fontSize(28)
                .fillColor(COLOR.accent)
                .font('Helvetica-Bold')
                .text('ODIN', MARGIN, doc.y, { align: 'center', width: CONTENT_WIDTH });

            doc.moveDown(0.3);

            doc.fontSize(14)
                .fillColor(COLOR.text)
                .font('Helvetica')
                .text('INTELLIGENCE REPORT', MARGIN, doc.y, { align: 'center', width: CONTENT_WIDTH });

            doc.moveDown(2);

            // Horizontal rule
            doc.save();
            doc.moveTo(MARGIN + 100, doc.y)
                .lineTo(PAGE_WIDTH - MARGIN - 100, doc.y)
                .strokeColor(COLOR.accent)
                .lineWidth(1)
                .stroke();
            doc.restore();

            doc.moveDown(2);

            // Export date
            doc.fontSize(10)
                .fillColor(COLOR.textMuted)
                .text(`Export Date: ${new Date().toISOString()}`, MARGIN, doc.y, {
                    align: 'center',
                    width: CONTENT_WIDTH,
                });

            doc.moveDown(0.8);

            // Filter summary
            if (filters && Object.keys(filters).length > 0) {
                doc.fontSize(9)
                    .fillColor(COLOR.textMuted)
                    .text('Applied Filters:', MARGIN, doc.y, {
                        align: 'center',
                        width: CONTENT_WIDTH,
                    });
                doc.moveDown(0.4);

                const filterEntries = Object.entries(filters as Record<string, unknown>);
                for (const [key, value] of filterEntries) {
                    if (value !== undefined && value !== null) {
                        const display = Array.isArray(value)
                            ? value.join(', ')
                            : typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value);
                        doc.fontSize(8)
                            .fillColor(COLOR.textMuted)
                            .text(`${formatLabel(key)}: ${display}`, MARGIN, doc.y, {
                                align: 'center',
                                width: CONTENT_WIDTH,
                            });
                        doc.moveDown(0.3);
                    }
                }
            }

            // Data type summary on title page
            doc.moveDown(2);
            doc.fontSize(9).fillColor(COLOR.textMuted);

            const dataKeys = Object.keys(data);
            const totalRecords = dataKeys.reduce((sum, k) => sum + data[k].length, 0);
            doc.text(`Total Records: ${totalRecords.toLocaleString()}`, MARGIN, doc.y, {
                align: 'center',
                width: CONTENT_WIDTH,
            });
            doc.moveDown(0.4);

            for (const key of dataKeys) {
                doc.text(`${formatLabel(key)}: ${data[key].length.toLocaleString()} records`, MARGIN, doc.y, {
                    align: 'center',
                    width: CONTENT_WIDTH,
                });
                doc.moveDown(0.3);
            }

            // ══════════════════════════════════════════════════════
            // PAGE 2+: Summary Statistics
            // ══════════════════════════════════════════════════════
            addPage();
            doc.y = MARGIN;

            doc.fontSize(16)
                .fillColor(COLOR.accent)
                .font('Helvetica-Bold')
                .text('SUMMARY STATISTICS', MARGIN, doc.y, { width: CONTENT_WIDTH });

            doc.moveDown(1);

            // Horizontal rule under section title
            doc.save();
            doc.moveTo(MARGIN, doc.y)
                .lineTo(PAGE_WIDTH - MARGIN, doc.y)
                .strokeColor(COLOR.rule)
                .lineWidth(0.5)
                .stroke();
            doc.restore();

            doc.moveDown(1);

            doc.font('Helvetica');

            for (const key of dataKeys) {
                const rows = data[key];
                doc.fontSize(11)
                    .fillColor(COLOR.accent)
                    .text(`${formatLabel(key)}`, MARGIN, doc.y);
                doc.moveDown(0.3);

                doc.fontSize(9).fillColor(COLOR.text);
                doc.text(`Record count: ${rows.length.toLocaleString()}`, MARGIN + 16, doc.y);
                doc.moveDown(0.3);

                // Type-specific summary stats
                if (key === 'countries' && rows.length > 0) {
                    const populations = rows
                        .map((r) => (r as Record<string, unknown>).population as number | null)
                        .filter((v): v is number => v !== null && v !== undefined);
                    if (populations.length > 0) {
                        const totalPop = populations.reduce((a, b) => a + b, 0);
                        doc.text(`Total population covered: ${totalPop.toLocaleString()}`, MARGIN + 16, doc.y);
                        doc.moveDown(0.3);
                    }
                }

                if (key === 'conflicts' && rows.length > 0) {
                    const fatalities = rows
                        .map((r) => (r as Record<string, unknown>).fatalities as number)
                        .filter((v): v is number => v !== null && v !== undefined);
                    if (fatalities.length > 0) {
                        const totalFatal = fatalities.reduce((a, b) => a + b, 0);
                        doc.text(`Total fatalities: ${totalFatal.toLocaleString()}`, MARGIN + 16, doc.y);
                        doc.moveDown(0.3);
                    }
                }

                if (key === 'arms' && rows.length > 0) {
                    const tivValues = rows
                        .map((r) => (r as Record<string, unknown>).tiv_delivered as number | null)
                        .filter((v): v is number => v !== null && v !== undefined);
                    if (tivValues.length > 0) {
                        const totalTiv = tivValues.reduce((a, b) => a + b, 0);
                        doc.text(`Total TIV delivered: ${totalTiv.toLocaleString()}`, MARGIN + 16, doc.y);
                        doc.moveDown(0.3);
                    }
                }

                doc.moveDown(0.8);
            }

            // ══════════════════════════════════════════════════════
            // DATA TABLES
            // ══════════════════════════════════════════════════════
            for (const key of dataKeys) {
                const rows = data[key] as Record<string, unknown>[];
                if (rows.length === 0) continue;

                const columns = TABLE_COLUMNS[key];
                if (!columns) continue;

                addPage();
                doc.y = MARGIN;

                // Section title
                doc.fontSize(14)
                    .fillColor(COLOR.accent)
                    .font('Helvetica-Bold')
                    .text(formatLabel(key).toUpperCase(), MARGIN, doc.y, { width: CONTENT_WIDTH });

                doc.moveDown(0.5);

                doc.save();
                doc.moveTo(MARGIN, doc.y)
                    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
                    .strokeColor(COLOR.rule)
                    .lineWidth(0.5)
                    .stroke();
                doc.restore();

                doc.moveDown(0.8);
                doc.font('Helvetica');

                // ── Table Header ──────────────────────────────────
                drawTableHeader(doc, columns);

                // ── Table Rows ────────────────────────────────────
                for (let i = 0; i < rows.length; i++) {
                    ensureSpace(TABLE_ROW_HEIGHT + 4);

                    // If we just added a page, re-draw the header
                    if (doc.y <= MARGIN + 2) {
                        doc.y = MARGIN;
                        doc.fontSize(10)
                            .fillColor(COLOR.accent)
                            .text(`${formatLabel(key).toUpperCase()} (continued)`, MARGIN, doc.y);
                        doc.moveDown(0.6);
                        drawTableHeader(doc, columns);
                    }

                    const rowBg = i % 2 === 0 ? COLOR.rowEven : COLOR.rowOdd;
                    drawTableRow(doc, columns, rows[i], rowBg);
                }
            }

            // Final footer on last page
            drawFooter();

            doc.end();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            reject(new Error(`PDF export failed: ${message}`));
        }
    });
}

// ─── Table Drawing Helpers ──────────────────────────────────────

function drawTableHeader(
    doc: PDFKit.PDFDocument,
    columns: Array<[string, string, number]>,
): void {
    const y = doc.y;

    // Header background
    doc.save();
    doc.rect(MARGIN, y, CONTENT_WIDTH, TABLE_HEADER_HEIGHT).fill(COLOR.headerBg);
    doc.restore();

    let x = MARGIN + 4;
    doc.fontSize(7).fillColor(COLOR.accent).font('Helvetica-Bold');

    for (const [header, , widthFrac] of columns) {
        const colWidth = CONTENT_WIDTH * widthFrac;
        doc.text(header.toUpperCase(), x, y + 6, {
            width: colWidth - 6,
            ellipsis: true,
            lineBreak: false,
        });
        x += colWidth;
    }

    doc.font('Helvetica');
    doc.y = y + TABLE_HEADER_HEIGHT;
}

function drawTableRow(
    doc: PDFKit.PDFDocument,
    columns: Array<[string, string, number]>,
    row: Record<string, unknown>,
    bgColor: string,
): void {
    const y = doc.y;

    // Row background
    doc.save();
    doc.rect(MARGIN, y, CONTENT_WIDTH, TABLE_ROW_HEIGHT).fill(bgColor);
    doc.restore();

    let x = MARGIN + 4;
    doc.fontSize(7).fillColor(COLOR.text);

    for (const [, key, widthFrac] of columns) {
        const colWidth = CONTENT_WIDTH * widthFrac;
        const raw = row[key];
        const display = formatCellValue(raw);

        doc.text(display, x, y + 5, {
            width: colWidth - 6,
            ellipsis: true,
            lineBreak: false,
        });
        x += colWidth;
    }

    doc.y = y + TABLE_ROW_HEIGHT;
}

// ─── Formatting Helpers ─────────────────────────────────────────

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return value.toLocaleString();
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function formatLabel(key: string): string {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
