// ─── ACLED Conflict Events Adapter ────────────────────────────
// Fetches armed conflict event data from the ACLED REST API.
// Auth: Drupal session login → Cookie + X-CSRF-Token headers.
// (OAuth2 Bearer tokens are rejected by the data endpoint.)
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

// ── Session type ──────────────────────────────────────────────

export interface AcledSession {
  sessionCookie: string; // Drupal session cookie (sent as Cookie header)
  csrfToken: string;     // CSRF token (sent as X-CSRF-Token header)
  expiresAt: number;     // Unix timestamp ms
}

// ── Constants ─────────────────────────────────────────────────

const ACLED_API_BASE   = 'https://acleddata.com/api/acled/read';
const ACLED_LOGIN_URL  = 'https://acleddata.com/user/login?_format=json';
const SESSION_TTL_MS   = 20 * 60 * 60 * 1000; // 20 h (Drupal default session ~24 h)

// ── Adapter ──────────────────────────────────────────────────

export class AcledAdapter extends BaseApiAdapter<ACLEDRawRecord, ConflictEvent> {
  name = 'acled';
  baseUrl = ACLED_API_BASE;
  rateLimitMs = 1000;

  private email: string;
  private password: string;
  private session: AcledSession | null;

  private static readonly PAGE_LIMIT = 5000;

  /**
   * @param email    ACLED account email
   * @param password ACLED account password
   * @param session  Existing session from a previous run (optional)
   */
  constructor(email: string, password: string, session?: AcledSession) {
    super();
    this.email = email;
    this.password = password;
    this.session = session ?? null;
  }

  /** Returns current session so the caller can persist it. */
  getSession(): AcledSession | null {
    return this.session;
  }

  // ── Drupal Session Auth ─────────────────────────────────────

  private async login(): Promise<AcledSession> {
    const res = await fetch(ACLED_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: this.email, pass: this.password }),
    });

    if (!res.ok) {
      throw new Error(
        `ACLED login failed: HTTP ${res.status}. ` +
        'Check your email and password in Settings (register at acleddata.com).',
      );
    }

    const json = await res.json() as { csrf_token: string };
    const csrfToken = json.csrf_token;

    if (!csrfToken) {
      throw new Error('ACLED login response missing csrf_token field');
    }

    const sessionCookie = this.extractSessionCookie(res);
    console.log('[AcledAdapter] Login successful, session established');

    return {
      sessionCookie,
      csrfToken,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
  }

  /**
   * Extracts the Drupal session cookie (SESS... or SSESS...) from a Response.
   *
   * Node.js 18.14+ / undici exposes `headers.getSetCookie()` which returns an
   * array. Older environments return a single comma-joined string from
   * `headers.get('set-cookie')`.
   */
  private extractSessionCookie(res: Response): string {
    let cookies: string[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h = res.headers as any;
    if (typeof h.getSetCookie === 'function') {
      cookies = h.getSetCookie() as string[];
    } else {
      const raw = res.headers.get('set-cookie') ?? '';
      // Split on commas that precede a new cookie token (e.g. "Path=/,SESSID=...")
      cookies = raw.split(/,(?=\s*[A-Za-z])/);
    }

    const sessionCookie = cookies
      .map(c => c.split(';')[0].trim())
      .find(c => /^S?SESS[A-Za-z0-9]+=/.test(c));

    if (!sessionCookie) {
      throw new Error(
        'ACLED login response did not include a session cookie. ' +
        'The server may have returned an unexpected response.',
      );
    }

    return sessionCookie;
  }

  private async ensureValidSession(): Promise<AcledSession> {
    if (this.session && Date.now() < this.session.expiresAt) {
      return this.session;
    }
    // Session expired or not yet obtained — log in fresh
    this.session = await this.login();
    return this.session;
  }

  // ── Data Fetching ──────────────────────────────────────────

  /**
   * Fetch one page of conflict events using Drupal session auth.
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

    const session = await this.ensureValidSession();
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
          Cookie: session.sessionCookie,
          'X-CSRF-Token': session.csrfToken,
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

  async fetchAllEvents(sinceDate?: string): Promise<ConflictEvent[]> {
    const params: Record<string, string> = { page: '1' };
    if (sinceDate) params.event_date = sinceDate;

    console.log(
      `[AcledAdapter] Starting event sync${sinceDate ? ` since ${sinceDate}` : ' (full)'}...`,
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
