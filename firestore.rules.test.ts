/**
 * Security Rules Verification Spec for Kestrel Firestore Rules.
 * Encodes the "Dirty Dozen" adversarial payloads and expected PERMISSION_DENIED outcomes.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  actorUid: string | null;
  emailVerified: boolean;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Watchlist Create',
    actorUid: 'bob',
    emailVerified: true,
    operation: 'create',
    path: 'users/alice/watchlists/wl1',
    payload: { ownerId: 'alice', name: 'Spoofed', symbols: ['AAPL'], sortOrder: 0 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedOwner(userId) && data.ownerId == request.auth.uid',
  },
  {
    id: 2,
    name: 'Cross-User PII Read',
    actorUid: 'bob',
    emailVerified: true,
    operation: 'get',
    path: 'users/alice',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isOwner(userId)',
  },
  {
    id: 3,
    name: 'User Enumeration List',
    actorUid: 'alice',
    emailVerified: true,
    operation: 'list',
    path: 'users',
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if false',
  },
  {
    id: 4,
    name: 'Unverified Email Write',
    actorUid: 'alice',
    emailVerified: false,
    operation: 'create',
    path: 'users/alice',
    payload: { uid: 'alice', displayName: 'Alice', email: 'alice@example.com', selectedSymbol: 'AAPL', theme: 'light' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isVerifiedUser() requiring request.auth.token.email_verified == true',
  },
  {
    id: 5,
    name: 'Shadow Field Injection',
    actorUid: 'alice',
    emailVerified: true,
    operation: 'create',
    path: 'users/alice',
    payload: { uid: 'alice', displayName: 'Alice', email: 'alice@example.com', selectedSymbol: 'AAPL', theme: 'light', isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isValidUser() data.keys().hasOnly([...])',
  },
  {
    id: 6,
    name: 'Orphaned Subcollection Write',
    actorUid: 'ghost',
    emailVerified: true,
    operation: 'create',
    path: 'users/ghost/holdings/h1',
    payload: { ownerId: 'ghost', symbol: 'NVDA', companyName: 'NVIDIA', shares: 10, avgCost: 120, notes: '' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'Master Gate userExists(userId)',
  },
  {
    id: 7,
    name: 'Path Variable ID Poisoning',
    actorUid: 'alice',
    emailVerified: true,
    operation: 'create',
    path: 'users/alice/watchlists/bad$id!space',
    payload: { ownerId: 'alice', name: 'Tech', symbols: ['AAPL'], sortOrder: 0 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(watchlistId)',
  },
  {
    id: 8,
    name: 'Client Timestamp Forgery',
    actorUid: 'alice',
    emailVerified: true,
    operation: 'create',
    path: 'users/alice/holdings/h1',
    payload: { ownerId: 'alice', symbol: 'AAPL', companyName: 'Apple Inc.', shares: 5, avgCost: 180, notes: '', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 9,
    name: 'Immutable Field Tampering on Update',
    actorUid: 'alice',
    emailVerified: true,
    operation: 'update',
    path: 'users/alice/holdings/h1',
    payload: { ownerId: 'bob', shares: 20 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().ownerId == existing().ownerId && affectedKeys().hasOnly([...])',
  },
  {
    id: 10,
    name: 'Value Poisoning on Allowed Update Key',
    actorUid: 'alice',
    emailVerified: true,
    operation: 'update',
    path: 'users/alice/holdings/h1',
    payload: { shares: -999 },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isValidHolding(incoming(), userId) enforcing data.shares > 0',
  },
  {
    id: 11,
    name: 'Watchlist Array Exhaustion (51 symbols)',
    actorUid: 'alice',
    emailVerified: true,
    operation: 'update',
    path: 'users/alice/watchlists/wl1',
    payload: { symbols: Array.from({ length: 51 }, (_, i) => `SYM${i}`) },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: 'isValidWatchlist() enforcing data.symbols.size() <= 50',
  },
  {
    id: 12,
    name: 'Terminal State Bypass on Dismissed Alert',
    actorUid: 'alice',
    emailVerified: true,
    operation: 'update',
    path: 'users/alice/alerts/a1',
    payload: { status: 'active' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedBy: "existing().status != 'dismissed'",
  },
];
