import { auth } from '../firebase';
import { detectDeviceMetadata } from './formatters';
import type { AnalyticsSummary, WorkspaceTab } from '../types/market';

const VISITOR_STORAGE_KEY = 'kestrel_visitor_id';
const SESSION_STORAGE_KEY = 'kestrel_visit_session_id';

function randomToken(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 11);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${rand}`;
}

export function getClientVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{6,80}$/.test(existing)) {
      return existing;
    }
    const created = randomToken('vis');
    window.localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return randomToken('vis');
  }
}

export function getClientVisitSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{6,80}$/.test(existing)) {
      return existing;
    }
    const created = randomToken('ses');
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return randomToken('ses');
  }
}

export async function trackSiteEvent(params: {
  eventType: 'visit' | 'heartbeat' | 'tab_view' | 'symbol_view';
  tab?: WorkspaceTab;
  symbol?: string;
  isSignedIn: boolean;
}): Promise<void> {
  try {
    const device = detectDeviceMetadata();
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitorId: getClientVisitorId(),
        sessionId: getClientVisitSessionId(),
        eventType: params.eventType,
        tab: params.tab,
        symbol: params.symbol,
        deviceType: device.deviceType,
        deviceLabel: device.deviceLabel,
        isSignedIn: params.isSignedIn,
      }),
      keepalive: true,
    });
  } catch {
    // Non-blocking background telemetry
  }
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Sign in with your administrator Google account to view site analytics.');
  }

  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/analytics/summary', {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || 'Access restricted to the site administrator account.');
  }

  if (!res.ok) {
    throw new Error(`Unable to load analytics (${res.status})`);
  }

  return (await res.json()) as AnalyticsSummary;
}

export async function resetSiteAnalytics(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Administrator sign-in required.');
  }

  const idToken = await currentUser.getIdToken();
  const res = await fetch('/api/analytics/reset', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Unable to reset analytics (${res.status})`);
  }
}
