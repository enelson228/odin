// ─── ACLED Conflict Events Adapter ────────────────────────────
// Fetches armed conflict event data from the ACLED REST API.
// Auth: OAuth2 password grant → Bearer token.
// Docs: https://acleddata.com/api-documentation/getting-started

import { ConflictEvent } from '@shared/types';
import { BaseApiAdapter, FetchPageResult } from './base-adapter';

// ── Raw shape returned by the ACLED API ──────────────────────

interface ACLEDRawRecord {
  event_id_cnty: string;
  iso3: string;
  event_date: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  actor2: string;
  location: string;
  latitude: string;
  longitude: string;
  fatalities: string;
  notes: string;
  source: string;
  source_scale: string;
  country: string;
  region: string;
  admin1: string;
  admin2: string;
  admin3: string;
  interaction: string;
  timestamp: string;
}

interface ACLEDApiResponse {
  success: boolean;
  data: ACLEDRawRecord[];
  count: number;
}

// ── OAuth2 token shape ────────────────────────────────────────

export interface AcledTokens {
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;          // Unix ms — access token expiry
  refreshTokenExpiry: number;   // Unix ms — refresh token expiry
}

// ── Constants ─────────────────────────────────────────────────

const ACLED_API_BASE  = 'https://acleddata.com/api/acled/read';
const ACLED_TOKEN_URL = 'https://acleddata.com/oauth/token';

// 60s before expiry we proactively refresh the access token
const REFRESH_BUFFER_MS = 60_000;

// Fallback TTLs when the server doesn't return expires_in
const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 d

// First sync cap: default to 2 years ago to avoid pulling 500k+ records from 1997.
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

// ── Adapter ──────────────────────────────────────────────────

export class AcledAdapter extends BaseApiAdapter<ACLEDRawRecord, ConflictEvent> {
  name = 'acled';
  baseUrl = ACLED_API_BASE;
  rateLimitMs = 1000;

  private email: string;
  private password: string;
  private tokens: AcledTokens | null;

  private static readonly PAGE_LIMIT = 5000;

  /**
   * @param email    ACLED account email
   * @param password ACLED account password
   * @param tokens   Existing tokens from a previous run (optional)
   */
  constructor(email: string, password: string, tokens?: AcledTokens) {
    super();
    this.email = email;
    this.password = password;
    this.tokens = tokens ?? null;
  }

  /** Returns current tokens so the caller can persist them. */
  getTokens(): AcledTokens | null {
    return this.tokens;
  }

  // ── OAuth2 Auth ─────────────────────────────────────────────

  private async fetchNewTokens(): Promise<AcledTokens> {
    if (!this.email || !this.password) {
      throw new Error(
        'ACLED email and password are required. Configure them in Settings.\n' +
        'Register at acleddata.com to obtain credentials.',
      );
    }

    const body = new URLSearchParams({
      grant_type: 'password',
      username: this.email,
      password: this.password,
      client_id: 'acled',
    });

    const res = await fetch(ACLED_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(
        `ACLED OAuth2 token request failed: HTTP ${res.status}. ` +
        'Check your email and password in Settings (register at acleddata.com).',
      );
    }

    const json = await res.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!json.access_token) {
      throw new Error('ACLED token response missing access_token field');
    }

    const now = Date.now();
    const accessTtl = (json.expires_in ?? 86400) * 1000;

    const tokens: AcledTokens = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? '',
      tokenExpiry: now + accessTtl,
      refreshTokenExpiry: now + REFRESH_TOKEN_TTL_MS,
    };

    console.log('[AcledAdapter] OAuth2 tokens obtained');
    return tokens;
  }

  private async refreshAccessToken(refreshToken: string): Promise<AcledTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'acled',
    });

    const res = await fetch(ACLED_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`ACLED token refresh failed: HTTP ${res.status}`);
    }

    const json = await res.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    if (!json.access_token) {
      throw new Error('ACLED refresh response missing access_token');
    }

    const now = Date.now();
    const accessTtl = (json.expires_in ?? 86400) * 1000;

    const tokens: AcledTokens = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? refreshToken,
      tokenExpiry: now + accessTtl,
      // Extend refresh token TTL on each successful refresh
      refreshTokenExpiry: (this.tokens?.refreshTokenExpiry ?? now) + REFRESH_TOKEN_TTL_MS,
    };

    console.log('[AcledAdapter] OAuth2 access token refreshed');
    return tokens;
  }

  /**
   * Ensures a valid access token is available.
   * - If the access token expires within REFRESH_BUFFER_MS, refreshes it.
   * - If the refresh token is expired or missing, falls back to full password re-auth.
   */
  private async ensureValidTokens(): Promise<AcledTokens> {
    const now = Date.now();

    if (this.tokens) {
      // Access token still valid
      if (now < this.tokens.tokenExpiry - REFRESH_BUFFER_MS) {
        return this.tokens;
      }

      // Access token near expiry — try refresh if refresh token is still valid
      if (this.tokens.refreshToken && now < this.tokens.refreshTokenExpiry) {
        try {
          this.tokens = await this.refreshAccessToken(this.tokens.refreshToken);
          return this.tokens;
        } catch (err) {
          console.warn('[AcledAdapter] Token refresh failed, re-authenticating:', err);
        }
      }
    }

    // Fall back to full password grant
    this.tokens = await this.fetchNewTokens();
    return this.tokens;
  }

  // ── Data Fetching ──────────────────────────────────────────

  async fetchPage(
    params: Record<string, string>,
  ): Promise<FetchPageResult<ACLEDRawRecord>> {
    const tokens = await this.ensureValidTokens();
    const page = parseInt(params.page ?? '1', 10);

    const url = new URL(this.baseUrl);
    url.searchParams.set('limit', String(AcledAdapter.PAGE_LIMIT));
    url.searchParams.set('page', String(page));

    if (params.event_date) {
      url.searchParams.set('event_date', params.event_date);
      url.searchParams.set('event_date_where', '>');
    }
    if (params.iso3) {
      url.searchParams.set('iso3', params.iso3);
    }

    try {
      const res = await this.rateLimitedFetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });
      const json: ACLEDApiResponse = await res.json();

      if (!json.success) {
        throw new Error('ACLED API returned success=false');
      }

      const data = json.data ?? [];
      return {
        data,
        hasMore: data.length === AcledAdapter.PAGE_LIMIT,
        nextParams: { page: String(page + 1), ...this.carryParams(params) },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[AcledAdapter] Error fetching page ${page}: ${message}`);
    }
  }

  private carryParams(params: Record<string, string>): Record<string, string> {
    const carry: Record<string, string> = {};
    if (params.event_date) carry.event_date = params.event_date;
    if (params.iso3) carry.iso3 = params.iso3;
    return carry;
  }

  normalize(raw: ACLEDRawRecord): ConflictEvent {
    return {
      id: raw.event_id_cnty,
      iso3: raw.iso3,
      event_date: raw.event_date,
      event_type: raw.event_type,
      sub_event_type: raw.sub_event_type,
      actor1: raw.actor1,
      actor2: raw.actor2 || null,
      location: raw.location,
      latitude: Number.isFinite(parseFloat(raw.latitude)) ? parseFloat(raw.latitude) : 0,
      longitude: Number.isFinite(parseFloat(raw.longitude)) ? parseFloat(raw.longitude) : 0,
      fatalities: parseInt(raw.fatalities, 10) || 0,
      notes: raw.notes || null,
      source: raw.source,
      source_scale: raw.source_scale || null,
    };
  }

  /**
   * Fetch all conflict events, optionally filtered to events after sinceDate.
   *
   * First-sync cap: if no sinceDate is provided, defaults to 2 years ago to
   * avoid pulling 500k+ records from 1997 to present.
   *
   * Subsequent syncs should pass the last completed sync date as sinceDate
   * for incremental updates.
   */
  async fetchAllEvents(sinceDate?: string): Promise<ConflictEvent[]> {
    // Apply 2-year cap on first sync
    const effectiveSince = sinceDate ?? new Date(Date.now() - TWO_YEARS_MS)
      .toISOString()
      .slice(0, 10);

    const params: Record<string, string> = {
      page: '1',
      event_date: effectiveSince,
    };

    console.log(
      `[AcledAdapter] Starting event sync since ${effectiveSince}` +
      (sinceDate ? ' (incremental)' : ' (first sync — 2-year cap applied)'),
    );
    const results = await this.fetchAll(params);
    console.log(`[AcledAdapter] Fetched ${results.length} conflict events`);
    return results;
  }

  async fetchByCountry(iso3: string, sinceDate?: string): Promise<ConflictEvent[]> {
    const params: Record<string, string> = { page: '1', iso3 };
    if (sinceDate) params.event_date = sinceDate;

    console.log(`[AcledAdapter] Fetching events for ${iso3}...`);
    const results = await this.fetchAll(params);
    console.log(`[AcledAdapter] ${iso3}: ${results.length} events`);
    return results;
  }
}
