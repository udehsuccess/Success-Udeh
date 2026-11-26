import { Laptop, LogOut, Smartphone, Tablet, Trash2, X } from 'lucide-react';
import { useStockSync } from '../context/StockSyncContext';
import { formatRelativeTime } from '../lib/formatters';

interface DevicesModalProps {
  open: boolean;
  onClose: () => void;
}

function getTimestampMs(val: unknown): number {
  if (val && typeof val === 'object' && 'toMillis' in val && typeof (val as { toMillis: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export function DevicesModal({ open, onClose }: DevicesModalProps) {
  const {
    user,
    syncStatus,
    lastSyncedAt,
    sessions,
    currentSessionId,
    removeDeviceSession,
    signInWithGoogle,
    signOutUser,
  } = useStockSync();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cross-device real-time sync settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-slate-100">
            Real-Time Cloud Sync
          </h2>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {!user ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                You are currently browsing in local mode. Sign in with Google to sync your watchlists, portfolio holdings, price alerts, and active symbol across all your phones, tablets, and desktops in real time.
              </p>
              <button
                type="button"
                onClick={() => {
                  void signInWithGoogle();
                  onClose();
                }}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-lg transition-colors"
              >
                Sign in with Google to Sync
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Account avatar'}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-700 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {user.displayName || 'Signed in'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void signOutUser();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Synced Devices ({sessions.length})
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {syncStatus === 'synced' && lastSyncedAt
                      ? `Synced ${formatRelativeTime(lastSyncedAt)}`
                      : 'Connecting...'}
                  </span>
                </div>

                <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  {sessions.map((sess) => {
                    const isCurrent = sess.id === currentSessionId;
                    const Icon =
                      sess.deviceType === 'mobile'
                        ? Smartphone
                        : sess.deviceType === 'tablet'
                          ? Tablet
                          : Laptop;

                    return (
                      <li
                        key={sess.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                              {sess.deviceLabel}
                              {isCurrent ? ' (This device)' : ''}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Active {formatRelativeTime(getTimestampMs(sess.updatedAt))}
                            </div>
                          </div>
                        </div>

                        {!isCurrent && (
                          <button
                            type="button"
                            aria-label={`Remove ${sess.deviceLabel}`}
                            onClick={() => void removeDeviceSession(sess.id)}
                            className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Open Stockbeats on another browser or mobile device with the same Google account to watch watchlists, positions, alerts, and active ticker selections update instantaneously.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
