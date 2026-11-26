import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
const STORE_FILE = path.resolve(DATA_DIR, 'analytics.json');
const FIREBASE_CONFIG_FILE = path.resolve(PROJECT_ROOT, 'firebase-applet-config.json');

const MAX_UNIQUE_VISITORS = 10_000;
const MAX_RECENT_EVENTS = 200;
const MAX_DAILY_BUCKETS = 90;
const ACTIVE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes = active right now

export type AnalyticsEventType = 'visit' | 'heartbeat' | 'tab_view' | 'symbol_view';
export type DeviceCategory = 'desktop' | 'tablet' | 'mobile';

export interface TrackEventInput {
  visitorId: string;
  sessionId: string;
  eventType: AnalyticsEventType;
  tab?: string;
  symbol?: string;
  deviceType: DeviceCategory;
  deviceLabel: string;
  isSignedIn: boolean;
}

interface DailyBucket {
  date: string; // YYYY-MM-DD
  visits: number;
  interactions: number;
  uniqueVisitorHashes: string[];
}

interface ActivityRecord {
  id: string;
  visitorKey: string;
  eventType: AnalyticsEventType;
  target: string;
  deviceType: DeviceCategory;
  deviceLabel: string;
  isSignedIn: boolean;
  timestamp: number;
}

interface AnalyticsStoreData {
  version: 1;
  createdAt: number;
  updatedAt: number;
  totalVisits: number;
  totalInteractions: number;
  uniqueVisitorHashes: string[];
  seenSessionHashes: string[];
  deviceCounts: Record<DeviceCategory, number>;
  tabCounts: Record<string, number>;
  symbolCounts: Record<string, number>;
  daily: Record<string, DailyBucket>;
  recentActivity: ActivityRecord[];
}

export interface AnalyticsSummaryResponse {
  uniqueVisitors: number;
  activeNow: number;
  totalVisits: number;
  totalInteractions: number;
  signedInVisitorsToday: number;
  deviceBreakdown: Array<{ device: DeviceCategory; count: number; percent: number }>;
  topSymbols: Array<{ symbol: string; views: number }>;
  tabUsage: Array<{ tab: string; views: number }>;
  dailyTrend: Array<{
    date: string;
    label: string;
    uniqueVisitors: number;
    visits: number;
    interactions: number;
  }>;
  recentActivity: ActivityRecord[];
  trackingSince: number;
  updatedAt: number;
}

// Per-process HMAC salt for hashing visitor IDs (prevents raw client ID exposure)
const HASH_SALT = process.env.ANALYTICS_SALT || 'kestrel-visitor-salt-v1';

function hashIdentifier(raw: string): string {
  return crypto
    .createHmac('sha256', HASH_SALT)
    .update(raw)
    .digest('hex')
    .slice(0, 16);
}

function getDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function createEmptyStore(now = Date.now()): AnalyticsStoreData {
  return {
    version: 1,
    createdAt: now,
    updatedAt: now,
    totalVisits: 0,
    totalInteractions: 0,
    uniqueVisitorHashes: [],
    seenSessionHashes: [],
    deviceCounts: { desktop: 0, tablet: 0, mobile: 0 },
    tabCounts: {},
    symbolCounts: {},
    daily: {},
    recentActivity: [],
  };
}

// Live active visitors map (visitorHash -> { lastSeen, isSignedIn })
const liveVisitors = new Map<string, { lastSeen: number; isSignedIn: boolean }>();

// Simple per-IP sliding window rate limiter for public tracking endpoint
const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(clientKey: string, limitPerMinute = 90): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (rateLimitMap.get(clientKey) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= limitPerMinute) {
    rateLimitMap.set(clientKey, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(clientKey, timestamps);
  if (rateLimitMap.size > 2000) {
    // Periodic cleanup of stale keys
    for (const [k, list] of rateLimitMap.entries()) {
      if (list.every((t) => t <= windowStart)) {
        rateLimitMap.delete(k);
      }
    }
  }
  return true;
}

let storeData: AnalyticsStoreData = loadStoreFromDisk();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadStoreFromDisk(): AnalyticsStoreData {
  try {
    // Confinement check: STORE_FILE must reside strictly inside DATA_DIR
    if (!STORE_FILE.startsWith(DATA_DIR + path.sep)) {
      return createEmptyStore();
    }
    if (!fs.existsSync(STORE_FILE)) {
      return createEmptyStore();
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AnalyticsStoreData>;
    if (parsed && parsed.version === 1) {
      return {
        ...createEmptyStore(),
        ...parsed,
        deviceCounts: {
          desktop: parsed.deviceCounts?.desktop ?? 0,
          tablet: parsed.deviceCounts?.tablet ?? 0,
          mobile: parsed.deviceCounts?.mobile ?? 0,
        },
        tabCounts: parsed.tabCounts ?? {},
        symbolCounts: parsed.symbolCounts ?? {},
        daily: parsed.daily ?? {},
        uniqueVisitorHashes: Array.isArray(parsed.uniqueVisitorHashes)
          ? parsed.uniqueVisitorHashes
          : [],
        seenSessionHashes: Array.isArray(parsed.seenSessionHashes)
          ? parsed.seenSessionHashes
          : [],
        recentActivity: Array.isArray(parsed.recentActivity)
          ? parsed.recentActivity
          : [],
      };
    }
  } catch {
    // Start fresh if disk store is missing or unreadable
  }
  return createEmptyStore();
}

let activeFlush: Promise<void> = Promise.resolve();

async function flushStoreToDisk(): Promise<void> {
  if (!STORE_FILE.startsWith(DATA_DIR + path.sep)) return;
  activeFlush = activeFlush.then(async () => {
    try {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      const tmpFile = `${STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tmpFile, JSON.stringify(storeData), 'utf8');
      await fs.promises.rename(tmpFile, STORE_FILE);
    } catch (err) {
      console.error('Failed to persist analytics store:', err);
    }
  });
  await activeFlush;
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushStoreToDisk();
  }, 1500);
}

const VALID_EVENT_TYPES = new Set<AnalyticsEventType>([
  'visit',
  'heartbeat',
  'tab_view',
  'symbol_view',
]);
const VALID_DEVICES = new Set<DeviceCategory>(['desktop', 'tablet', 'mobile']);
const VALID_TABS = new Set(['overview', 'watchlists', 'portfolio', 'alerts', 'analytics']);

export function validateTrackInput(body: unknown): TrackEventInput | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;

  if (typeof obj.visitorId !== 'string' || !/^[a-zA-Z0-9_-]{6,80}$/.test(obj.visitorId)) {
    return null;
  }
  if (typeof obj.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{6,80}$/.test(obj.sessionId)) {
    return null;
  }
  if (
    typeof obj.eventType !== 'string' ||
    !VALID_EVENT_TYPES.has(obj.eventType as AnalyticsEventType)
  ) {
    return null;
  }
  const deviceType: DeviceCategory =
    typeof obj.deviceType === 'string' && VALID_DEVICES.has(obj.deviceType as DeviceCategory)
      ? (obj.deviceType as DeviceCategory)
      : 'desktop';

  const deviceLabel =
    typeof obj.deviceLabel === 'string'
      ? obj.deviceLabel.replace(/[^a-zA-Z0-9 .\-/()]/g, '').trim().slice(0, 60) || 'Web Browser'
      : 'Web Browser';

  const tab =
    typeof obj.tab === 'string' && VALID_TABS.has(obj.tab) ? obj.tab : undefined;

  const symbol =
    typeof obj.symbol === 'string' && /^[A-Z0-9.-]{1,12}$/.test(obj.symbol.toUpperCase())
      ? obj.symbol.toUpperCase()
      : undefined;

  return {
    visitorId: obj.visitorId,
    sessionId: obj.sessionId,
    eventType: obj.eventType as AnalyticsEventType,
    tab,
    symbol,
    deviceType,
    deviceLabel,
    isSignedIn: Boolean(obj.isSignedIn),
  };
}

export function recordAnalyticsEvent(input: TrackEventInput): void {
  const now = Date.now();
  const dateKey = getDateKey(now);
  const visitorHash = hashIdentifier(input.visitorId);
  const sessionHash = hashIdentifier(input.sessionId);

  liveVisitors.set(visitorHash, { lastSeen: now, isSignedIn: input.isSignedIn });

  // Track unique visitor
  if (!storeData.uniqueVisitorHashes.includes(visitorHash)) {
    storeData.uniqueVisitorHashes.push(visitorHash);
    if (storeData.uniqueVisitorHashes.length > MAX_UNIQUE_VISITORS) {
      storeData.uniqueVisitorHashes = storeData.uniqueVisitorHashes.slice(-MAX_UNIQUE_VISITORS);
    }
    storeData.deviceCounts[input.deviceType] =
      (storeData.deviceCounts[input.deviceType] ?? 0) + 1;
  }

  // Ensure daily bucket
  let bucket = storeData.daily[dateKey];
  if (!bucket) {
    bucket = {
      date: dateKey,
      visits: 0,
      interactions: 0,
      uniqueVisitorHashes: [],
    };
    storeData.daily[dateKey] = bucket;

    // Prune older daily buckets beyond 90 days
    const sortedKeys = Object.keys(storeData.daily).sort();
    while (sortedKeys.length > MAX_DAILY_BUCKETS) {
      const oldest = sortedKeys.shift();
      if (oldest) delete storeData.daily[oldest];
    }
  }

  if (!bucket.uniqueVisitorHashes.includes(visitorHash)) {
    bucket.uniqueVisitorHashes.push(visitorHash);
  }

  // Record distinct session visit
  if (input.eventType === 'visit') {
    if (!storeData.seenSessionHashes.includes(sessionHash)) {
      storeData.seenSessionHashes.push(sessionHash);
      if (storeData.seenSessionHashes.length > MAX_UNIQUE_VISITORS) {
        storeData.seenSessionHashes = storeData.seenSessionHashes.slice(-MAX_UNIQUE_VISITORS);
      }
      storeData.totalVisits += 1;
      bucket.visits += 1;
    }
  }

  // Record interactions (tab views & stock chart views)
  if (input.eventType === 'tab_view' && input.tab) {
    storeData.totalInteractions += 1;
    bucket.interactions += 1;
    storeData.tabCounts[input.tab] = (storeData.tabCounts[input.tab] ?? 0) + 1;
  } else if (input.eventType === 'symbol_view' && input.symbol) {
    storeData.totalInteractions += 1;
    bucket.interactions += 1;
    storeData.symbolCounts[input.symbol] = (storeData.symbolCounts[input.symbol] ?? 0) + 1;
  }

  // Add non-heartbeat events to recent activity feed
  if (input.eventType !== 'heartbeat') {
    const target =
      input.eventType === 'symbol_view'
        ? input.symbol || 'NVDA'
        : input.eventType === 'tab_view'
          ? input.tab || 'overview'
          : 'Site visit';

    storeData.recentActivity.unshift({
      id: `${now.toString(36)}_${visitorHash.slice(0, 6)}`,
      visitorKey: `V-${visitorHash.slice(0, 6).toUpperCase()}`,
      eventType: input.eventType,
      target,
      deviceType: input.deviceType,
      deviceLabel: input.deviceLabel,
      isSignedIn: input.isSignedIn,
      timestamp: now,
    });

    if (storeData.recentActivity.length > MAX_RECENT_EVENTS) {
      storeData.recentActivity = storeData.recentActivity.slice(0, MAX_RECENT_EVENTS);
    }
  }

  storeData.updatedAt = now;
  scheduleFlush();
}

export function getAnalyticsSummary(): AnalyticsSummaryResponse {
  const now = Date.now();
  const cutoff = now - ACTIVE_WINDOW_MS;

  let activeNow = 0;
  let signedInVisitorsToday = 0;
  for (const [k, info] of liveVisitors.entries()) {
    if (info.lastSeen >= cutoff) {
      activeNow += 1;
    }
    if (info.isSignedIn && info.lastSeen >= now - 24 * 60 * 60 * 1000) {
      signedInVisitorsToday += 1;
    }
    if (info.lastSeen < now - 24 * 60 * 60 * 1000) {
      liveVisitors.delete(k);
    }
  }

  const totalDevices =
    storeData.deviceCounts.desktop +
    storeData.deviceCounts.tablet +
    storeData.deviceCounts.mobile;

  const deviceBreakdown: Array<{ device: DeviceCategory; count: number; percent: number }> = (
    ['desktop', 'mobile', 'tablet'] as DeviceCategory[]
  ).map((device) => {
    const count = storeData.deviceCounts[device] ?? 0;
    return {
      device,
      count,
      percent: totalDevices > 0 ? Number(((count / totalDevices) * 100).toFixed(1)) : 0,
    };
  });

  const topSymbols = Object.entries(storeData.symbolCounts)
    .map(([symbol, views]) => ({ symbol, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  const tabUsage = Object.entries(storeData.tabCounts)
    .map(([tab, views]) => ({ tab, views }))
    .sort((a, b) => b.views - a.views);

  // Build continuous 14-day daily trend
  const dailyTrend: AnalyticsSummaryResponse['dailyTrend'] = [];
  for (let i = 13; i >= 0; i--) {
    const ms = now - i * 86_400_000;
    const key = getDateKey(ms);
    const b = storeData.daily[key];
    const label = new Date(ms).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    dailyTrend.push({
      date: key,
      label,
      uniqueVisitors: b ? b.uniqueVisitorHashes.length : 0,
      visits: b ? b.visits : 0,
      interactions: b ? b.interactions : 0,
    });
  }

  return {
    uniqueVisitors: storeData.uniqueVisitorHashes.length,
    activeNow,
    totalVisits: storeData.totalVisits,
    totalInteractions: storeData.totalInteractions,
    signedInVisitorsToday,
    deviceBreakdown,
    topSymbols,
    tabUsage,
    dailyTrend,
    recentActivity: storeData.recentActivity.slice(0, 40),
    trackingSince: storeData.createdAt,
    updatedAt: storeData.updatedAt,
  };
}

export async function resetAnalyticsStore(): Promise<void> {
  storeData = createEmptyStore(Date.now());
  liveVisitors.clear();
  await flushStoreToDisk();
}

// ---------------------------------------------------------------------------
// Firebase ID Token Cryptographic Verification (RS256 via Google Public Certs)
// Needs ZERO IAM permissions and works on every Firebase project tier.
// ---------------------------------------------------------------------------
let cachedProjectId: string | null = null;

function getFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;
  try {
    const raw = fs.readFileSync(FIREBASE_CONFIG_FILE, 'utf8');
    const cfg = JSON.parse(raw) as { projectId?: string };
    cachedProjectId = cfg.projectId || '';
  } catch {
    cachedProjectId = '';
  }
  return cachedProjectId;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && certCache.expiresAt > now) {
    return certCache.certs;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  const res = await fetch(GOOGLE_CERTS_URL, { signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) {
    throw new Error('Unable to fetch Firebase verification certificates');
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const certs = (await res.json()) as Record<string, string>;
  certCache = {
    certs,
    expiresAt: now + Math.max(300, maxAgeSec) * 1000,
  };
  return certs;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(json) as T;
}

export interface VerifiedAdminCaller {
  uid: string;
  email: string;
}

export async function verifyAdminBearerToken(
  authHeader: string | undefined
): Promise<{ ok: true; caller: VerifiedAdminCaller } | { ok: false; status: number; error: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, status: 401, error: 'Malformed authentication token' };
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  let header: { alg?: string; kid?: string };
  let payload: {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  try {
    header = decodeBase64UrlJson(headerSeg);
    payload = decodeBase64UrlJson(payloadSeg);
  } catch {
    return { ok: false, status: 401, error: 'Invalid authentication token payload' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { ok: false, status: 401, error: 'Unsupported token signing algorithm' };
  }

  const projectId = getFirebaseProjectId();
  if (!projectId) {
    return { ok: false, status: 500, error: 'Firebase project configuration unavailable' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    !payload.sub ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowSec ||
    typeof payload.iat !== 'number' ||
    payload.iat > nowSec + 300
  ) {
    return { ok: false, status: 401, error: 'Authentication token is expired or invalid' };
  }

  try {
    const certs = await getGooglePublicCerts();
    const certPem = Object.hasOwn(certs, header.kid) ? certs[header.kid] : undefined;
    if (!certPem) {
      return { ok: false, status: 401, error: 'Unknown token signing key' };
    }

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerSeg}.${payloadSeg}`);
    verifier.end();

    const sigBuffer = Buffer.from(sigSeg, 'base64url');
    const isValidSig = verifier.verify(certPem, sigBuffer);
    if (!isValidSig) {
      return { ok: false, status: 401, error: 'Invalid token signature' };
    }
  } catch {
    return { ok: false, status: 401, error: 'Token verification failed' };
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'successudeh@gmail.com').trim().toLowerCase();
  const callerEmail = (payload.email || '').trim().toLowerCase();

  if (payload.email_verified !== true || !callerEmail || callerEmail !== adminEmail) {
    return {
      ok: false,
      status: 403,
      error: 'Access restricted to the site administrator account',
    };
  }

  return {
    ok: true,
    caller: {
      uid: payload.sub,
      email: callerEmail,
    },
  };
}
