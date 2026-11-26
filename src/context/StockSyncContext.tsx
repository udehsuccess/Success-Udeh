import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import { detectDeviceMetadata } from '../lib/formatters';
import { fetchQuotes } from '../lib/marketClient';
import {
  generateSafeId,
  sanitizeDocId,
  sanitizeString,
  sanitizeSymbol,
  sanitizeSymbolsArray,
  VALIDATION_LIMITS,
} from '../lib/validation';
import type {
  AlertCondition,
  DeviceSessionDoc,
  HoldingDoc,
  PriceAlertDoc,
  StockQuote,
  WatchlistDoc,
} from '../types/market';

const BENCHMARK_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM'];

const DEFAULT_LOCAL_WATCHLISTS: WatchlistDoc[] = [
  {
    id: 'local_core_tech',
    ownerId: 'local',
    name: 'Core Equities',
    symbols: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSLA'],
    sortOrder: 0,
  },
  {
    id: 'local_blue_chips',
    ownerId: 'local',
    name: 'Financials & Dividend',
    symbols: ['JPM', 'V', 'BRK.B', 'LLY', 'COST', 'WMT', 'XOM', 'KO'],
    sortOrder: 1,
  },
];

const DEFAULT_LOCAL_HOLDINGS: HoldingDoc[] = [
  {
    id: 'local_h1',
    ownerId: 'local',
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    shares: 45,
    avgCost: 118.4,
    notes: 'Core AI infrastructure position',
  },
  {
    id: 'local_h2',
    ownerId: 'local',
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    shares: 30,
    avgCost: 198.5,
    notes: 'Long-term compounder',
  },
  {
    id: 'local_h3',
    ownerId: 'local',
    symbol: 'MSFT',
    companyName: 'Microsoft Corporation',
    shares: 18,
    avgCost: 392.0,
    notes: 'Cloud & enterprise allocation',
  },
  {
    id: 'local_h4',
    ownerId: 'local',
    symbol: 'SPY',
    companyName: 'SPDR S&P 500 ETF Trust',
    shares: 25,
    avgCost: 542.2,
    notes: 'Core index benchmark',
  },
];

const DEFAULT_LOCAL_ALERTS: PriceAlertDoc[] = [
  {
    id: 'local_a1',
    ownerId: 'local',
    symbol: 'NVDA',
    condition: 'above',
    targetPrice: 150.0,
    status: 'active',
    note: 'Breakout watch level',
  },
  {
    id: 'local_a2',
    ownerId: 'local',
    symbol: 'AAPL',
    condition: 'below',
    targetPrice: 220.0,
    status: 'active',
    note: 'Add-on pullback entry',
  },
];

function getSessionDeviceId(): string {
  const key = 'kestrel_device_session_id';
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing && VALIDATION_LIMITS.ID_PATTERN.test(existing)) {
      return existing;
    }
    const created = generateSafeId('dev');
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return generateSafeId('dev');
  }
}

interface StockSyncContextValue {
  user: User | null;
  authReady: boolean;
  authError: string | null;
  syncStatus: 'local' | 'syncing' | 'synced';
  lastSyncedAt: number | null;
  currentSessionId: string;
  sessions: DeviceSessionDoc[];

  theme: 'light' | 'dark';
  toggleTheme: () => Promise<void>;

  selectedSymbol: string;
  selectSymbol: (symbol: string) => Promise<void>;

  watchlists: WatchlistDoc[];
  activeWatchlistId: string;
  activeWatchlist: WatchlistDoc | null;
  setActiveWatchlistId: (id: string) => Promise<void>;
  createWatchlist: (name: string, initialSymbols?: string[]) => Promise<string | null>;
  renameWatchlist: (watchlistId: string, name: string) => Promise<void>;
  deleteWatchlist: (watchlistId: string) => Promise<void>;
  addSymbolToWatchlist: (watchlistId: string, symbol: string) => Promise<void>;
  removeSymbolFromWatchlist: (watchlistId: string, symbol: string) => Promise<void>;

  holdings: HoldingDoc[];
  addHolding: (input: {
    symbol: string;
    companyName: string;
    shares: number;
    avgCost: number;
    notes: string;
  }) => Promise<void>;
  updateHolding: (
    holdingId: string,
    input: { shares: number; avgCost: number; notes: string }
  ) => Promise<void>;
  deleteHolding: (holdingId: string) => Promise<void>;

  alerts: PriceAlertDoc[];
  createAlert: (input: {
    symbol: string;
    condition: AlertCondition;
    targetPrice: number;
    note: string;
  }) => Promise<void>;
  updateAlertStatus: (
    alertId: string,
    status: 'active' | 'triggered' | 'dismissed'
  ) => Promise<void>;
  deleteAlert: (alertId: string) => Promise<void>;

  removeDeviceSession: (sessionId: string) => Promise<void>;

  quotes: Record<string, StockQuote>;
  quotesLoading: boolean;
  quotesError: string | null;
  lastQuotesUpdatedAt: number | null;
  refreshQuotesNow: () => Promise<void>;

  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const StockSyncContext = createContext<StockSyncContextValue | null>(null);

export function StockSyncProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced'>('local');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [currentSessionId] = useState<string>(() => getSessionDeviceId());

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('kestrel_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem('kestrel_selected_symbol');
      return (saved && sanitizeSymbol(saved)) || 'NVDA';
    } catch {
      return 'NVDA';
    }
  });

  const [watchlists, setWatchlists] = useState<WatchlistDoc[]>(() => {
    try {
      const raw = window.localStorage.getItem('kestrel_local_watchlists');
      if (raw) {
        const parsed = JSON.parse(raw) as WatchlistDoc[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_LOCAL_WATCHLISTS;
  });

  const [activeWatchlistId, setActiveWatchlistIdState] = useState<string>(
    () => watchlists[0]?.id || 'local_core_tech'
  );

  const [holdings, setHoldings] = useState<HoldingDoc[]>(() => {
    try {
      const raw = window.localStorage.getItem('kestrel_local_holdings');
      if (raw) {
        const parsed = JSON.parse(raw) as HoldingDoc[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_LOCAL_HOLDINGS;
  });

  const [alerts, setAlerts] = useState<PriceAlertDoc[]>(() => {
    try {
      const raw = window.localStorage.getItem('kestrel_local_alerts');
      if (raw) {
        const parsed = JSON.parse(raw) as PriceAlertDoc[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_LOCAL_ALERTS;
  });

  const [sessions, setSessions] = useState<DeviceSessionDoc[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState<boolean>(true);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [lastQuotesUpdatedAt, setLastQuotesUpdatedAt] = useState<number | null>(null);

  const userProfileReadyRef = useRef<boolean>(false);

  // Sync HTML dark class whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('kestrel_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Persist local guest state when signed out
  useEffect(() => {
    if (user) return;
    try {
      window.localStorage.setItem('kestrel_local_watchlists', JSON.stringify(watchlists));
      window.localStorage.setItem('kestrel_local_holdings', JSON.stringify(holdings));
      window.localStorage.setItem('kestrel_local_alerts', JSON.stringify(alerts));
      window.localStorage.setItem('kestrel_selected_symbol', selectedSymbol);
    } catch {
      // ignore
    }
  }, [user, watchlists, holdings, alerts, selectedSymbol]);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        userProfileReadyRef.current = false;
        setSyncStatus('local');
        setSessions([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initialize user document + attach real-time Firestore onSnapshot listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const uid = user.uid;
    const userDocRef = doc(db, 'users', uid);

    async function bootstrapAndSubscribe() {
      setSyncStatus('syncing');

      // 1. Ensure parent /users/{uid} doc exists before any subcollection writes (Master Gate)
      try {
        const snap = await getDoc(userDocRef);
        const safeDisplayName = sanitizeString(
          user!.displayName || user!.email?.split('@')[0] || 'Investor',
          VALIDATION_LIMITS.DISPLAY_NAME_MAX_LENGTH
        );
        const safeEmail = sanitizeString(
          user!.email || 'user@example.com',
          VALIDATION_LIMITS.EMAIL_MAX_LENGTH
        );
        const safePhoto = user!.photoURL
          ? sanitizeString(user!.photoURL, VALIDATION_LIMITS.PHOTO_URL_MAX_LENGTH)
          : undefined;

        if (!snap.exists()) {
          const defaultWlId = sanitizeDocId('wl_core_equities');
          const profilePayload: Record<string, unknown> = {
            uid,
            displayName: safeDisplayName,
            email: safeEmail,
            selectedSymbol: sanitizeSymbol(selectedSymbol) || 'NVDA',
            activeWatchlistId: defaultWlId,
            theme,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (safePhoto) {
            profilePayload.photoURL = safePhoto;
          }
          await setDoc(userDocRef, profilePayload);

          // Seed initial synced watchlists for new account
          const wl1Ref = doc(db, 'users', uid, 'watchlists', defaultWlId);
          await setDoc(wl1Ref, {
            ownerId: uid,
            name: 'Core Equities',
            symbols: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AVGO', 'TSLA'],
            sortOrder: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const wl2Ref = doc(db, 'users', uid, 'watchlists', sanitizeDocId('wl_market_leaders'));
          await setDoc(wl2Ref, {
            ownerId: uid,
            name: 'Financials & Dividend',
            symbols: ['JPM', 'V', 'BRK.B', 'LLY', 'COST', 'WMT', 'XOM', 'KO'],
            sortOrder: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Refresh identity fields cleanly if changed
          const data = snap.data();
          const updates: Record<string, unknown> = {
            displayName: safeDisplayName,
            email: safeEmail,
            updatedAt: serverTimestamp(),
          };
          if (safePhoto) {
            updates.photoURL = safePhoto;
          }
          if (data.displayName !== safeDisplayName || data.email !== safeEmail) {
            await updateDoc(userDocRef, updates);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }

      if (cancelled) return;
      userProfileReadyRef.current = true;

      // 2. Register active device session for real-time cross-device visibility
      const sessionPath = `users/${uid}/sessions/${currentSessionId}`;
      const sessionRef = doc(db, 'users', uid, 'sessions', currentSessionId);
      const deviceMeta = detectDeviceMetadata();

      try {
        const existingSession = await getDoc(sessionRef);
        if (!existingSession.exists()) {
          await setDoc(sessionRef, {
            ownerId: uid,
            deviceLabel: sanitizeString(
              deviceMeta.deviceLabel,
              VALIDATION_LIMITS.DEVICE_LABEL_MAX_LENGTH
            ),
            deviceType: deviceMeta.deviceType,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(sessionRef, {
            deviceLabel: sanitizeString(
              deviceMeta.deviceLabel,
              VALIDATION_LIMITS.DEVICE_LABEL_MAX_LENGTH
            ),
            deviceType: deviceMeta.deviceType,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, sessionPath);
      }

      heartbeatTimer = setInterval(async () => {
        if (!auth.currentUser) return;
        try {
          await updateDoc(sessionRef, { updatedAt: serverTimestamp() });
        } catch {
          // Non-fatal heartbeat miss
        }
      }, 45_000);

      if (cancelled) return;

      // 3. Real-time listener on User Profile (selectedSymbol, activeWatchlistId, theme)
      const unsubProfile = onSnapshot(
        userDocRef,
        (snapshot) => {
          if (!snapshot.exists()) return;
          const data = snapshot.data();
          if (typeof data.selectedSymbol === 'string') {
            const clean = sanitizeSymbol(data.selectedSymbol);
            if (clean) setSelectedSymbol(clean);
          }
          if (typeof data.activeWatchlistId === 'string' && data.activeWatchlistId) {
            setActiveWatchlistIdState(data.activeWatchlistId);
          }
          if (data.theme === 'light' || data.theme === 'dark') {
            setTheme(data.theme);
          }
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
        },
        (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${uid}`);
        }
      );
      unsubs.push(unsubProfile);

      // 4. Real-time listener on Watchlists
      const watchlistsPath = `users/${uid}/watchlists`;
      const wlQuery = query(
        collection(db, 'users', uid, 'watchlists'),
        where('ownerId', '==', uid)
      );
      const unsubWatchlists = onSnapshot(
        wlQuery,
        (snapshot) => {
          const items: WatchlistDoc[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || uid),
                name: String(data.name || 'Watchlist'),
                symbols: Array.isArray(data.symbols) ? data.symbols.map(String) : [],
                sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              };
            })
            .sort((a, b) => a.sortOrder - b.sortOrder);

          setWatchlists(items);
          setActiveWatchlistIdState((prev) => {
            if (items.some((w) => w.id === prev)) return prev;
            return items[0]?.id || '';
          });
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, watchlistsPath);
        }
      );
      unsubs.push(unsubWatchlists);

      // 5. Real-time listener on Holdings
      const holdingsPath = `users/${uid}/holdings`;
      const holdingsQuery = query(
        collection(db, 'users', uid, 'holdings'),
        where('ownerId', '==', uid)
      );
      const unsubHoldings = onSnapshot(
        holdingsQuery,
        (snapshot) => {
          const items: HoldingDoc[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ownerId: String(data.ownerId || uid),
                symbol: String(data.symbol || ''),
                companyName: String(data.companyName || data.symbol || ''),
                shares: Number(data.shares || 0),
                avgCost: Number(data.avgCost || 0),
                notes: String(data.notes || ''),
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              };
            })
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
          setHoldings(items);
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, holdingsPath);
        }
      );
      unsubs.push(unsubHoldings);

      // 6. Real-time listener on Price Alerts
      const alertsPath = `users/${uid}/alerts`;
      const alertsQuery = query(
        collection(db, 'users', uid, 'alerts'),
        where('ownerId', '==', uid)
      );
      const unsubAlerts = onSnapshot(
        alertsQuery,
        (snapshot) => {
          const items: PriceAlertDoc[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ownerId: String(data.ownerId || uid),
              symbol: String(data.symbol || ''),
              condition: data.condition === 'below' ? 'below' : 'above',
              targetPrice: Number(data.targetPrice || 0),
              status:
                data.status === 'triggered' || data.status === 'dismissed'
                  ? data.status
                  : 'active',
              note: String(data.note || ''),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });
          setAlerts(items);
          setSyncStatus('synced');
          setLastSyncedAt(Date.now());
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, alertsPath);
        }
      );
      unsubs.push(unsubAlerts);

      // 7. Real-time listener on Active Device Sessions
      const sessionsPath = `users/${uid}/sessions`;
      const sessionsQuery = query(
        collection(db, 'users', uid, 'sessions'),
        where('ownerId', '==', uid)
      );
      const unsubSessions = onSnapshot(
        sessionsQuery,
        (snapshot) => {
          const items: DeviceSessionDoc[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ownerId: String(data.ownerId || uid),
              deviceLabel: String(data.deviceLabel || 'Web Browser'),
              deviceType:
                data.deviceType === 'mobile' || data.deviceType === 'tablet'
                  ? data.deviceType
                  : 'desktop',
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });
          setSessions(items);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, sessionsPath);
        }
      );
      unsubs.push(unsubSessions);
    }

    void bootstrapAndSubscribe();

    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, user]);

  // Compute all unique symbols that require live quotes
  const trackedSymbols = useMemo(() => {
    const set = new Set<string>(BENCHMARK_SYMBOLS);
    if (selectedSymbol) set.add(selectedSymbol);
    for (const wl of watchlists) {
      for (const s of wl.symbols) set.add(s);
    }
    for (const h of holdings) set.add(h.symbol);
    for (const a of alerts) set.add(a.symbol);
    return Array.from(set).sort();
  }, [selectedSymbol, watchlists, holdings, alerts]);

  const trackedSymbolsKey = trackedSymbols.join(',');

  const refreshQuotesNow = useCallback(async () => {
    if (!trackedSymbolsKey) return;
    const list = trackedSymbolsKey.split(',');
    try {
      const fetched = await fetchQuotes(list);
      setQuotes((prev) => {
        const next = { ...prev };
        for (const q of fetched) {
          next[q.symbol] = q;
        }
        return next;
      });
      setQuotesError(null);
      setQuotesLoading(false);
      setLastQuotesUpdatedAt(Date.now());
    } catch (err) {
      setQuotesError(err instanceof Error ? err.message : 'Unable to refresh quotes');
      setQuotesLoading(false);
    }
  }, [trackedSymbolsKey]);

  // Poll live quotes every 5 seconds (paused when tab hidden)
  useEffect(() => {
    void refreshQuotesNow();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshQuotesNow();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshQuotesNow]);

  // Real-time evaluation of active price alerts against live quotes
  const triggeredInFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const alert of alerts) {
      if (alert.status !== 'active') continue;
      const quote = quotes[alert.symbol];
      if (!quote) continue;
      const hit =
        (alert.condition === 'above' && quote.price >= alert.targetPrice) ||
        (alert.condition === 'below' && quote.price <= alert.targetPrice);

      if (hit && !triggeredInFlightRef.current.has(alert.id)) {
        triggeredInFlightRef.current.add(alert.id);
        if (user && userProfileReadyRef.current) {
          const alertRef = doc(db, 'users', user.uid, 'alerts', alert.id);
          void updateDoc(alertRef, {
            status: 'triggered',
            updatedAt: serverTimestamp(),
          })
            .catch((err) => {
              handleFirestoreError(
                err,
                OperationType.UPDATE,
                `users/${user.uid}/alerts/${alert.id}`
              );
            })
            .finally(() => {
              triggeredInFlightRef.current.delete(alert.id);
            });
        } else {
          setAlerts((prev) =>
            prev.map((a) => (a.id === alert.id ? { ...a, status: 'triggered' } : a))
          );
          triggeredInFlightRef.current.delete(alert.id);
        }
      }
    }
  }, [alerts, quotes, user]);

  // Actions
  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in was cancelled.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'sessions', currentSessionId));
      } catch {
        // Ignore cleanup failure on sign-out
      }
    }
    await signOut(auth);
  }, [user, currentSessionId]);

  const toggleTheme = useCallback(async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (user && userProfileReadyRef.current) {
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          theme: nextTheme,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  }, [theme, user]);

  const selectSymbol = useCallback(
    async (rawSymbol: string) => {
      const clean = sanitizeSymbol(rawSymbol);
      if (!clean) return;
      setSelectedSymbol(clean);
      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}`;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            selectedSymbol: clean,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user]
  );

  const setActiveWatchlistId = useCallback(
    async (id: string) => {
      const cleanId = sanitizeDocId(id);
      setActiveWatchlistIdState(cleanId);
      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}`;
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            activeWatchlistId: cleanId,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
    },
    [user]
  );

  const createWatchlist = useCallback(
    async (name: string, initialSymbols: string[] = []): Promise<string | null> => {
      const cleanName = sanitizeString(name, VALIDATION_LIMITS.WATCHLIST_NAME_MAX_LENGTH);
      if (!cleanName) return null;
      const cleanSymbols = sanitizeSymbolsArray(initialSymbols);
      const id = generateSafeId('wl');
      const nextSortOrder = Math.min(
        watchlists.length,
        VALIDATION_LIMITS.WATCHLIST_MAX_SORT_ORDER
      );

      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/watchlists/${id}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'watchlists', id), {
            ownerId: user.uid,
            name: cleanName,
            symbols: cleanSymbols,
            sortOrder: nextSortOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setActiveWatchlistId(id);
          return id;
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      } else {
        const nextWl: WatchlistDoc = {
          id,
          ownerId: 'local',
          name: cleanName,
          symbols: cleanSymbols,
          sortOrder: nextSortOrder,
        };
        setWatchlists((prev) => [...prev, nextWl]);
        setActiveWatchlistIdState(id);
        return id;
      }
    },
    [user, watchlists.length, setActiveWatchlistId]
  );

  const renameWatchlist = useCallback(
    async (watchlistId: string, name: string) => {
      const cleanName = sanitizeString(name, VALIDATION_LIMITS.WATCHLIST_NAME_MAX_LENGTH);
      if (!cleanName) return;
      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/watchlists/${watchlistId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'watchlists', watchlistId), {
            name: cleanName,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setWatchlists((prev) =>
          prev.map((w) => (w.id === watchlistId ? { ...w, name: cleanName } : w))
        );
      }
    },
    [user]
  );

  const deleteWatchlist = useCallback(
    async (watchlistId: string) => {
      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/watchlists/${watchlistId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'watchlists', watchlistId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setWatchlists((prev) => {
          const remaining = prev.filter((w) => w.id !== watchlistId);
          if (activeWatchlistId === watchlistId) {
            setActiveWatchlistIdState(remaining[0]?.id || '');
          }
          return remaining;
        });
      }
    },
    [user, activeWatchlistId]
  );

  const addSymbolToWatchlist = useCallback(
    async (watchlistId: string, rawSymbol: string) => {
      const clean = sanitizeSymbol(rawSymbol);
      if (!clean) return;
      const target = watchlists.find((w) => w.id === watchlistId);
      if (!target) return;
      if (target.symbols.includes(clean)) return;
      const updated = sanitizeSymbolsArray([...target.symbols, clean]);

      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/watchlists/${watchlistId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'watchlists', watchlistId), {
            symbols: updated,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setWatchlists((prev) =>
          prev.map((w) => (w.id === watchlistId ? { ...w, symbols: updated } : w))
        );
      }
    },
    [user, watchlists]
  );

  const removeSymbolFromWatchlist = useCallback(
    async (watchlistId: string, rawSymbol: string) => {
      const clean = sanitizeSymbol(rawSymbol);
      if (!clean) return;
      const target = watchlists.find((w) => w.id === watchlistId);
      if (!target) return;
      const updated = target.symbols.filter((s) => s !== clean);

      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/watchlists/${watchlistId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'watchlists', watchlistId), {
            symbols: updated,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setWatchlists((prev) =>
          prev.map((w) => (w.id === watchlistId ? { ...w, symbols: updated } : w))
        );
      }
    },
    [user, watchlists]
  );

  const addHolding = useCallback(
    async (input: {
      symbol: string;
      companyName: string;
      shares: number;
      avgCost: number;
      notes: string;
    }) => {
      const cleanSymbol = sanitizeSymbol(input.symbol);
      if (!cleanSymbol) return;
      const shares = Math.min(
        Math.max(0.0001, Number(input.shares)),
        VALIDATION_LIMITS.HOLDING_MAX_SHARES
      );
      const avgCost = Math.min(
        Math.max(0, Number(input.avgCost)),
        VALIDATION_LIMITS.HOLDING_MAX_AVG_COST
      );
      const companyName =
        sanitizeString(input.companyName, VALIDATION_LIMITS.COMPANY_NAME_MAX_LENGTH) ||
        cleanSymbol;
      const notes = sanitizeString(input.notes, VALIDATION_LIMITS.HOLDING_NOTES_MAX_LENGTH);
      const id = generateSafeId('pos');

      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/holdings/${id}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'holdings', id), {
            ownerId: user.uid,
            symbol: cleanSymbol,
            companyName,
            shares,
            avgCost,
            notes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      } else {
        setHoldings((prev) => [
          ...prev,
          { id, ownerId: 'local', symbol: cleanSymbol, companyName, shares, avgCost, notes },
        ]);
      }
    },
    [user]
  );

  const updateHolding = useCallback(
    async (
      holdingId: string,
      input: { shares: number; avgCost: number; notes: string }
    ) => {
      const shares = Math.min(
        Math.max(0.0001, Number(input.shares)),
        VALIDATION_LIMITS.HOLDING_MAX_SHARES
      );
      const avgCost = Math.min(
        Math.max(0, Number(input.avgCost)),
        VALIDATION_LIMITS.HOLDING_MAX_AVG_COST
      );
      const notes = sanitizeString(input.notes, VALIDATION_LIMITS.HOLDING_NOTES_MAX_LENGTH);

      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/holdings/${holdingId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'holdings', holdingId), {
            shares,
            avgCost,
            notes,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setHoldings((prev) =>
          prev.map((h) => (h.id === holdingId ? { ...h, shares, avgCost, notes } : h))
        );
      }
    },
    [user]
  );

  const deleteHolding = useCallback(
    async (holdingId: string) => {
      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/holdings/${holdingId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'holdings', holdingId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setHoldings((prev) => prev.filter((h) => h.id !== holdingId));
      }
    },
    [user]
  );

  const createAlert = useCallback(
    async (input: {
      symbol: string;
      condition: AlertCondition;
      targetPrice: number;
      note: string;
    }) => {
      const cleanSymbol = sanitizeSymbol(input.symbol);
      if (!cleanSymbol) return;
      const targetPrice = Math.min(
        Math.max(0.01, Number(input.targetPrice)),
        VALIDATION_LIMITS.ALERT_MAX_TARGET_PRICE
      );
      const note = sanitizeString(input.note, VALIDATION_LIMITS.ALERT_NOTE_MAX_LENGTH);
      const id = generateSafeId('alrt');

      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/alerts/${id}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'alerts', id), {
            ownerId: user.uid,
            symbol: cleanSymbol,
            condition: input.condition === 'below' ? 'below' : 'above',
            targetPrice,
            status: 'active',
            note,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      } else {
        setAlerts((prev) => [
          {
            id,
            ownerId: 'local',
            symbol: cleanSymbol,
            condition: input.condition,
            targetPrice,
            status: 'active',
            note,
          },
          ...prev,
        ]);
      }
    },
    [user]
  );

  const updateAlertStatus = useCallback(
    async (alertId: string, status: 'active' | 'triggered' | 'dismissed') => {
      const existingAlert = alerts.find((a) => a.id === alertId);
      if (!existingAlert || existingAlert.status === 'dismissed') return;

      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/alerts/${alertId}`;
        try {
          await updateDoc(doc(db, 'users', user.uid, 'alerts', alertId), {
            status,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, status } : a))
        );
      }
    },
    [user, alerts]
  );

  const deleteAlert = useCallback(
    async (alertId: string) => {
      if (user && userProfileReadyRef.current) {
        const path = `users/${user.uid}/alerts/${alertId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'alerts', alertId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      } else {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    },
    [user]
  );

  const removeDeviceSession = useCallback(
    async (sessionId: string) => {
      if (!user || !userProfileReadyRef.current) return;
      const path = `users/${user.uid}/sessions/${sessionId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'sessions', sessionId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const activeWatchlist = useMemo(
    () => watchlists.find((w) => w.id === activeWatchlistId) || watchlists[0] || null,
    [watchlists, activeWatchlistId]
  );

  const value: StockSyncContextValue = {
    user,
    authReady,
    authError,
    syncStatus,
    lastSyncedAt,
    currentSessionId,
    sessions,
    theme,
    toggleTheme,
    selectedSymbol,
    selectSymbol,
    watchlists,
    activeWatchlistId: activeWatchlist?.id || '',
    activeWatchlist,
    setActiveWatchlistId,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addSymbolToWatchlist,
    removeSymbolFromWatchlist,
    holdings,
    addHolding,
    updateHolding,
    deleteHolding,
    alerts,
    createAlert,
    updateAlertStatus,
    deleteAlert,
    removeDeviceSession,
    quotes,
    quotesLoading,
    quotesError,
    lastQuotesUpdatedAt,
    refreshQuotesNow,
    signInWithGoogle,
    signOutUser,
  };

  return (
    <StockSyncContext.Provider value={value}>
      {children}
    </StockSyncContext.Provider>
  );
}

export function useStockSync(): StockSyncContextValue {
  const ctx = useContext(StockSyncContext);
  if (!ctx) {
    throw new Error('useStockSync must be used within StockSyncProvider');
  }
  return ctx;
}
