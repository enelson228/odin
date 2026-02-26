// ─── Base API Adapter ─────────────────────────────────────────
// Abstract base class for all ODIN API adapters. Provides rate
// limiting, pagination helpers, and a normalize contract.

import { SyncStatus } from '@shared/types';

export interface FetchPageResult<T> {
  data: T[];
  hasMore: boolean;
  nextParams?: Record<string, string>;
}

export abstract class BaseApiAdapter<TRaw, TNormalized> {
  abstract name: string;
  abstract baseUrl: string;
  abstract rateLimitMs: number;

  protected lastRequestTime = 0;

  /**
   * Fetch a single page of raw data using the given params.
   */
  abstract fetchPage(params: Record<string, string>): Promise<FetchPageResult<TRaw>>;

  /**
   * Transform one raw API record into the normalized domain type.
   */
  abstract normalize(raw: TRaw): TNormalized;

  /**
   * Perform a rate-limited HTTP request. Waits if the minimum interval
   * between requests has not yet elapsed, then issues the request.
   */
  protected async rateLimitedRequest(
    url: string,
    init?: RequestInit,
    timeoutMs = 30_000,
  ): Promise<Response> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitMs) {
      await new Promise(r => setTimeout(r, this.rateLimitMs - elapsed));
    }
    this.lastRequestTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Perform a rate-limited HTTP fetch. Waits if the minimum interval
   * between requests has not yet elapsed, then issues the request.
   * Throws on non-2xx responses.
   */
  protected async rateLimitedFetch(
    url: string,
    init?: RequestInit,
    timeoutMs = 30_000,
  ): Promise<Response> {
    const res = await this.rateLimitedRequest(url, init, timeoutMs);
    if (!res.ok) {
      throw new Error(`${this.name}: HTTP ${res.status} from ${url}`);
    }
    return res;
  }

  /**
   * Retry a function with exponential backoff on failure.
   * Attempts: immediate, 2s, 4s, 8s (default 3 retries).
   */
  protected async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 2000,
  ): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          console.warn(
            `[${this.name}] Retry ${attempt + 1}/${maxRetries} in ${delay}ms:`,
            err instanceof Error ? err.message : err,
          );
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  }

  /**
   * Exhaustively paginate through all pages and return the full
   * normalized result set. Each page fetch is retried with backoff
   * on transient failures.
   */
  async fetchAll(initialParams: Record<string, string> = {}): Promise<TNormalized[]> {
    const results: TNormalized[] = [];
    let params = { ...initialParams };
    let hasMore = true;

    while (hasMore) {
      const page = await this.withRetry(() => this.fetchPage(params));
      results.push(...page.data.map(raw => this.normalize(raw)));
      hasMore = page.hasMore;
      if (page.nextParams) {
        params = { ...params, ...page.nextParams };
      }
    }

    return results;
  }

  /**
   * Build a SyncStatus snapshot for this adapter.
   */
  buildSyncStatus(
    status: SyncStatus['status'],
    recordCount: number,
    errorMessage?: string
  ): SyncStatus {
    return {
      adapter: this.name,
      lastSync: new Date().toISOString(),
      status,
      recordCount,
      errorMessage,
    };
  }
}
