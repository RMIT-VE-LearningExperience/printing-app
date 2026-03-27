# Phase 2 Implementation Plans

> This document is a living reference for brainstorming and planning future features. Nothing here is finalised or committed to.

---

## Feature 1: Admin Login System

### Background & Current State

- The `/admin` route and `/api/tutorial` endpoint are completely open — no authentication or authorisation exists.
- Firebase Admin SDK is already installed and configured (`lib/firebase-admin.ts`).
- No client-side Firebase SDK is currently present (only the server-side Admin SDK).

---

### Decision: Login Method — Option B (Magic Link) ✅

**Firebase Email Link (passwordless magic link)**
- Admin enters email → Firebase sends a clickable sign-in link → clicking it logs them in.
- Built into Firebase Authentication (Email Link provider) — no extra email service or infrastructure needed.
- No passwords to manage.

---

### Decision: Access Control — Firestore Allowlist + Firebase Custom Claims ✅

Two layers work together:

**Layer 1 — Firestore `admins` collection (source of truth)**

Each document represents an approved user:
```
admins/{uid}
  email:     "jane@example.com"
  role:      "admin" | "superadmin"
  active:    true
  addedBy:   "superadmin-uid"
  addedAt:   Timestamp
  lastLogin: Timestamp
```

- Email must be in this collection with `active: true` to gain access.
- Anyone not in the collection is rejected immediately after sign-in (signed out, shown "Access not authorised").
- Super Admin management UI (Phase 2b) reads/writes this collection.

**Layer 2 — Firebase Custom Claims (fast runtime checks)**

- At sign-in, server reads the Firestore record and stamps the user's token: `{ role: "admin" }` or `{ role: "superadmin" }`.
- Next.js middleware checks this claim on every request — no extra Firestore read per page load.
- Revoking access: set `active: false` in Firestore + revoke claim via Admin SDK → effective within ~1 hour (token refresh cycle).

**For now (Phase 2a):** Admin emails added manually to Firestore via Firebase Console. Super Admin management UI built later in Phase 2b.

---

### Implementation Steps — Phase 2a (Login)

| # | Step | File(s) Affected | Notes |
|---|---|---|---|
| 1 | Enable Firebase Auth + Email Link provider in Console | — | Admin-only Firebase Console setup |
| 2 | Install Firebase client SDK | `package.json` | `npm install firebase` |
| 3 | Add Firebase client config vars to env | `.env.local` | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` |
| 4 | Create `lib/firebase-client.ts` | New file | Firebase client SDK initialisation (singleton pattern) |
| 5 | Create Login page | New file: `app/login/page.tsx` | Single email input → sends magic link via `sendSignInLinkToEmail()`; email saved to `localStorage` for the callback |
| 6 | Create Auth callback handler | New file: `app/login/callback/page.tsx` | Detects magic link on load (`isSignInWithEmailLink`), completes sign-in, calls Step 7 |
| 7 | Create verify API route | New file: `app/api/verify-auth/route.ts` | Receives Firebase ID token → checks `admins` Firestore allowlist → sets/updates custom claim → returns role |
| 8 | Add AuthProvider to root layout | `app/providers.tsx` (new) + `app/layout.tsx` | React context exposing `user`, `role`, `loading`, `signOut()` |
| 9 | Protect `/admin` route | New file: `middleware.ts` | Reads session cookie; redirects unauthenticated users to `/login` |
| 10 | Protect `/api/tutorial` endpoint | `app/api/tutorial/route.ts` | Verify Firebase ID token on all requests; reject if not `admin` or `superadmin` |
| 11 | Add logout button to Admin panel | `app/admin/page.tsx` | Calls `signOut()`, clears session, redirects to `/login` |
| 12 | Pass auth token in all admin API calls | `app/admin/page.tsx` | Attach `Authorization: Bearer <token>` header to every fetch |

---

### Phase 2b — Super Admin: Admin Access Management (Future)

Deferred until after Phase 2a login is working. Will include:

- Super Admin UI panel within `/admin` (role-gated, only visible to `superadmin`)
- Table of all admins: email, role, status, last login
- Add admin: enter email + select role → creates Firestore `admins` doc + triggers invite magic link
- Deactivate / reactivate admin: toggles `active` field + revokes/restores custom claim
- Change role: updates `role` in Firestore + updates custom claim

No rework of Phase 2a needed — the Super Admin UI is purely additive.

---

### Open Questions (resolved)

| Question | Decision |
|---|---|
| Login method | Option B — Firebase Magic Link |
| Email service | None needed — Firebase handles it natively |
| Access control | Firestore `admins` allowlist + Firebase Custom Claims |
| Single or multiple admins | Multiple; role field distinguishes `admin` vs `superadmin` |
| Admin management UI | Phase 2b — deferred |
| `/api/preview-token` protection | TBD — likely public (serves user-facing preview, not CMS data) |

---

*Last updated: 2026-03-27*
