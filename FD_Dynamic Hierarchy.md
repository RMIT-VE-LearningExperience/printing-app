# FD_Dynamic Hierarchy

> **Purpose:** Foundational reference for building a new app similar to the current Print App but with a configurable, dynamic hierarchy. This document should be self-contained — a developer starting a new project can use this as the primary planning reference.

> **Origin:** Derived from the Print App (Phase 2 planning discussions, April 2026). The Print App uses a fixed 4-level hierarchy (Printer → Paper → Colour → Step) that is hardcoded throughout its data layer, CMS, and user-facing view. Adding dynamic hierarchy to the Print App was ruled out as it would require a foundational rebuild. This document captures the full design so it can be implemented correctly from scratch.

---

## Reference App: Print App Overview

The Print App is a **step-by-step tutorial guide** for RMIT print room staff and students. It walks users through selecting the right settings for a print job — choosing a printer, then a paper type, then a colour profile — before presenting a set of illustrated instructional steps.

### What it does
- **User-facing view** (`/`) — A guided selection flow. The user picks a printer from a list, then picks a compatible paper, then picks a colour profile. They are then shown a scrollable sequence of step cards (title, body text, image or video) for that specific combination.
- **Admin CMS** (`/admin`) — A content management interface where admins add, edit, delete, reorder, and publish/unpublish printers, papers, colours, and steps. Access is protected by Firebase Auth with an e-number login.
- **Superadmin Settings** — A cogwheel modal (superadmin-only) for managing admin access (approvals, roles, deactivation) and app configuration.

### Fixed hierarchy
```
Printer → Paper → Colour → Step
```
- **Printer** — represents a physical printer (e.g. Epson EcoTank). Has a name, description, thumbnail, slug, and published status.
- **Paper** — a paper type (e.g. Matte, Glossy). Global definition; can be linked to multiple printers. Each printer–paper link has its own published status.
- **Colour** — a colour profile (e.g. sRGB, Adobe RGB). Global definition; can be linked to multiple papers within a printer context. Each link has its own published status.
- **Step** — an instructional step attached to a specific colour (within a specific printer + paper context). Has a title, rich-text body, and either an image or a video URL.

### Key CMS features
- **Two-tier storage** — items are defined globally (metadata: name, description, thumbnail) and linked per-printer with a separate published status. The same paper can appear under multiple printers with independent visibility.
- **Search existing items** — when adding a paper to a printer, admins search the global paper list rather than recreating it. Same pattern for colours.
- **Full list views** — sidebar buttons open a global view of all papers or all colours across all printers (not scoped to a specific printer).
- **Per-item action menus** — each row has a `⋯` menu with Edit, Information (name, last modified, modified by), and Delete (with a divider before Delete).
- **Deleted items bin** — soft delete with restore and permanent delete options.
- **Publish/unpublish toggles** — green/red toggle per item; unpublished items are hidden from the user-facing view but preserved in Firestore.
- **Reorder steps** — drag-and-drop reordering within a colour's step list.
- **Preview mode** — generates a short-lived token allowing admins to view unpublished content in the user-facing view before going live.
- **Printer tools** — per-printer icon buttons for Copy Link (direct URL), QR Code (downloadable PNG), and Canvas LMS Embed (iframe code generator).
- **Editable section headings** — the title and subtitle of each section (Printers, Papers, Colours) in the user-facing view are editable by admins from the CMS sidebar.
- **Modified By tracking** — all writes record the admin's email server-side; visible in the Information dialog per item.

### Tech stack
- **Framework:** Next.js (App Router) — TypeScript
- **Database:** Firestore (Firebase)
- **Auth:** Firebase Authentication + custom tokens + Firestore `admins` allowlist
- **Storage:** Firebase Storage (images; currently base64 inline, migration planned)
- **Hosting:** Firebase App Hosting (separate staging and production backends)
- **UI:** Material UI (MUI) v5

---

## Reference Documents from the Print App

### STYLE_GUIDE.md
The Print App's style guide is directly reusable as a design foundation for the new app. It covers:
- **Colour palette** — primary teal (`#3D8078`), neutral scale, semantic colours (success, error, warning), publish toggle colours
- **Typography** — full MUI type scale (h1–caption), font weights, responsive sizing via `responsiveFontSizes()`
- **Spacing & shape** — border radius conventions, dialog padding patterns, stack spacing
- **Elevation & shadows** — card, dialog, and footer shadow values
- **Component patterns** — buttons (primary, secondary, danger, in-sidebar), dialogs (title/content/actions structure), tables (header, body, action icon order), cards (user-facing), form fields, code/URL display blocks
- **Iconography** — full icon list with MUI component names and usage context
- **Sidebar** — colours, nav item states (default, hover, active), dividers
- **Footer** — user-facing vs. admin variants
- **Status indicators** — publish toggle styling, alert behaviour, auto-close timings

A developer building the new app should use this as the default design system and consciously diverge from it only where the new app's context requires it.

### STAGING_SETUP_LOG.md
The full log is Print App specific (Firebase project names, bucket names, exact setup steps). However, three architectural decisions in it apply to any new deployment using the same stack:

1. **Staging approach** — use a single Firebase project with a **named Firestore database** (e.g. `staging`) for test data isolation, rather than creating a separate Firebase project. Simpler billing, sufficient isolation, and Auth can be shared between environments.

2. **Independent deployments** — when the app is deployed for a different context (different school, organisation, or client), each deployment should have its own separate GitHub repository and its own separate Firebase project. Staging within each deployment can use the single-project approach above.

3. **`FIREBASE_PRIVATE_KEY` on Firebase App Hosting** — `createCustomToken()` (used in the e-number login route) requires the Firebase service account private key explicitly. `applicationDefault()` credentials on Firebase App Hosting do **not** have token-signing permissions and will cause a 500 error on login. The private key must be set via Cloud Secret Manager and referenced in `apphosting.yaml`. This applies to any new app using the same custom token auth pattern.

---

## Definitions

**Hierarchy Level (Branch)**
A navigational tier in the user-facing flow. The user selects one item at each level before proceeding to the next. The number of levels, their names, and which are active are all configurable by a superadmin.

*Example in the Print App context:* Printer → Paper → Colour → Step (3 configurable intermediate levels + 1 fixed final level)

**Intermediate Level**
Any configurable level between the entry point (Level 1) and the fixed final level (Steps). Intermediate levels can be added, removed, or renamed by a superadmin — but only before content is added (locked after initial setup).

**Steps (Final Level)**
The terminal level of every hierarchy. Always present, always last. Cannot be removed or renamed. Steps contain the actual instructional content: title, body text, image or video.

**Item**
A single entry within a level (e.g. a specific printer, a specific paper type). Items have a name, description, thumbnail, published status, and order.

**Relationship**
A link between an item at one level and an item at the next level, with its own published status. This is what makes the hierarchy many-to-many: one Paper can belong to multiple Printers; one Colour can belong to multiple Papers.

---

## Hierarchy Configuration

### Rules
- **Level 1** is always the entry point (e.g. "Printers"). Cannot be removed.
- **Steps** is always the final level. Cannot be removed or renamed.
- **Intermediate levels** between Level 1 and Steps are fully configurable: add, remove, rename.
- A minimum of **zero** intermediate levels is allowed — the flow can be as flat as Level 1 → Steps.
- There is no enforced maximum, but 2–3 intermediate levels is recommended for usability.
- **Level names are configurable** by superadmins only (e.g. "Printers" → "Machines", "Papers" → "Materials").
- Both singular and plural forms of a level name should be configurable (used in headings, breadcrumbs, and buttons).

### Lock after initial setup
- Hierarchy configuration is locked once any content (items) has been added to the app.
- If a superadmin attempts to change the hierarchy after content exists, a **warning dialog** is shown explaining that existing content may be hidden or orphaned.
- Data is always **hidden, never deleted** when a level is turned off. Re-enabling a level restores all previously hidden data.

---

## Firestore Data Model

### Hierarchy configuration
```
settings/hierarchy
  lockedAt:   Timestamp | null   // null = not yet locked; set when first item is added
  levels: [
    {
      id:           "level_1",
      name:         "Printers",       // plural display name
      singularName: "Printer",        // singular display name
      enabled:      true,
      order:        1
    },
    {
      id:           "level_2",
      name:         "Papers",
      singularName: "Paper",
      enabled:      true,
      order:        2
    },
    {
      id:           "level_3",
      name:         "Colours",
      singularName: "Colour",
      enabled:      true,
      order:        3
    }
    // Add or remove objects here for more/fewer intermediate levels
  ]
  // Steps is implicit — always the final level, not stored here
```

### App settings (feature toggles)
```
settings/appSettings
  features:
    copyLink:          true | false   // admins can copy a direct link per Level 1 item
    qrCode:            true | false   // admins can generate and download a QR code per Level 1 item
    canvasEmbed:       true | false   // admins can generate Canvas LMS embed code per Level 1 item
    fullItemListView:  true | false   // admins can access the global full list view per level (sidebar)
    // Note: fullItemListView applies to all intermediate levels generically.
    // In the Print App equivalent, this controls both Full Paper List and Full Colour List separately.
    // In the dynamic app, a single toggle covers all levels, or an array can be used per level:
    // fullItemListViewPerLevel: { "level_1": true, "level_2": false, ... }
```

### Global item definitions (one collection per level)
```
items/{levelId}/{itemId}
  name:              string
  description:       string
  thumbnailUrl:      string      // Firebase Storage URL (not base64)
  slug:              string      // URL-safe identifier, auto-generated from name
  published:         boolean     // global published status
  createdAt:         Timestamp
  lastModified:      Timestamp
  modifiedBy:        string      // admin email
```

### Relationships between levels (with per-relationship published status)
```
relationships/{parentLevelId}/{parentItemId}/children/{childItemId}
  childLevelId:  string
  published:     boolean    // controls visibility within this specific parent context
  order:         number
```

### Steps (always attached to the last intermediate level's items)
```
steps/{lastLevelItemId}/{stepId}
  title:          string
  contentHtml:    string
  imageUrl:       string      // Firebase Storage URL
  videoUrl:       string      // YouTube, Vimeo, or direct file URL
  order:          number
  createdAt:      Timestamp
  lastModified:   Timestamp
  modifiedBy:     string
```

### Admin access
```
admins/{uid}
  email:        string
  name:         string
  staffNumber:  string      // or equivalent org identifier
  role:         "admin" | "superadmin"
  active:       boolean
  addedAt:      Timestamp
  lastLogin:    Timestamp

adminRequests/{requestId}
  name:         string
  email:        string
  staffNumber:  string
  status:       "pending" | "approved" | "rejected"
  requestedAt:  Timestamp
  reviewedAt:   Timestamp | null
  reviewedBy:   string | null   // superadmin uid
```

---

## Superadmin View

### First-time setup flow
1. On first launch, superadmin is prompted to configure hierarchy levels before any content is added.
2. Superadmin sets the number of intermediate levels, their names (plural + singular), and which are enabled.
3. Superadmin configures feature toggles (copy link, QR, canvas embed).
4. Once saved, a confirmation dialog warns that the structure will be locked when content is first added.
5. Superadmin can return to adjust the configuration until the first item is created.

### Superadmin Settings panel (cogwheel modal — multi-tab)

**Admins tab**
- Pending access requests table — Name, Email, Staff Number; Approve (with role selector: Admin / Superadmin) / Reject actions
- Pending request badge (red dot) on the cog icon when requests exist
- Full admin list — Name, Email, Staff Number, Role, Status (active/inactive), Last Login
- Add admin directly — bypasses the request flow; superadmin enters name, email, staff number, role
- Deactivate / reactivate admin — toggles `active` field
- Change role — updates `role` in Firestore + refreshes custom claim

**App Settings tab**
- Hierarchy configuration — level names (plural + singular), enabled/disabled per level; locked with warning once content exists
- Feature toggles — all affect the admin CMS only; user-facing view is unaffected in all cases:
  - **Copy Link** — show/hide the copy link button per Level 1 item
  - **QR Code** — show/hide the QR code download button per Level 1 item
  - **Canvas Embed** — show/hide the Canvas LMS embed code button per Level 1 item
  - **Full Item List View** — show/hide the global list view navigation per level in the sidebar (can be configured globally or per level)

**Statistics tab**
- GA4 metrics surfaced within the panel: page views, most-visited Level 1 items, drop-off points by level, step completion rates
- Superadmin-only; admin CMS excluded from tracking

---

## Admin View

- Admins see the CMS structured according to the configured hierarchy — sections are rendered dynamically based on active levels and their configured names.
- If a level is disabled by a superadmin, that section disappears from the CMS entirely (data is preserved in Firestore but not shown).
- Feature buttons (Copy Link, QR, Canvas Embed) in the Level 1 item table are shown or hidden based on the App Settings toggles. Admins cannot change these settings themselves.
- All content operations (add, edit, delete, publish/unpublish, reorder) work generically across any configured level.
- **Search existing items** — when linking a child item to a parent (e.g. linking a Paper to a Printer), admins can search globally defined items at that level rather than creating duplicates. This mirrors the "Add paper → search existing paper" feature in the Print App and should be available at every intermediate level.
- **Full item list view** — each level has a global list view showing all items at that level across all parents. Mirrors the "Full Paper List" feature in the Print App.
- The final level (Steps) always appears at the end of the hierarchy and uses the same add/edit/reorder/delete interface regardless of what levels precede it.

---

## User-Facing View

- The user navigates through each active level in sequence, selecting one item per level.
- If a level is disabled, that selection step is skipped entirely — the flow moves directly from the previous level to the next.
- Only items with `published: true` (both global status and relationship status) are shown.
- The URL reflects the current Level 1 item selection via a slug parameter (e.g. `/?printer=epson-ecotank`). Deep linking to a specific Level 1 item is supported.
- A "Printer not found" (or equivalent) screen is shown when a slug doesn't match any published Level 1 item.
- Steps are always the final destination — rendered as a vertically scrollable list of cards with sticky step counter.
- Preview mode (via a short-lived token) allows admins to view unpublished content in the user-facing view before publishing.

---

## Differences from the Current Print App

| Area | Current Print App | Dynamic Hierarchy App |
|---|---|---|
| Hierarchy | Fixed: Printer → Paper → Colour → Step | Configurable: N intermediate levels + Step |
| Level names | Hardcoded ("Printers", "Papers", "Colours") | Configurable per level (plural + singular) |
| CMS sections | Hardcoded sections per level | Dynamically rendered based on active levels |
| Navigation state | 3 fixed state variables | Dynamic array, one entry per active level |
| Store functions | Level-specific (`addPrinter`, `addPaper`, etc.) | Generic (`addItem(levelId, data)`) |
| API actions | ~20 level-specific action types | Generic action types with `levelId` parameter |
| Firestore structure | Hardcoded nested subcollections | Dynamic item collections + relationship model |
| Type definitions | `Printer`, `Paper`, `Colour` types | Generic `Item` type with level reference |

### What would be rebuilt
- `lib/tutorial-store.ts` — complete rewrite; all CRUD and fetch functions become generic
- `app/api/tutorial/route.ts` — all action types become generic
- `app/admin/page.tsx` — navigation state, section rendering, breadcrumbs, and all CRUD handlers become dynamic
- `app/page.tsx` — user navigation flow becomes a generic level traversal loop
- Firestore data model — new structure (see above); not backwards compatible with the Print App's existing data

### What carries over conceptually
- Two-tier storage pattern: global item definitions + relationship-level published status
- Firebase Auth + e-number login + custom token + Firestore allowlist access control
- Preview token system (short-lived token for viewing unpublished content)
- Session management (8-hour expiry, cookie + localStorage)
- Superadmin Settings panel with Admins / App Settings / Statistics tabs
- Pending request badge on cog icon
- Modified By tracking (admin email stored server-side on all writes)
- Client-side sorting to avoid Firestore composite index requirements
- Firebase Storage for images (base64 → Storage URL pattern)

---

## Future Enhancements (post-core)

- **Configurable display layout per level** — superadmin chooses how items are presented in the user-facing view (e.g. card grid, list, carousel) on a per-level basis
- **Items per row / maximum items** — superadmin controls how many items are shown per row or sets a display cap per level
- **Branching (non-linear) paths** — the current design is a linear hierarchy (every user follows the same sequence of levels). A true branching scenario would allow conditional paths: "if the user selected X at Level 1, show only Y and Z options at Level 2". This is a significant further architectural step beyond dynamic linear hierarchy and should be treated as a separate foundational design if ever pursued.

---

*Created: 2026-04-16 — based on Print App Phase 2 planning discussions*
