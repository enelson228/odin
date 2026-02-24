// ─── SIPRI Arms Transfers Adapter ─────────────────────────────
// Parses SIPRI TIV (Trend Indicator Value) arms transfer data
// from CSV files — either downloaded from the SIPRI website or
// imported from a local path.

import { ArmsTransfer } from '@shared/types';
import { BaseApiAdapter, FetchPageResult } from './base-adapter';
import { parse as csvParseSync } from 'csv-parse/sync';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COUNTRY_NAME_TO_ISO3 } from '../../data/country-mapping';

/**
 * Generate a deterministic ID for an arms transfer record so re-importing
 * the same SIPRI CSV doesn't create duplicate rows.
 */
function deterministicTransferId(
  supplier: string, recipient: string, year: number | string,
  category: string, description: string
): string {
  const raw = `${supplier}|${recipient}|${year}|${category}|${description}`.toLowerCase();
  return createHash('sha256').update(raw).digest('hex').slice(0, 36);
}

// ── Raw row after CSV parsing ────────────────────────────────

interface SipriRawRow {
  [key: string]: string | undefined;
  // Common column names in SIPRI exports:
  Supplier?: string;
  Recipient?: string;
  Year?: string;
  'Year(s) of deliveries'?: string;
  'Weapon category'?: string;
  'Weapon description'?: string;
  'Weapon designation'?: string;
  Description?: string;
  Quantity?: string;
  'TIV delivered'?: string;
  'TIV deal'?: string;
  'Order date'?: string;
  'Delivery date'?: string;
  Status?: string;
  Comments?: string;
  'No. ordered'?: string;
  'No. delivered'?: string;
}

// ── Adapter ──────────────────────────────────────────────────

export class SipriAdapter extends BaseApiAdapter<SipriRawRow, ArmsTransfer> {
  name = 'sipri';
  baseUrl = 'https://armstransfers.sipri.org/armstransfers/html/export_values.php';
  rateLimitMs = 2000;

  /** In-memory parsed rows for pagination through fetchPage. */
  private parsedRows: SipriRawRow[] = [];

  /**
   * Resolve a country name string to its ISO3 code.
   * Returns 'UNK' if the name is not in the mapping.
   */
  private resolveIso3(name: string | undefined): string {
    if (!name) return 'UNK';
    const trimmed = name.trim();
    return COUNTRY_NAME_TO_ISO3[trimmed] ?? 'UNK';
  }

  /**
   * Parse a numeric string that may contain commas or be empty.
   */
  private parseNumber(val: string | undefined): number | null {
    if (!val || val.trim() === '' || val.trim() === '..') return null;
    const cleaned = val.replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse raw CSV content into the internal row buffer.
   */
  private parseCsv(csvContent: string): SipriRawRow[] {
    try {
      // SIPRI CSVs may have comment lines or blank header rows
      // Skip lines that start with comment markers
      const lines = csvContent.split('\n');
      const cleanedLines: string[] = [];
      let foundHeader = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!foundHeader) {
          // Look for the header row — typically contains "Supplier" or "supplier"
          if (
            trimmed.toLowerCase().includes('supplier') ||
            trimmed.toLowerCase().includes('recipient')
          ) {
            foundHeader = true;
            cleanedLines.push(trimmed);
          }
          continue;
        }
        if (trimmed.length > 0) {
          cleanedLines.push(trimmed);
        }
      }

      // If we never found a header, try parsing the whole thing
      const content = foundHeader ? cleanedLines.join('\n') : csvContent;

      const records: SipriRawRow[] = csvParseSync(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
      });

      return records;
    } catch (err) {
      console.error('[SipriAdapter] CSV parse error:', err);
      return [];
    }
  }

  /**
   * fetchPage iterates through the in-memory parsedRows buffer
   * in chunks of 1000.
   */
  async fetchPage(
    params: Record<string, string>
  ): Promise<FetchPageResult<SipriRawRow>> {
    const pageSize = 1000;
    const page = parseInt(params.page ?? '1', 10);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const slice = this.parsedRows.slice(start, end);

    return {
      data: slice,
      hasMore: end < this.parsedRows.length,
      nextParams: { page: String(page + 1) },
    };
  }

  /**
   * Normalize a raw SIPRI CSV row to the shared ArmsTransfer type.
   */
  normalize(raw: SipriRawRow): ArmsTransfer {
    // SIPRI exports vary in column naming; handle several variants
    const supplier =
      raw.Supplier ?? raw['supplier'] ?? '';
    const recipient =
      raw.Recipient ?? raw['recipient'] ?? '';
    const yearStr =
      raw.Year ??
      raw['Year(s) of deliveries'] ??
      raw['year'] ??
      '';
    const weaponCategory =
      raw['Weapon category'] ??
      raw['weapon category'] ??
      raw['Weapon designation'] ??
      '';
    const weaponDescription =
      raw['Weapon description'] ??
      raw['weapon description'] ??
      raw.Description ??
      raw['description'] ??
      '';
    const quantityStr =
      raw.Quantity ??
      raw['No. delivered'] ??
      raw['No. ordered'] ??
      raw['quantity'] ??
      '';
    const tivStr =
      raw['TIV delivered'] ??
      raw['TIV deal'] ??
      raw['tiv delivered'] ??
      '';
    const orderDate = raw['Order date'] ?? raw['order date'] ?? null;
    const deliveryDate = raw['Delivery date'] ?? raw['delivery date'] ?? null;
    const status = raw.Status ?? raw['status'] ?? '';
    const comments = raw.Comments ?? raw['comments'] ?? null;

    // Parse year — may be a range like "2015-2018"; take the first year
    let year = 0;
    if (yearStr) {
      const yearMatch = yearStr.match(/(\d{4})/);
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
      }
    }

    return {
      id: deterministicTransferId(supplier, recipient, year, weaponCategory, weaponDescription),
      supplier_iso3: this.resolveIso3(supplier),
      recipient_iso3: this.resolveIso3(recipient),
      year,
      weapon_category: weaponCategory.trim(),
      weapon_description: weaponDescription.trim(),
      quantity: this.parseNumber(quantityStr),
      tiv_delivered: this.parseNumber(tivStr),
      order_date: orderDate?.trim() || null,
      delivery_date: deliveryDate?.trim() || null,
      status: status.trim(),
      comments: comments?.trim() || null,
    };
  }

  /**
   * Download a CSV from a URL (typically the SIPRI export endpoint)
   * and return normalized ArmsTransfer records.
   */
  async fetchFromUrl(url?: string): Promise<ArmsTransfer[]> {
    const targetUrl = url ?? this.baseUrl;

    console.log(`[SipriAdapter] Downloading CSV from ${targetUrl}...`);

    try {
      const res = await this.rateLimitedFetch(targetUrl);
      const csvText = await res.text();

      this.parsedRows = this.parseCsv(csvText);
      console.log(
        `[SipriAdapter] Parsed ${this.parsedRows.length} rows from remote CSV`
      );

      return this.fetchAll({ page: '1' });
    } catch (err) {
      console.error('[SipriAdapter] Failed to fetch CSV from URL:', err);
      return [];
    }
  }

  /**
   * Import a CSV from a local file path and return normalized
   * ArmsTransfer records.
   */
  async importFromFile(filePath: string): Promise<ArmsTransfer[]> {
    console.log(`[SipriAdapter] Importing CSV from ${filePath}...`);

    try {
      const csvText = readFileSync(filePath, 'utf-8');
      this.parsedRows = this.parseCsv(csvText);
      console.log(
        `[SipriAdapter] Parsed ${this.parsedRows.length} rows from local file`
      );

      return this.fetchAll({ page: '1' });
    } catch (err) {
      console.error(
        `[SipriAdapter] Failed to import CSV from ${filePath}:`,
        err
      );
      return [];
    }
  }

  /**
   * Expose the country mapping for external use (e.g., UI dropdowns).
   */
  static getCountryMap(): Record<string, string> {
    return { ...COUNTRY_NAME_TO_ISO3 };
  }
}
