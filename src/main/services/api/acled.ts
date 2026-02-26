// ─── ACLED Conflict Events Adapter ────────────────────────────
// Fetches armed conflict event data from the ACLED REST API.
// Auth: OAuth 2.0 resource-owner password grant → Bearer token.
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

interface ACLEDTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;   // seconds
  token_type: string;
}

// ── Token type ────────────────────────────────────────────────

export interface AcledToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;              // Unix timestamp ms (access token)
  refreshTokenExpiresAt: number;  // Unix timestamp ms (refresh token, 14 days)
}

// ── Constants ─────────────────────────────────────────────────

const ACLED_API_BASE     = 'https://acleddata.com/api/acled/read';
const ACLED_TOKEN_URL    = 'https://acleddata.com/oauth/token';
const ACLED_CLIENT_ID    = 'acled';
const REFRESH_BUFFER_MS  = 60_000;                    // Refresh 1 min before expiry
const REFRESH_TOKEN_TTL  = 14 * 24 * 60 * 60 * 1000; // 14 days in ms

// ── Adapter ──────────────────────────────────────────────────

export class AcledAdapter extends BaseApiAdapter<ACLEDRawRecord, ConflictEvent> {
  name = 'acled';
  baseUrl = ACLED_API_BASE;
  rateLimitMs = 1000;

  private email: string;
  private password: string;
  private token: AcledToken | null;

  private static readonly PAGE_LIMIT = 5000;

  /**
   * @param email    ACLED account email
   * @param password ACLED account password
   * @param token    Existing OAuth token from a previous run (optional)
   */
  constructor(email: string, password: string, token?: AcledToken) {
    super();
    this.email = email;
    this.password = password;
    this.token = token ?? null;
  }

  /** Returns current token so the caller can persist it. */
  getToken(): AcledToken | null {
    return this.token;
  }

  // ── OAuth 2.0 Auth ─────────────────────────────────────────

  private async authenticate(): Promise<AcledToken> {
    const body = new URLSearchParams({
      grant_type: 'password',
      username: this.email,
      password: this.password,
      client_id: ACLED_CLIENT_ID,
    });

    const res = await fetch(ACLED_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(
        `ACLED authentication failed: HTTP ${res.status}. ` +
        'Check your email and password in Settings (register at acleddata.com).',
      );
    }

    const json = await res.json() as ACLEDTokenResponse;

    if (!json.access_token) {
      throw new Error('ACLED token response missing access_token');
    }

    const now = Date.now();
    const token: AcledToken = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: now + (json.expires_in * 1000),
      refreshTokenExpiresAt: now + REFRESH_TOKEN_TTL,
    };

    console.log('[AcledAdapter] OAuth2 authentication successful');
    this.token = token;
    return token;
  }

  private async refreshAccessToken(refreshToken: string): Promise<AcledToken> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: ACLED_CLIENT_ID,
    });

    const res = await fetch(ACLED_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(
        `ACLED token refresh failed: HTTP ${res.status}. ` +
        'Please re-enter your credentials in Settings.',
      );
    }

    const json = await res.json() as ACLEDTokenResponse;

    if (!json.access_token) {
      throw new Error('ACLED refresh response missing access_token');
    }

    const now = Date.now();
    const token: AcledToken = {
      accessToken: json.access_token,
      refreshToken: json.refresh_token || refreshToken,
      expiresAt: now + (json.expires_in * 1000),
      // Reset refresh TTL only if a new refresh token was issued
      refreshTokenExpiresAt: json.refresh_token
        ? now + REFRESH_TOKEN_TTL
        : (this.token?.refreshTokenExpiresAt ?? now + REFRESH_TOKEN_TTL),
    };

    console.log('[AcledAdapter] Access token refreshed successfully');
    this.token = token;
    return token;
  }

  private async ensureValidToken(): Promise<AcledToken> {
    const now = Date.now();

    if (this.token) {
      // Access token still valid
      if (now < this.token.expiresAt - REFRESH_BUFFER_MS) {
        return this.token;
      }

      // Access token expiring soon — use refresh token if still valid
      if (this.token.refreshToken && now < this.token.refreshTokenExpiresAt - REFRESH_BUFFER_MS) {
        return await this.refreshAccessToken(this.token.refreshToken);
      }
    }

    // No token or both tokens expired — re-authenticate with credentials
    return await this.authenticate();
  }

  // ── Data Fetching ──────────────────────────────────────────

  /**
   * Fetch one page of conflict events using OAuth2 Bearer auth.
   */
  async fetchPage(
    params: Record<string, string>,
  ): Promise<FetchPageResult<ACLEDRawRecord>> {
    if (!this.email || !this.password) {
      throw new Error(
        'ACLED email and password are required. Configure them in Settings.\n' +
        'Register at acleddata.com to obtain credentials.',
      );
    }

    const token = await this.ensureValidToken();
    const page = parseInt(params.page ?? '1', 10);

    const url = new URL(this.baseUrl);
    url.searchParams.set('_format', 'json');
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
          Authorization: `Bearer ${token.accessToken}`,
        },
      }, 60_000); // 60-second timeout — ACLED can be slow
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

  async fetchAllEvents(sinceDate?: string): Promise<ConflictEvent[]> {
    // If this is the first ever sync (no sinceDate), cap to the last 2 years.
    // Fetching all ACLED data since 1997 (500k+ events) would time out and exhaust
    // memory. Subsequent syncs are incremental from the last completed sync date.
    let effectiveSince = sinceDate;
    if (!effectiveSince) {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      effectiveSince = twoYearsAgo.toISOString().split('T')[0];
    }

    const params: Record<string, string> = { page: '1', event_date: effectiveSince };

    console.log(`[AcledAdapter] Starting event sync since ${effectiveSince}...`);
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
