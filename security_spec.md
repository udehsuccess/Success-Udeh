# Kestrel Firestore Security Specification

## 1. Data Invariants

1. **Strict Owner Isolation (PII & Financial Privacy)**: A user document (`/users/{userId}`) and all nested subcollections (`watchlists`, `holdings`, `alerts`, `sessions`) are strictly readable and writable only by the authenticated owner whose `request.auth.uid == userId`. No blanket reads or cross-user `list` queries are permitted.
2. **Verified Email Requirement**: Every write (`create`, `update`, `delete`) requires `request.auth.token.email_verified == true`.
3. **Master Gate Parent Existence**: Every subcollection document (`watchlists`, `holdings`, `alerts`, `sessions`) cannot be created, read (`get`), updated, or deleted unless the parent `/users/{userId}` document exists.
4. **Immutable Ownership & Timestamps**: `uid`, `ownerId`, and `createdAt` can never be mutated after document creation. `createdAt` on create and `updatedAt` on create/update must strictly equal `request.time`.
5. **Bounded Volumetric Integrity**: All string fields enforce explicit `size()` bounds and regex patterns matching `firebase-blueprint.json`. `watchlists.symbols` is strictly bounded to `<= 50` entries with first-element type/pattern checks. Document IDs are hardened via `isValidId()`.
6. **Terminal State Locking**: Once a `PriceAlert` reaches `status == 'dismissed'`, no further updates are permitted (terminal state lock).
7. **Action-Based Updates**: Every `allow update` validates the full incoming document via `isValid[Entity]()` and restricts mutated keys with explicit `affectedKeys().hasOnly([...])` action branches.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Adversarial Payload / Action | Expected Result |
|---|---|---|---|---|
| 1 | **Identity Spoofing** | `/users/alice/watchlists/wl1` | Signed in as `bob`, attempt `create` with `ownerId: "alice"` | `PERMISSION_DENIED` |
| 2 | **Cross-User PII Read** | `/users/alice` | Signed in as `bob`, attempt `get` on `/users/alice` | `PERMISSION_DENIED` |
| 3 | **User Enumeration List** | `/users` | Signed in as `alice`, attempt `list` on `/users` | `PERMISSION_DENIED` |
| 4 | **Unverified Email Write** | `/users/alice` | Signed in as `alice` with `email_verified: false`, attempt `create` | `PERMISSION_DENIED` |
| 5 | **Shadow Field Injection** | `/users/alice` | Valid profile fields plus ghost field `isAdmin: true` | `PERMISSION_DENIED` |
| 6 | **Orphaned Subcollection Write** | `/users/ghost/holdings/h1` | Parent `/users/ghost` does not exist; attempt `create` holding | `PERMISSION_DENIED` |
| 7 | **ID Poisoning** | `/users/alice/watchlists/bad$id!space` | Attempt `create` with invalid path variable ID | `PERMISSION_DENIED` |
| 8 | **Timestamp Forgery** | `/users/alice/holdings/h1` | Attempt `create` with client backdated `createdAt` (`!= request.time`) | `PERMISSION_DENIED` |
| 9 | **Immutable Field Tamper** | `/users/alice/holdings/h1` | Attempt `update` modifying `ownerId` or `createdAt` | `PERMISSION_DENIED` |
| 10 | **Value Poisoning on Update** | `/users/alice/holdings/h1` | Update allowed key `shares` to `-50` or `"100"` (wrong type/range) | `PERMISSION_DENIED` |
| 11 | **Array Exhaustion (Denial of Wallet)** | `/users/alice/watchlists/wl1` | Attempt `update` with `symbols` array containing 51 tickers | `PERMISSION_DENIED` |
| 12 | **Terminal State Bypass** | `/users/alice/alerts/a1` | Existing alert has `status: "dismissed"`; attempt `update` back to `"active"` | `PERMISSION_DENIED` |
