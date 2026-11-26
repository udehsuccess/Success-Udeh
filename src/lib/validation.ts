/**
 * Validation & sanitization constants synchronized verbatim with firebase-blueprint.json
 * and firestore.rules to enforce defensive payload constraints before every Firestore mutation.
 */

export const VALIDATION_LIMITS = {
  ID_MAX_LENGTH: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  SYMBOL_MAX_LENGTH: 12,
  SYMBOL_PATTERN: /^[A-Z0-9.-]+$/,
  DISPLAY_NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 254,
  PHOTO_URL_MAX_LENGTH: 500,
  WATCHLIST_NAME_MAX_LENGTH: 60,
  WATCHLIST_MAX_SYMBOLS: 50,
  WATCHLIST_MAX_SORT_ORDER: 1000,
  COMPANY_NAME_MAX_LENGTH: 120,
  HOLDING_MAX_SHARES: 1_000_000_000,
  HOLDING_MAX_AVG_COST: 10_000_000,
  HOLDING_NOTES_MAX_LENGTH: 300,
  ALERT_MAX_TARGET_PRICE: 10_000_000,
  ALERT_NOTE_MAX_LENGTH: 200,
  DEVICE_LABEL_MAX_LENGTH: 80,
} as const;

export function sanitizeSymbol(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().slice(0, VALIDATION_LIMITS.SYMBOL_MAX_LENGTH);
  if (!cleaned || !VALIDATION_LIMITS.SYMBOL_PATTERN.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function sanitizeString(raw: string, maxLength: number): string {
  return raw.trim().slice(0, maxLength);
}

export function sanitizeSymbolsArray(symbols: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of symbols) {
    const clean = sanitizeSymbol(s);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      result.push(clean);
      if (result.length >= VALIDATION_LIMITS.WATCHLIST_MAX_SYMBOLS) break;
    }
  }
  return result;
}

export function sanitizeDocId(raw: string): string {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, VALIDATION_LIMITS.ID_MAX_LENGTH);
  return cleaned || `doc_${Date.now()}`;
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return sanitizeDocId(`${prefix}_${stamp}_${rand}`);
}
