# STAGING SETUP LOG

**Date Started:** April 13, 2026
**Date Completed:** April 15, 2026
**Last Updated:** April 15, 2026
**Project:** Print App (`printer-app-531a8`)
**Approach:** Single Firebase Project with named Firestore database

---

## Decisions Made

### Staging Approach: Single Firebase Project
Chose to use the single Firebase project approach (named Firestore database + separate Storage bucket) over creating a separate Firebase project. Reasons:
- Simpler setup, one billing account
- Sufficient isolation for staging (test data separate from production)
- Auth being shared between staging and production is acceptable

### Independent Context Deployments: Separate Firebase Projects
When duplicating the app for different independent contexts (e.g., different schools or clients), each deployment will use:
- Its own separate GitHub repository
- Its own separate Firebase project
- Staging within each deployment can use the single-project approach above

### Admin List: Shared Between Staging and Production
Admins and superadmins are read from the `(default)` production Firestore database in both environments. This means:
- No need to seed admin users separately on staging
- Any admin approved on production can log in to staging immediately
- Content data (tutorials, printers, papers) remains isolated per environment

### FIREBASE_PRIVATE_KEY: Required on Deployed Staging ⚠️
Initially assumed `applicationDefault()` on Google Cloud would be sufficient. This was incorrect — `auth.createCustomToken()` in the login route requires the service account to sign tokens, which `applicationDefault()` cannot do without explicit credentials. The private key must be set via Cloud Secret Manager + `apphosting.yaml`.

**Console error observed:**
```
api/admin-login: Failed to load resource: the server responded with a status of 500
```
**Root cause:** `createCustomToken()` fails without `FIREBASE_PRIVATE_KEY` — `applicationDefault()` does not have token signing permissions on Firebase App Hosting.

### Workflow
```
Feature branch → staging branch → main (production)
```
- Push to `staging` → auto-deploys to staging URL
- Push to `main` → auto-deploys to production URL

---

## Progress

### Part 1 — Firebase Console

| Step | Task | Status |
|------|------|--------|
| 1 | Create staging Firestore database (ID: `staging`, same region as `(default)`) | ✅ Done |
| 2 | Create staging Storage bucket (`printer-app-531a8-staging`) | ✅ Done |
| 3a | Create App Hosting staging backend (`print-app-staging`) linked to `staging` branch | ✅ Done |
| 3b | Add environment variables to staging App Hosting backend | ✅ Done |
| 3c | `FIREBASE_PRIVATE_KEY` via Cloud Secret Manager + `apphosting.yaml` | ✅ Done |

### Part 2 — Code Changes

| Step | Task | Status |
|------|------|--------|
| 4 | Update `lib/firebase-admin.ts` — `FIREBASE_DATABASE_ID` for content db + `adminDb` for shared admin db | ✅ Done |
| 5 | Create `.env.staging.local` for local development against staging | ✅ Done |
| 6 | Add `dev:staging` npm script via `dotenv-cli` | ✅ Done |
| 7 | Update all admin routes to use `adminDb` | ✅ Done |

### Part 3 — Git

| Step | Task | Status |
|------|------|--------|
| 8 | Create and push `staging` branch to GitHub | ✅ Done |
| 9 | All changes deployed and build passing on staging | ✅ Done |

---

## Environment Variables on Staging App Hosting Backend

| Variable | Value | Notes |
|----------|-------|-------|
| `FIREBASE_PROJECT_ID` | `printer-app-531a8` | Same as production |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@printer-app-531a8.iam.gserviceaccount.com` | Same as production |
| `FIREBASE_PRIVATE_KEY` | Cloud Secret Manager → `FIREBASE_PRIVATE_KEY` | Added via Secret Manager, referenced in `apphosting.yaml` |
| `FIREBASE_STORAGE_BUCKET` | `printer-app-531a8-staging.firebasestorage.app` | Staging bucket |
| `FIREBASE_DATABASE_ID` | `staging` | Staging-specific |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyBfRCD35umbBjfnMLlPBRFbW60UDPpbrBw` | Same as production |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `printer-app-531a8.firebaseapp.com` | Same as production |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `printer-app-531a8` | Same as production |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `printer-app-531a8.firebasestorage.app` | Same as production |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `35180397485` | Same as production |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:35180397485:web:54229f53bec24a672a5724` | Same as production |

---

## Code Changes Summary

### `lib/firebase-admin.ts`
- `db` — reads `FIREBASE_DATABASE_ID` env var, falls back to `(default)`. Points to `staging` database on staging, `(default)` on production.
- `adminDb` — always reads from `(default)`. Shared between staging and production for admin/superadmin data.

### Admin routes updated to use `adminDb`
All `admins` and `adminRequests` collection reads/writes use `adminDb`:
- `app/api/verify-auth/route.ts`
- `app/api/admin-login/route.ts`
- `app/api/admin-register/route.ts`
- `app/api/admin-approve/route.ts`
- `app/api/admin-requests/route.ts`

### `package.json`
- Added `dotenv-cli` dev dependency
- Added `dev:staging` script: `dotenv -e .env.staging.local -- next dev`

---

## Data Isolation Summary

| Data | Staging | Production | Shared? |
|------|---------|------------|---------|
| Tutorials, Printers, Papers | `staging` Firestore DB | `(default)` Firestore DB | ❌ Isolated |
| Storage files | `printer-app-531a8-staging` bucket | `printer-app-531a8` bucket | ❌ Isolated |
| Admins & Superadmins | `(default)` Firestore DB | `(default)` Firestore DB | ✅ Shared |
| Firebase Auth | Shared | Shared | ✅ Shared |

---

## Running Locally Against Staging

```bash
npm run dev:staging
```

App runs at `http://localhost:3000` but reads/writes to the staging Firestore database and staging Storage bucket.

## Running Locally Against Production (unchanged)

```bash
npm run dev
```

---

## Build Errors Encountered & Resolved

| Build | Error | Fix |
|-------|-------|-----|
| #1 | `'expandedPrinterList' is assigned a value but never used` | Removed value from useState destructure: `const [, setExpandedPrinterList]` |
| #1 | `'err' is defined but never used` in `verify-auth` | Changed `catch (err)` to `catch` |
| #2 | Same ESLint errors — `_` prefix not ignored by ESLint config | Applied correct fixes above |
| #3 | `Cannot find name 'db'` in `admin-register` and `admin-requests` | Replaced multiline `db` references with `adminDb` |

## Runtime Issues Encountered

| Issue | Symptom | Root Cause | Fix |
|-------|---------|------------|-----|
| Login failing on deployed staging | `500` on `api/admin-login` | `createCustomToken()` requires token signing — `applicationDefault()` does not have this permission on Firebase App Hosting | Added `FIREBASE_PRIVATE_KEY` to Cloud Secret Manager, granted Secret Accessor role to App Hosting service account, referenced in `apphosting.yaml` ✅ |

---

## Changes Deployed to Staging (April 15, 2026 — Session 11)

All changes below were developed on a feature branch, merged to `staging`, and are live on the staging deployment. They are ready to be merged to `main` for production.

| Change | Files |
|--------|-------|
| Bug fix: Steps video URL not returned from Firestore (`videoUrl` omitted from step mappings in `getTutorialState`) | `lib/tutorial-store.ts` |
| Bug fix: Video not rendered in step cards in CMS admin view | `app/admin/page.tsx` |
| Feature: Success alert auto-closes after 3 seconds | `app/admin/page.tsx` |
| Feature: Action menu buttons — vertical ellipsis icon (`MoreVertIcon`), "Information" label, divider before Delete | `app/admin/page.tsx` |
| Feature: Information dialogs — consistent Name / Last Modified / Modified By across all types (Paper, Printer, Colour, Step) | `app/admin/page.tsx` |
| Feature: Modified By tracking — admin email stored server-side on create/edit for all item types (Paper, Printer, Colour, Step) | `lib/tutorial-store.ts`, `app/api/tutorial/route.ts`, `app/admin/page.tsx` |
| Feature: Embed in Canvas LMS dialog with configurable iframe code and copy button | `app/admin/page.tsx` |
