# Phase 2 Implementation Plans

> This document is a living reference for brainstorming and planning future features. Nothing here is finalised or committed to.

---

## Feature 1: Admin Login System

### Background & Current State (at Phase 2 start)

- The `/admin` route and `/api/tutorial` endpoint were completely open — no authentication or authorisation existed.
- Firebase Admin SDK was already installed and configured (`lib/firebase-admin.ts`).
- No client-side Firebase SDK was present (only the server-side Admin SDK).

---

### Decision: Login Method — E-number + Custom Token ✅

**Implemented approach (replaces original magic link plan):**
- Admin enters their RMIT staff e-number (e.g. `e1234567`) on the login page.
- Server looks up the e-number in the `admins` Firestore collection.
- On match: mints a Firebase custom token via Admin SDK, updates `lastLogin`, returns `{ customToken, role, email }`.
- Client signs in with `signInWithCustomToken()`, then calls `/api/verify-auth` to complete the session and set the `adminSession` cookie.
- Session expires after 8 hours (cookie `Max-Age=28800`; client-side interval also checks `adminLoginTime` in `localStorage`).

**Why this replaced magic link:**
- RMIT staff already have e-numbers — no extra credential to remember.
- No email delivery dependency; login is instant.

---

### Decision: Access Control — Firestore Allowlist + Firebase Custom Claims ✅

Two layers work together:

**Layer 1 — Firestore `admins` collection (source of truth)**

Each document is keyed by Firebase UID:
```
admins/{uid}
  email:        "jane@rmit.edu.au"
  name:         "Jane Smith"
  staffNumber:  "e1234567"
  role:         "admin" | "superadmin"
  active:       true
  addedAt:      Timestamp
  lastLogin:    Timestamp
```

- `staffNumber` must exist in this collection with `active: true` to gain access.
- Anyone not in the collection is rejected at the `/api/admin-login` step.

**Layer 2 — Firebase Custom Claims (fast runtime checks)**

- At sign-in, `/api/verify-auth` reads the Firestore record and stamps the user's token: `{ role: "admin" }` or `{ role: "superadmin" }`.
- `middleware.ts` checks the `adminSession` cookie on every `/admin` request — no extra Firestore read per page load.

**Initial admin seeding:** Admins added via `npm run seed-admins` (reads `scripts/admins.json`, writes to Firestore). New admins after go-live use the self-registration + approval flow (see Phase 2b).

---

### Decision: Self-Registration + Superadmin Approval Flow ✅

Rather than manually adding admins via Firebase Console, a request/approval workflow was built:

1. New staff click the **"Request"** tab on the login page.
2. They enter Full Name, Email, and E-number → POST to `/api/admin-register`.
3. A `adminRequests` document is created with `status: "pending"`.
4. A superadmin opens the **Superadmin Settings** cog modal in the CMS (role-gated).
5. The modal fetches pending requests from `/api/admin-requests` (requires superadmin Bearer token).
6. Superadmin clicks ✓ Approve or ✗ Reject per request.
7. Approve: `/api/admin-approve` gets or creates a Firebase Auth user, writes the `admins/{uid}` doc, marks the request as `approved`.
8. Reject: marks the request as `rejected`; no `admins` write.
9. Approved staff can now log in immediately with their e-number.

---

### Phase 2a — Implementation Steps ✅ COMPLETE

| # | Step | File(s) | Status |
|---|---|---|---|
| 1 | Enable Firebase Auth in Firebase Console | — | ✅ Done |
| 2 | Install Firebase client SDK | `package.json` | ✅ `npm install firebase` |
| 3 | Add Firebase client config vars to env | `.env.local` | ✅ `NEXT_PUBLIC_FIREBASE_*` vars added |
| 4 | Create `lib/firebase-client.ts` | New file | ✅ Singleton pattern; exports `initializeFirebaseClient()` and `getAuthInstance()` |
| 5 | Create Login page (two-tab: Login + Request) | `app/login/page.tsx` | ✅ E-number login + self-registration form |
| 6 | ~~Auth callback handler~~ | ~~`app/login/callback/`~~ | ✅ Not needed — deleted (was for magic link only) |
| 7 | Create verify API route | `app/api/verify-auth/route.ts` | ✅ Verifies Firebase ID token → checks `admins` allowlist → sets custom claim |
| 8 | Create login API route | `app/api/admin-login/route.ts` | ✅ Accepts e-number → mints custom token |
| 9 | Create register API route | `app/api/admin-register/route.ts` | ✅ Writes pending `adminRequests` doc |
| 10 | Create approve API route | `app/api/admin-approve/route.ts` | ✅ Approve/reject pending requests; writes `admins` doc on approve |
| 11 | Create requests API route | `app/api/admin-requests/route.ts` | ✅ Returns pending requests; requires superadmin Bearer token |
| 12 | Add AuthProvider to root layout | `app/auth-provider.tsx` + `app/providers.tsx` | ✅ Context exposing `user`, `role`, `loading`, `signOut()` |
| 13 | Protect `/admin` route | `middleware.ts` | ✅ Reads `adminSession` cookie; redirects to `/login` if absent |
| 14 | Protect `/api/tutorial` POST endpoint | `app/api/tutorial/route.ts` | ✅ Verifies Bearer token; rejects if not `admin` or `superadmin`; GET stays public |
| 15 | Add logout button to Admin panel | `app/admin/page.tsx` | ✅ `LogoutIcon` top-right; clears session + redirects |
| 16 | Pass auth token in all admin API calls | `app/admin/page.tsx` | ✅ `Authorization: Bearer <token>` on all fetches |
| 17 | 8-hour session timeout | `app/login/page.tsx`, `app/auth-provider.tsx` | ✅ Cookie `Max-Age=28800`; 60s interval checks `adminLoginTime` in localStorage |
| 18 | Admin seed script | `scripts/seed-admins.js`, `scripts/admins.json` | ✅ `npm run seed-admins`; reads json, writes `admins/{uid}` docs |

---

### Phase 2b — Superadmin Settings Panel

The existing single-purpose cogwheel modal has been redesigned as a **multi-tab settings panel** with three tabs.

| Tab | Scope | Status |
|---|---|---|
| Admins | Approval requests, admin list, access management | ✅ Fully implemented — see below |
| App Settings | Feature toggles controlling CMS visibility | ✅ Built — see below |
| Statistics | User-facing view analytics | 🔲 Placeholder built — GA4 wiring pending |

---

#### Admins Tab

**✅ Fully Implemented**

- **Superadmin Settings modal** — cog `IconButton` next to Sign Out; visible only when `role === "superadmin"`
- **Pending requests section** — shown only when there are pending requests (hidden when empty); Name, Email, E-number, Role columns; fetched from `/api/admin-requests` on modal open; Refresh button
- **Approve / Reject actions** — green tick / red X per row; reviewed requests removed from list immediately
- **Role selector during approval** — `Select` dropdown (Admin / Superadmin) per pending request row, defaulting to `"admin"`; passed to API on approve; `app/api/admin-approve/route.ts` accepts optional `role` field
- **Pending request badge on cog icon** — `Badge` (MUI, `variant="dot"`, `color="error"`) wrapping `SettingsIcon`; visible when `pendingRequests.length > 0`; `useEffect` fetches on page load so badge appears immediately without opening the modal

**Admin Users section (below Pending Requests):**
- **Full admin list** — table of all current admins (Name, Email, E-number, Role, Status, Last Login); reads from `/api/admin-list` (superadmin-only GET); sorted by name; inactive rows dimmed to 55% opacity
- **Add admin directly** — "Add Admin" button toggles an inline form (Name, Email, E-number, Role); POSTs to `/api/admin-manage` with `action: "addDirect"`; gets or creates Firebase Auth user; rejects if already in `admins` collection with `409`
- **Deactivate / reactivate** — toggle button per row; POSTs to `/api/admin-manage` with `action: "deactivate"` or `"reactivate"`; updates `active` field in Firestore immediately; own row is disabled with tooltip
- **Change role** — `Select` dropdown per row; changing it shows a Save icon button; POSTs to `/api/admin-manage` with `action: "changeRole"` and `newRole`; own row is disabled

**New API routes:**
- `app/api/admin-list/route.ts` — GET, superadmin-only
- `app/api/admin-manage/route.ts` — POST, superadmin-only; handles `addDirect`, `deactivate`, `reactivate`, `changeRole`

---

#### App Settings Tab

**✅ Built**

Superadmin-only toggles that control what admins can see and use in the CMS. All toggles are stored in `settings/appSettings` in Firestore and fetched on admin page load. User-facing view is unaffected by all of these. Settings displayed in a **2-column layout** (Printer Table | Sidebar).

| Toggle | What it controls | Where in the CMS |
|---|---|---|
| Copy Link | Show/hide the Copy Link icon button per printer | Printer table row |
| QR Code | Show/hide the QR Code icon button per printer | Printer table row |
| Canvas Embed | Show/hide the Canvas Embed icon button per printer | Printer table row |
| Printer List | Show/hide the Printer List section in the sidebar | Sidebar (both collapsed and expanded states) |
| Full Paper List | Show/hide the "Full Paper List" navigation button | Sidebar |
| Colour Management List | Show/hide the "Colour Management" navigation button | Sidebar |

**Implementation notes:**
- `settings/appSettings` Firestore document stores all six flags as booleans (default `true`)
- New API action `updateAppSettings` — requires superadmin Bearer token
- Admin page fetches app settings on load alongside tutorial state; flags stored in component state
- Each affected button/icon is conditionally rendered based on its flag
- No structural changes to existing features — purely additive conditional rendering

---

#### Statistics Tab

**🔲 Placeholder built — GA4 wiring pending**

- **Google Analytics (GA4) integration** — add GA4 tracking script to the user-facing view (`app/page.tsx` / `app/layout.tsx`) to capture page views, printer selections, paper and colour selections, and step views
- **Stats view in the superadmin panel** — a Statistics tab within the cogwheel modal surfacing key GA4 metrics (page views, most-visited printers, drop-off points); superadmin-only
- Scope: user-facing view only — the admin CMS (`/admin`) is intentionally excluded from analytics tracking

---

### Preview Token System ✅ IMPLEMENTED

**What it does:**
An admin-only feature allowing admins to preview unpublished content in the user-facing view before going live.

**Flow:**
1. Admin clicks the Preview button in the CMS.
2. `app/admin/page.tsx` POSTs to `/api/preview-token`.
3. Server calls `createPreviewToken()` — deletes all existing tokens (one valid at a time), generates a new random token (Firestore auto-ID), stores it in `previewTokens` collection with a **3-hour expiry**.
4. Admin's browser opens `/?previewToken=TOKEN&printerId=X&paperId=Y&colourId=Z` in a new tab.
5. User-facing page detects the token, fetches `/api/tutorial?previewToken=TOKEN`.
6. Tutorial GET handler validates the token — if valid, returns `isPreviewMode: true` with all data, **bypassing all `published` filters**.
7. A persistent amber banner is shown; preview navigation is not saved to `localStorage`.

**Files involved:**
- `app/api/preview-token/route.ts` — POST endpoint, calls `createPreviewToken()`
- `lib/tutorial-store.ts` — `createPreviewToken()`, `validatePreviewToken()`
- `app/api/tutorial/route.ts` — GET handler reads `?previewToken=` param
- `app/page.tsx` — reads token from URL, fetches with token, shows preview banner

**Security status:**
- ✅ `/api/preview-token` (POST) is protected — `Authorization: Bearer <token>` check added; rejects unauthenticated requests with `401`, non-admin roles with `403`.

---

### Open Questions

| Question | Decision |
|---|---|
| Login method | E-number + Firebase custom token (magic link approach was designed but replaced before going live) |
| Access control | Firestore `admins` allowlist + Firebase Custom Claims |
| Single or multiple admins | Multiple; `role` field distinguishes `admin` vs `superadmin` |
| New admin onboarding | Self-registration → superadmin approval via `adminRequests` collection |
| `/api/preview-token` protection | ✅ Protected — Bearer token check added; rejects unauthenticated requests with 401 |

---

*Last updated: 2026-04-17 (Session 14)*
