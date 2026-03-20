# Print App CMS - Progress Log

**Last Updated:** March 19, 2026 (Session 4)
**Project:** Print App CMS System
**User:** Arielle Lee (arielle.lee@rmit.edu.au)

---

## Session Summary

This document tracks all bugs fixed, features implemented, and architectural decisions made during the Print App CMS development.

---

## Critical Issues Fixed

### 1. ❌ → ✅ All Papers/Colours Disappearing from CMS Table
**Date Fixed:** Earlier session
**Severity:** CRITICAL
**Issue:** Deleting a single colour caused ALL papers and colours to disappear from the CMS table across all printers, even though the data was still in Firestore.

**Root Cause:**
- `orderBy("order")` queries on colour subcollections were failing silently
- Firestore composite indexes weren't set up for these queries
- When the query failed, the entire response was empty, causing the UI to show no data

**Solution:**
- Removed all `orderBy()` queries from `getTutorialState()` function in `lib/tutorial-store.ts`
- Implemented client-side sorting using `.sort((a, b) => a.order - b.order)` for all collections
- This eliminates the need for composite indexes while maintaining correct ordering

**Files Modified:**
- `lib/tutorial-store.ts` - lines 157-313 (getTutorialState function)

**Status:** ✅ FIXED - All papers and colours display correctly

---

### 2. ❌ → ✅ Papers Not Displaying in CMS Table
**Date Fixed:** Earlier session
**Severity:** HIGH
**Issue:** After fixing the query issue, papers still weren't displaying in the CMS admin table.

**Root Cause:**
- Type mismatch: CMS admin expected `PrinterPaper[]` with `paperId` field
- Backend was returning `Paper[]` with `id` field
- Lookup logic used `pp.paperId === paperId` but was comparing against `pp.id`

**Solution:**
1. Updated `Printer` type definition to use `papers: PrinterPaperWithPublished[]`
2. Changed lookup in `getPapersInPrinter()` from `pp.paperId` to `pp.id`
3. Simplified table rendering to work directly with `Paper[]` objects

**Files Modified:**
- `app/admin/page.tsx` - lines 392-427 (paper lookup and display logic)
- `lib/tutorial-store.ts` - type definitions

**Status:** ✅ FIXED - Papers now display correctly in all tables

---

### 3. ❌ → ✅ Colours Not Displaying in Colour Management Table
**Date Fixed:** Earlier session
**Severity:** HIGH
**Issue:** After papers were fixed, colours still weren't showing in the Colour Management table.

**Root Cause:**
- Table was trying to reference old `ppColour` data structure that no longer existed
- Code was using `ppColour.colourId` and `ppColour.published` which weren't being fetched
- Colour metadata (name, thumbnail) was being looked up from printer-specific colours which only had `colourId` and `published`

**Solution:**
1. Updated colour fetching in `getTutorialState()` to get metadata from global colours first
2. Fall back to printer-specific data if global data doesn't exist
3. Use global data for name, description, thumbnail
4. Use printer data for published status
5. Simplified Colour Management table to use `colour` directly instead of `ppColour`

**Code Pattern (from getTutorialState line ~275):**
```typescript
const colours: Colour[] = await Promise.all(
  colourDocsSnapshot.docs.map(async (colourDoc) => {
    const colourId = colourDoc.id;
    const printerColourData = colourDoc.data();

    // Fetch metadata from GLOBAL colour
    const globalColourRef = globalPaperDoc.ref.collection("colours").doc(colourId);
    const globalColourSnapshot = await globalColourRef.get();
    const globalColourData = globalColourSnapshot.exists ? globalColourSnapshot.data() : null;

    return {
      id: colourId,
      name: globalColourData?.name || printerColourData?.name || "Unknown Colour",
      description: globalColourData?.description || printerColourData?.description || "",
      thumbnailDataUrl: globalColourData?.thumbnailDataUrl || printerColourData?.thumbnailDataUrl || "",
      published: printerColourData.published ?? true,
      // ... other fields
    };
  }),
);
```

**Files Modified:**
- `lib/tutorial-store.ts` - colour fetching logic (lines 242-284)
- `app/admin/page.tsx` - Colour Management table (lines 2165-2238)

**Status:** ✅ FIXED - Colours display with correct names and thumbnails

---

### 4. ❌ → ✅ Deleted Items Not Recording
**Date Fixed:** Earlier session
**Severity:** MEDIUM
**Issue:** When deleting colours and steps, no record was created in the Deleted Items collection.

**Root Cause:**
- `deleteColour()` and `deleteStep()` functions weren't capturing item data before deletion
- No deleted item records were being created with type, name, deletedAt, deletedBy fields

**Solution:**
- Added deletion record logic to both functions
- Capture full item data before deletion
- Create record in `deletedItems` collection with: type, name, deletedAt, deletedBy, data (full item), contextual IDs

**Files Modified:**
- `lib/tutorial-store.ts` - deleteColour and deleteStep functions

**Status:** ✅ FIXED - All deletions now recorded in Deleted Items

---

### 5. ❌ → ✅ Steps Not Displaying After Being Added
**Date Fixed:** Earlier session
**Severity:** HIGH
**Issue:** When adding new steps, success message appeared but steps didn't show in the table.

**Root Cause:**
- `addStep()` creates steps in the global colour's steps subcollection
- `getTutorialState()` was fetching steps from printer-specific colour (which doesn't have a steps subcollection)
- Mismatch between where steps are stored vs. where they're fetched from

**Solution:**
- Updated `getTutorialState()` to fetch steps from global colour reference using `globalColourRef.collection("steps")`
- This ensures steps added by `addStep()` are properly retrieved

**Files Modified:**
- `lib/tutorial-store.ts` - getTutorialState steps fetching (lines 254-257)

**Status:** ✅ FIXED - Newly added steps display immediately

---

### 6. ❌ → ✅ Newly Added Colours Missing Metadata in Table
**Date Fixed:** Earlier session
**Severity:** MEDIUM
**Issue:** New colours appeared in the table but without name or thumbnail, showing empty cells.

**Root Cause:**
- Same as issue #3 - was trying to fetch colour metadata from printer-specific colours instead of global colours
- Global colour document was created but the lookup code was checking the wrong location

**Solution:**
- Updated colour metadata fetching to check global colours first (see issue #3 for details)

**Files Modified:**
- `lib/tutorial-store.ts` - colour metadata fetching

**Status:** ✅ FIXED - New colours display with full metadata

---

### 7. ❌ → ✅ Paper and Colour Toggles Failing with "Unknown Action" Error
**Date Fixed:** This session
**Severity:** HIGH
**Issue:** Clicking publish/unpublish toggles for papers and colours showed "Unknown action" error in the console.

**Root Cause:**
- CMS admin was calling `updatePaperInPrinter` and `updateColourInPrinterPaper` actions
- These action handlers didn't exist in the API route
- API route was throwing "Unknown action" error

**Solution:**
1. Added action type definitions to ActionPayload in `app/api/tutorial/route.ts`:
   - `updatePaperInPrinter(printerId, paperId, published)`
   - `updateColourInPrinterPaper(printerId, paperId, colourId, published)`
2. Verified backend functions existed in `lib/tutorial-store.ts`
3. Added case handlers in executeAction() function

**Backend Function Implementation:**
- Both functions validate resources exist using `assertDocExists()`
- Update `published` field in Firestore
- Call `updatePrinterLastModified()` to update timestamps
- Return fresh `getTutorialState()` for UI sync

**Files Modified:**
- `app/api/tutorial/route.ts` - action types and handlers
- `lib/tutorial-store.ts` - verified functions existed

**Status:** ✅ FIXED - Paper and Colour toggles working

---

### 8. ❌ → ✅ Duplicate Case Statements in API Route (THIS SESSION)
**Date Fixed:** This session
**Severity:** CRITICAL
**Issue:** Added duplicate `case "updatePaperInPrinter"` and `case "updateColourInPrinterPaper"` statements in the switch handler, causing JavaScript errors.

**Root Cause:**
- Didn't check if action handlers already existed before adding new ones
- Both actions were already implemented in the original code
- Added duplicate action type definitions and case handlers

**Solution:**
- Removed duplicate `updatePaperInPrinter` action type definition (was at lines 153-158)
- Removed duplicate `updatePaperInPrinter` case statement (was at lines 294-299)
- Removed duplicate `updateColourInPrinterPaper` action type definition (was at lines 153-159)
- Removed duplicate `updateColourInPrinterPaper` case statement (was at lines 281-287)

**Files Modified:**
- `app/api/tutorial/route.ts` - removed duplicates

**Status:** ✅ FIXED - Each action now appears exactly once

---

### 9. ❌ → ✅ Toggle Visibility Not Affecting User-Facing View (THIS SESSION)
**Date Fixed:** This session
**Severity:** HIGH
**Issue:** Toggles in the CMS admin were updating the `published` status in Firestore, but the user-facing view was still displaying items even when toggled to red (unpublished).

**Root Cause:**
- The `published` field was being saved to Firestore correctly
- The user-facing view (`app/page.tsx`) wasn't checking the `published` status when displaying printers, papers, and colours
- All items were being shown regardless of their published state

**Solution:**
1. Added `published?: boolean` field to type definitions in `app/page.tsx`:
   - `Colour` type
   - `Paper` type
   - `Printer` type

2. Implemented filtering before rendering:
   - **Printers**: `.filter((printer) => printer.published !== false)` (line 383)
   - **Papers**: `.filter((paper) => paper.published !== false)` (line 551)
   - **Colours**: `.filter((colour) => colour.published !== false)` (line 734)

**Filtering Logic:**
- Items where `published === true` are **shown** (green toggle) ✅
- Items where `published === false` are **hidden** (red toggle) ✅
- Items where `published === undefined` are **shown** (defaults to published) ✅

**Files Modified:**
- `app/page.tsx` - type definitions (lines 29-54) and item filters (lines 383, 551, 734)

**Status:** ✅ FIXED - Toggles now control visibility in user-facing view

---

## Data Architecture Pattern

**Key Pattern:** Two-tier storage with global definitions and printer-specific relationships

### Global Collections (Metadata)
- **papers** - Paper definitions with name, description, thumbnail, modifiedBy, createdAt
  - **colours** subcollection - Colour definitions with name, description, thumbnail
    - **steps** subcollection - Step definitions with title, contentHtml, imageDataUrl, order

### Printer-Specific Collections (Relationships & Status)
- **printers/{printerId}**
  - **papers** subcollection - Contains paperId and published status
    - **colours** subcollection - Contains colourId and published status
      - No steps subcollection (steps always fetched from global)

### Fetching Logic
When fetching data in `getTutorialState()`:
1. Always fetch global data first for metadata (name, thumbnail, etc.)
2. Fetch printer-specific data second for status (published flags)
3. Merge them together: metadata from global + status from printer-specific
4. This ensures newly created items are visible even if they're just created in global

---

## Current Feature Status

### ✅ Working Features
- Add/Edit/Delete Printers
- Add/Edit/Delete Papers (global and per-printer)
- Add/Edit/Delete Colours (global and per-printer)
- Add/Edit/Delete Steps
- Reorder Steps
- Publish/Unpublish Printers (affects entire printer visibility)
- Publish/Unpublish Papers (affects paper visibility in specific printer)
- Publish/Unpublish Colours (affects colour visibility in specific printer)
- Record deleted items (Printers, Papers, Colours, Steps)
- Restore deleted items
- Permanently delete items
- Client-side sorting (no composite indexes needed)

### 🟡 Known Limitations
- TypeScript errors in admin/page.tsx (pre-existing) - types need realignment but don't affect runtime
- Type mismatch: Printer.papers returns Paper[] but expects PrinterPaperWithPublished[]

### 📋 Type System Overview

**Key Types:**
```typescript
// Two-tier storage reflected in types
export type PrinterPaperWithPublished = Paper & {
  published: boolean;
};

export type Printer = {
  id: string;
  name: string;
  papers: PrinterPaperWithPublished[]; // Merged data
  // ... other fields
};

export type Paper = {
  id: string;
  name: string;
  colours: Colour[];
  published?: boolean; // Per-printer status
  // ... other fields
};

export type Colour = {
  id: string;
  name: string;
  steps: Step[];
  published?: boolean; // Per-printer status
  // ... other fields
};
```

---

## Files Modified Summary

### Backend Files
- **lib/tutorial-store.ts** - Core data fetching and manipulation
  - getTutorialState() - Main data fetching with proper two-tier merging
  - Various update/delete functions with proper status management
  - Deleted item recording for all types

### Frontend Files
- **app/admin/page.tsx** - CMS Admin Interface
  - Paper table rendering with proper id lookup
  - Colour management with correct metadata fetching
  - Toggle handlers for papers and colours

### API Files
- **app/api/tutorial/route.ts** - API Route Handler
  - Action type definitions
  - Action case handlers (now cleaned up, no duplicates)

---

## Testing Recommendations

When testing after any changes:

1. **Add Items** - Verify new items appear immediately in tables
2. **Display** - Check that names, thumbnails, and metadata display correctly
3. **Toggle Status** - Click publish/unpublish and verify immediate UI update
4. **Delete & Restore** - Delete items, verify they're in Deleted Items, then restore
5. **Per-Printer Settings** - Verify publish status is per-printer, not global
6. **Order/Sorting** - Verify items maintain correct order after refresh

---

## Quick Reference: Common Issues & Solutions

| Issue | Solution | Files |
|-------|----------|-------|
| Items not appearing | Check getTutorialState() is fetching from global + merging with printer data | tutorial-store.ts |
| Metadata missing | Verify fetching from globalColourRef, not printerColourData | tutorial-store.ts ~250-280 |
| Actions failing | Check ActionPayload has type def and switch has case handler | route.ts |
| Type errors | Check Paper[] vs PrinterPaperWithPublished[] mismatch | Multiple files |
| Items stay deleted | Check restoreDeletedItem is implemented and called | tutorial-store.ts |

---

## Notes for Future Work

1. **Type System** - Align types to avoid TypeScript errors in admin page
2. **UI Redesign** - Plan mode has breadcrumb-based navigation redesign (not yet implemented)
3. **Firestore Indexes** - Current setup avoids composite indexes by using client-side sorting
4. **Performance** - Consider pagination for large datasets in getTutorialState()

---

## Session History

### Current Session (March 20, 2026) - Part 6
- **Footer redesign: dark navy background, white text, ribbon shape for admin**
  - ✅ Both footers recoloured to dark navy `#001F2D` with white `#ffffff` text and link
  - ✅ User-facing footer: full-width solid bar with `#001F2D` background
  - ✅ Admin footer: parallelogram ribbon anchored to the right — `clip-path: polygon(32px 0, 100% 0, 100% 100%, 0 100%)` creates diagonal left edge; `filter: drop-shadow()` adds depth following the clip shape
  - ✅ Back-to-top Fab moved to `bottom: 72px` — clears the footer on desktop and wrapped-text mobile layouts
  - Files Modified: `app/components/Footer.tsx`, `app/page.tsx`

### Current Session (March 20, 2026) - Part 5
- **Replaced step-by-step navigation with continuous scroll view (user-facing)**
  - ✅ All step cards rendered vertically in a scrollable `Stack` — users scroll through steps instead of clicking chevrons
  - ✅ Colour name title + "STEP X OF Y" counter are sticky at the top of the viewport while scrolling
  - ✅ "STEP X OF Y" updates dynamically via `IntersectionObserver` — whichever card is first in the visible area drives the counter
  - ✅ Breadcrumb row (back/home buttons) scrolls off screen naturally
  - ✅ Floating ↑ `Fab` (brand blue) appears after scrolling 400px and smooth-scrolls back to top
  - ✅ Each step card retains existing number label, title, body content, and full-width enlargeable image
  - ✅ Shared image enlarge Modal (single instance outside the map loop) driven by `enlargedStepImageUrl` state
  - ✅ Removed: chevron buttons, progress dots, swipe gesture handlers, keyboard arrow navigation, `stepIndex` from `localStorage`
  - Files Modified: `app/page.tsx`

### Current Session (March 20, 2026) - Part 4
- **Improved homepage header/description save UX in admin sidebar**
  - ✅ Moved save action below the description field (was inline with header field)
  - ✅ Replaced tick `IconButton` with small text `Save` button (MUI `SaveIcon` + contained style) and `Cancel` text button
  - ✅ Save/Cancel only appear when there are unsaved changes (compares live values against last saved values)
  - ✅ Saving shows inline `CircularProgress` spinner (16px) — does NOT trigger the main content overlay
  - ✅ On success: green `✓ Saved` appears for 2 seconds then disappears automatically
  - ✅ Cancel resets both fields to the last saved database values
  - ✅ Homepage save bypasses `runAction()` to avoid triggering the global loading overlay
  - Files Modified: `app/admin/page.tsx`

### Current Session (March 20, 2026) - Part 3
- **Standardised global typography scale (Option A)**
  - ✅ Extended MUI theme in `app/providers.tsx` to define a full typography scale across all variants: `h1`–`h6`, `subtitle1/2`, `body1/2`, `caption`, `overline`, `button`
  - ✅ Wrapped theme with `responsiveFontSizes()` — MUI automatically scales font sizes down on smaller screens without manual breakpoint overrides
  - ✅ Added `textTransform: "none"` to `button` variant — removes MUI's default ALL CAPS on button text
  - ✅ Font family remains Roboto (no external font loading added)
  - ✅ Existing `sx={{ fontSize: ... }}` overrides take precedence — no existing layouts broken
  - Files Modified: `app/providers.tsx`

### Current Session (March 20, 2026) - Part 2
- **Added drag-and-drop reordering for Steps in CMS admin**
  - ✅ Installed `@hello-pangea/dnd@18.0.1`
  - ✅ Added `setStepOrder()` to `lib/tutorial-store.ts` — fetches all steps sorted by order, recomputes positions, batch-writes to Firestore in a single operation
  - ✅ Added `setStepOrder` action type and case handler to `app/api/tutorial/route.ts`
  - ✅ Replaced ▲▼ arrow buttons with a `⠿` drag handle icon on each step card
  - ✅ Cards lift with a shadow while being dragged; drop position is shown inline
  - ✅ Removed unused `Direction` type and `handleReorderStep` handler from admin page
  - Files Modified: `lib/tutorial-store.ts`, `app/api/tutorial/route.ts`, `app/admin/page.tsx`

- **Added loading overlay to main content area**
  - ✅ Semi-transparent overlay (`rgba(224, 244, 255, 0.6)`) covers the main content area during any action
  - ✅ Brand-blue `CircularProgress` spinner centered within the overlay
  - ✅ Overlay blocks all interaction while loading, preventing conflicting actions across all sections (Printers, Papers, Colours, Steps)
  - Files Modified: `app/admin/page.tsx`

### Current Session (March 20, 2026)
- **Redesigned footer: fixed overlay with email link**
  - ✅ Footer is now fixed at the bottom of the viewport on both user-facing and admin pages (always visible, overlays content)
  - ✅ Transparent background with no gradient — dark grey (`#333333`) text readable over light blue page backgrounds
  - ✅ "Digital Design & Media Team" is now a clickable underlined `mailto:dmd.cove@rmit.edu.au` link
  - ✅ User-facing pages: text centered (unchanged)
  - ✅ Admin page: text right-aligned, footer sits behind the sidebar (sidebar given `position: relative; zIndex: 20`, footer `zIndex: 10`)
  - ✅ `pointerEvents: none` on footer so transparent area does not block clicks on underlying content; `auto` restored on the text/link
  - Created `app/components/Footer.tsx` — client component using `usePathname()` to conditionally apply text alignment per page
  - Files Modified: `app/layout.tsx`, `app/admin/page.tsx`, `app/components/Footer.tsx` (new)

### Current Session (March 19, 2026) - Part 4
- **Fixed sidebar content alignment and collapsed icon spacing**
  - ✅ Removed `flex: 1` from the Navigation Stack — previously caused Homepage Header & Description, Printer List, Full Paper List, and Colour Management to be pushed to the bottom of the sidebar
  - ✅ All sidebar content now flows from the top in both expanded and collapsed states
  - ✅ Unified collapsed icon spacing — previously two separate Stacks used inconsistent spacing (1.5 and 2) with an inner printer avatars Stack at spacing 1; all now use spacing 1.5 with matching gap between groups
  - Files Modified: `app/admin/page.tsx`

### Current Session (March 19, 2026) - Part 3
- **Fixed "Image was compressed" note persisting across modals**
  - Same root cause as the earlier imageUploadError bug: state was only cleared on Cancel/onClose, not on dialog open
  - Also affected imageUploadError (would have surfaced via Save button path, which bypasses both Cancel and onClose)
  - Fix: reset both `imageUploadError` and `imageCompressed` at every dialog open trigger
    - 4 handler functions: `handlePrinterMenuEdit`, `handlePaperMenuEdit`, `handleColourMenuEdit`, `handleStepMenuEdit`
    - 6 inline onClick buttons: Add Printer (×2), Add Paper (×2), Add Colour, Add Step
  - Files Modified: `app/admin/page.tsx`

### Current Session (March 19, 2026) - Part 2
- **Added client-side image compression for JPEG/PNG uploads**
  - ✅ JPEG/PNG files over 700 KB are now auto-compressed via the Canvas API (no rejection error)
  - ✅ Compression reduces JPEG quality progressively (0.85 → 0.1), then scales dimensions if still too large
  - ✅ GIF files over 700 KB are still hard-rejected (canvas cannot preserve GIF animation)
  - ✅ Yellow inline note "Image was compressed to meet the 700 KB limit." shown to admin when compression occurs
  - ✅ Yellow note clears correctly on Cancel, backdrop click, and Escape (same fix as error message)
  - Refactored all 8 upload handlers to share a single `processUpload()` helper
  - Added `compressImage()` function using off-screen canvas (no third-party libraries)
  - Files Modified: `app/admin/page.tsx`

### Current Session (March 19, 2026)
- **Added image upload validation to all CMS admin dialogs**
  - ✅ Restricted accepted file formats to JPEG, PNG, and GIF only (previously accepted all image types)
  - ✅ Added 700 KB file size limit (safely under Firestore's 1MB document limit after base64 encoding overhead)
  - ✅ Inline error message renders inside the open dialog, just below the file input — not in the global alert
  - ✅ Error clears automatically when a valid file is selected
  - ✅ Error clears when a dialog is closed (via Cancel button, backdrop click, or Escape key)
  - All 8 upload handlers updated: New/Edit Printer, New/Edit Paper, New/Edit Colour, New/Edit Step
  - **Bug Fix**: Error message was persisting across modals after being triggered
    - Root cause: MUI `onClose` does not fire when Cancel button programmatically sets `open={false}` — only fires on backdrop click or Escape
    - Solution: Added `setImageUploadError(null)` to all 8 Cancel button `onClick` handlers (in addition to the existing `onClose` handlers)
  - Files Modified: `app/admin/page.tsx`

### Current Session (March 16, 2026 - Part 7)
- **Added reset-to-original functionality for image crops**
  - ✅ Added `originalCropImage` state variable to store the original image when modal opens
  - ✅ Enhanced `resetCropBox()` function to restore the original image (not just crop box position)
  - ✅ Updated `openCropModal()` to capture and store the original image data URL
  - **Bug Fix #1**: Reset button wasn't restoring original image across modal sessions
    - Root cause: `originalCropImage` was being cleared when the modal closed, so reopening the modal would store the cropped image as the new "original"
    - Solution: Preserve `originalCropImage` across modal open/close cycles by removing the clear statements
    - Removed `setOriginalCropImage("")` from `applyCrop()` success and error handlers
    - Removed `setOriginalCropImage("")` from `closeCropModal()` function
    - Git commit: `cdeb5ae`

  - **Bug Fix #2**: Original image still being overwritten on modal reopen
    - Root cause: `openCropModal()` was unconditionally setting `setOriginalCropImage(imageDataUrl)` every time the modal opened
    - When reopening with the cropped image, it would overwrite the stored original with the cropped version
    - Solution: Only set `originalCropImage` if it's not already set using `if (!originalCropImage) setOriginalCropImage(imageDataUrl)`
    - This preserves the true original image across crop/apply/close/reopen cycles
    - Git commit: `ff6139a`

  - **Bug Fix #3**: Reset button showed wrong image when editing different items
    - Root cause: `originalCropImage` was preserved globally across the entire session, causing it to persist when editing different items
    - When editing Item A then Item B, reset would show Item A's original instead of Item B's
    - Solution: Track context (mode + isEdit state) along with original image
    - Added new state: `originalCropContext = { mode: string, isEdit: boolean }`
    - In `openCropModal()`, detect when mode or isEdit flag differs from stored context
    - If different item detected, reset both `originalCropImage` and `originalCropContext`
    - Git commit: `9e6d531`

  - **Bug Fix #4**: Still showed wrong image when editing different items of SAME TYPE
    - Root cause: When editing multiple items of the same type (e.g., two Printers, two Colours), mode and isEdit stay the same
    - The context check didn't detect the item change, so originalCropImage persisted from first item to second
    - Solution: Add imageUrl comparison to the isDifferentItem check
    - Updated originalCropContext to store imageUrl: `{ mode, isEdit, imageUrl }`
    - Now detects item changes based on: mode OR isEdit OR imageUrl
    - If imageUrl differs, it's a different item (even if same type), so reset originalCropImage
    - Git commit: `a712fc4`

  - **Bug Fix #5**: Reset didn't restore original image size
    - Root cause: When reopening crop modal after applying a crop, the form field has the cropped image (different URL)
    - The logic treated this as "different item" and reset originalCropImage to the cropped version
    - Lost the true original image and its dimensions
    - Solution: Track BOTH originalImageUrl and currentImageUrl separately
    - originalImageUrl: the image URL when first opened (before any crops)
    - currentImageUrl: the current image URL in the form field
    - When reopening, check if imageDataUrl matches either originalImageUrl OR currentImageUrl
    - If yes, preserve originalCropImage; if no, it's a different item, so reset
    - Git commit: `4853b86`

  - **Implementation Progress**:
    - ✅ Bug Fix #1: Fixed clearance of originalCropImage on modal close
    - ✅ Bug Fix #2: Fixed unconditional overwriting of originalCropImage on modal reopen
    - ✅ Bug Fix #3: Implemented context tracking to detect different items
    - ✅ Bug Fix #4: Added imageUrl comparison to detect same-type items
    - ✅ Bug Fix #5: Implemented dual imageUrl tracking (original vs current)
    - ⚠️ **Issue Remaining**: Despite 5 bug fixes, the reset button still displays cropped image instead of original size

  - **Current Behavior**:
    - ✅ Reset button now shows the correct image (fixed the "different photo replaces it" bug)
    - ✅ Works correctly across different items (no longer shows images from other items)
    - ❌ Image displayed at cropped size (not original size) - ROOT CAUSE UNKNOWN, REQUIRES FURTHER INVESTIGATION

  - **Investigation Needed**:
    - The originalCropImage state appears to be storing the image correctly
    - The resetCropBox function is being called (verified in previous debugging)
    - The Image object loads with correct dimensions
    - But the modal display still shows cropped dimensions
    - Possible areas: image rendering, crop box overlay calculations, or display state not updating

  - **Benefit Achieved So Far**:
    - Users can reset to the correct original image from the current item
    - No more confusion with images from different items being shown
    - Reset functionality partially working (just not at original size yet)

  - Files Modified: app/admin/page.tsx (lines 342-343, 1314-1337)
  - Git commits:
    - `ff9bc04` - Add reset-to-original functionality for image crops
    - `cdeb5ae` - Fix reset-to-original crop feature: preserve original across modal sessions
    - `ff6139a` - Fix: only set originalCropImage on first modal open
    - `9e6d531` - Fix: detect when editing different items and reset originalCropImage
    - `a712fc4` - Fix: detect item changes by comparing imageUrl in addition to context
    - `4853b86` - Fix: preserve original image size by tracking original vs current imageUrl
    - `943085d` - Update progress log: document Bug Fix #5

  - Status: ⚠️ PARTIALLY WORKING - Correct image restored, but at cropped dimensions (needs debugging)

### Current Session (March 16, 2026 - Part 5)
- **Fixed ALL TypeScript errors - Ready for deployment**
  - ✅ Updated TutorialState type in app/admin/page.tsx to include homepageTitle and homepageDescription
  - ✅ Updated TutorialState type in app/page.tsx to include homepageTitle and homepageDescription
  - ✅ Fixed optional chaining for selectedColor?.steps?.length
  - ✅ Fixed findIndex logic to handle -1 when step not found
  - Root cause: Local type definitions were out of sync with the actual API response types
  - All TypeScript compilation now passes with no errors
  - Git commit: `f589fd1` - Fix TypeScript errors: update TutorialState types and handle undefined values

### Current Session (March 16, 2026 - Part 4)
- **Fixed TypeScript error: Missing TutorialState import**
  - Note: This initial fix was refined - the issue was that local type definitions needed updating, not imports
  - Git commit: `6698356` - Fix TypeScript error: import TutorialState type (superseded)

### Current Session (March 16, 2026 - Part 3)
- **Fixed ALL ESLint errors preventing production build**
  - ✅ Removed unused `imgOffsetX` and `imgOffsetY` variables in `handleCropMouseMove`
  - ✅ Changed `newWidth` and `newHeight` from `let` to `const` (they're never reassigned)
  - ✅ Fixed `any` type in resize handle onMouseDown event handler
  - ✅ Removed unused `Button` import from `app/page.tsx`
  - ✅ Removed unused `containerRect` variable in `handleCropMouseMove`
  - Result: **All ESLint errors resolved** - Ready for Firebase deployment
  - Git commits:
    - `9260662` - Fix ESLint errors to allow production build
    - `503124b` - Update progress log: document ESLint fixes
    - `c7ec16d` - Fix remaining ESLint error: remove unused containerRect variable

### Previous Session (March 11, 2026)
- **Updated footer styling**
  - Changed footer from center-aligned with fixed positioning to static positioning
  - Removed #6A1B82 border outline from footer
  - Footer now sits at the bottom of the page after all content
  - Updated in `app/layout.tsx` - footer styling
  - Git commit: `004dd39` - Update footer: remove fixed position and border

- **Added icon borders to Steps page**
  - Added outline borders (1px solid lightBorder with 6px border-radius) to back arrow and home icons in Steps page
  - Now consistent with icon styling across all other pages (Printer, Paper, Colour selection pages)
  - Updated in `app/page.tsx` - icon button styling
  - Git commit: `645e55e` - Add outline borders to Steps page icons

- **Reorganized Steps page card layout**
  - Moved step title next to step number on the same horizontal line using Stack
  - Removed separate h5 element displaying step name
  - Layout now displays as: [1] Select your Printer on one line
  - Git commit: `4fbe2dd` - Reorganize Steps page card layout

- **Centered progress indicator and stacked text**
  - Changed progress indicator from responsive row/column layout to always column direction
  - Center-aligned entire progress indicator element (alignItems: "center", justifyContent: "center")
  - "STEP X OF Y" text now displays above the progress dots
  - Git commit: `cd6b1db` - Center-align progress indicator and stack text above dots

- **Replaced Previous/Next buttons with Material Design 3 chevron icons**
  - Added ChevronLeftIcon and ChevronRightIcon imports from @mui/icons-material
  - Replaced Previous/Next buttons with IconButton components using chevron icons
  - Navigation now uses left chevron (previous) and right chevron (next) icons
  - Maintained border styling, hover effects, and disabled state styling
  - Git commit: `991dd2c` - Replace Previous/Next buttons with Material Design 3 chevron icons

- **Added image enlargement modal to Steps page**
  - Made step image clickable with cursor pointer and hover shadow effect
  - Clicking image opens full-screen modal with enlarged image
  - Clicking/tapping outside image closes the modal
  - Modal features dark overlay (rgba 0,0,0 0.7) and responsive sizing
  - Git commit: `42ec096` - Add image enlargement modal to Steps page

- **Preserved line breaks in step content text**
  - Added whiteSpace: "pre-wrap" to display text exactly as it appears in CMS
  - Added wordBreak: "break-word" for proper text wrapping on longer lines
  - Line breaks (return/enter characters) now display as new lines in user-facing view
  - Git commit: `cb61df3` - Preserve line breaks in step content text

- **Synced homepage header and description from CMS to user-facing view**
  - Added homepageTitle and homepageDescription to TutorialState type
  - Created updateHomepageSettings() function in tutorial-store.ts to save settings to Firestore
  - Updated getTutorialState() to fetch homepage settings from settings/homepage document
  - Added updateHomepageSettings action type and case handler in API route
  - Made Homepage Header and Homepage Description fields required in CMS admin
  - Added check/save icon button next to Homepage Header field
  - Added validation for both fields before saving
  - Updated user-facing homepage to display values from CMS (with fallbacks)
  - Git commit: `7b8dcc4` - Sync homepage header and description from CMS to user-facing view

- **Added top padding to modal Stack elements**
  - Added pt: 2 (padding-top) to Stack components in all CMS modal dialogs
  - Updated modals: Add Printer, Edit Printer, New Paper, Edit Paper, New Colour, Edit Colour
  - Improves spacing and visual hierarchy within modal content areas
  - Git commit: `8beb1d3` - Add top padding to modal Stack elements

- **Modernized RichHtmlEditor toolbar with Material Design 3 icons**
  - Replaced text-based toolbar buttons with Material Design 3 icons from @mui/icons-material
  - Icon updates:
    - 'Bold' button → FormatBoldIcon
    - 'Italic' button → FormatItalicIcon
    - 'Underline' button → FormatUnderlinedIcon (new feature added)
    - 'Bullets' button → ListIcon
    - 'Insert link' button → LinkIcon
    - 'Remove link' button → LinkOffIcon
  - Removed 'Heading' button for cleaner toolbar
  - Converted Button components to IconButton for consistency with Material Design 3
  - Reduced toolbar spacing from 1 to 0.5 for more compact layout
  - Added title attributes to IconButtons for accessibility
  - Styled all icons with #009DC9 brand color
  - Applies to both Add Step and Edit Step modals (RichHtmlEditor component)
  - Git commit: `8303a84` - Modernize RichHtmlEditor toolbar with Material Design 3 icons

- **Added image enlargement modal to Steps section in CMS admin**
  - Made step images clickable with cursor pointer and hover scale effect (1.02x)
  - Clicking image opens full-screen modal with enlarged image
  - Modal features dark overlay (rgba 0,0,0 0.7) and responsive sizing
  - Clicking/tapping outside image closes the modal
  - Added enlargedStepImageUrl state variable to track which image is enlarged
  - Added Modal component to MUI imports
  - Styling: responsive width (90% xs, 80% sm, 70% md), maxWidth 900px, maxHeight 90vh
  - Consistent with image enlargement feature already in user-facing view
  - Git commit: `bf23474` - Add image enlargement modal to Steps section in CMS admin

- **Implemented interactive image cropping with full user control**
  - Admin users can freely position and resize crop area with complete control
  - **Initial Design & Features:**
    - Added optional image cropping with 16:9 aspect ratio (auto-crop) for all image types
    - Added "Crop" buttons with CropIcon to all Add and Edit modals (Printer, Paper, Color, Step)
    - Crop modal with image preview and automatic 16:9 aspect ratio cropping
    - Uses HTML5 Canvas API for client-side image processing (no external dependencies)
    - Git commits: `e1c8ec0`, `e2192ef`
  - **Enhanced to Interactive Cropping:**
    - Replaced auto-crop with interactive draggable and resizable crop box
    - Users can drag crop box anywhere on the image to reposition
    - Resize using bottom-right handle with free-form resizing (no aspect ratio constraint)
    - Visual overlay shows dark areas outside crop box for clarity
    - Reset button with Refresh icon to reset crop box to full image size
    - Git commit: `e2192ef` - Implement interactive image cropping with draggable and resizable crop box
  - **Bug Fixes & Improvements:**
    - Fixed crop box drag and resize event handler (moved from sx prop to proper event handler)
    - Git commit: `de684f6` - Fix crop box drag and resize functionality
    - Changed crop modal image display to show full image without scaling constraints
    - Changed crop box to start at full image size (covers entire image initially)
    - Git commit: `7026fe1` - Fix crop box resize and image display issues
    - Fixed drag movement constraint when crop box is at full image size
    - Simplified resize logic to allow independent width/height resizing
    - Git commit: `2ed47fa` - Initialize crop box to full image size and enable free-form resizing
    - Fixed boundary checking to allow proper movement and resizing
    - Git commit: `b06101d` - Fix crop box drag and resize when crop box is at full image size
  - **Bug Fix: Apply Crop Not Saving - Edit Modal Issue (THIS SESSION - March 16, 2026 - Part 5)**
    - Issue: Cropped images not being saved/displayed in form fields; modal closes but nothing changes
    - Root Cause: CRITICAL STATE MANAGEMENT BUG
      1. When cropping in **Edit modals**, user calls `openCropModal(editPrinterThumbnail, "printer")`
      2. applyCrop function was always calling `setNewPrinterThumbnail(croppedImageUrl)` - the ADD modal state variable
      3. Edit modal displays `editPrinterThumbnail`, but applyCrop saves to `newPrinterThumbnail`
      4. Result: Cropped image saves to wrong state variable; Edit modal appears unchanged
    - Solution: Implemented mode tracking system
      1. Added new state variable: `const [cropIsEdit, setCropIsEdit] = useState(false);`
      2. Modified openCropModal signature: `openCropModal(imageDataUrl, mode, isEdit: boolean = false)`
      3. Updated applyCrop to check cropIsEdit flag:
         ```typescript
         if (cropMode === "printer") {
           if (cropIsEdit) {
             setEditPrinterThumbnail(croppedImageUrl);  // Edit modal
           } else {
             setNewPrinterThumbnail(croppedImageUrl);   // Add modal
           }
         }
         ```
      4. Updated all Edit modal crop buttons to pass `isEdit={true}`:
         - Line 3205: `openCropModal(editPrinterThumbnail, "printer", true)`
         - Line 3711: `openCropModal(editPaperThumbnail, "paper", true)`
         - Line 4184: `openCropModal(editColourThumbnail, "color", true)`
         - Line 4454: `openCropModal(editStepImage, "step", true)`
      5. Reset cropIsEdit in both closeCropModal and applyCrop error handler
    - Result: Cropped images now save to the correct state variable (Edit or Add) and display immediately
    - Files Modified: app/admin/page.tsx (lines 339, 1311-1314, 1458-1482, 1487, 1492, 1501, 3205, 3711, 4184, 4454)
    - Git commit: `406e243` - Fix crop functionality: add Edit modal mode tracking and preserve crop aspect ratio
    - Status: ✅ FIXED - Crop now works in both Add and Edit modals

  - **Bug Fix: Distorted Crop Output (THIS SESSION - March 16, 2026 - Part 6)**
    - Issue: Cropped images appear distorted/stretched in the thumbnail preview
    - Root Cause: Crop output was forced to 16:9 aspect ratio regardless of user's crop selection
      - Code: `cropCanvas.height = Math.round(400 * (9 / 16))` forced all outputs to 16:9
      - If user selected a 2:1 crop, it would be stretched to fit 16:9, causing distortion
    - Solution: Preserve the user's crop selection aspect ratio in the output
      ```typescript
      const outputWidth = 400; // Output width
      const outputHeight = Math.round(outputWidth * (cropBoxHeight / cropBoxWidth)); // Preserve crop aspect ratio
      cropCanvas.width = outputWidth;
      cropCanvas.height = outputHeight;
      ```
    - Result: Cropped output now maintains the exact aspect ratio of the user's crop selection; no distortion
    - Files Modified: app/admin/page.tsx (lines 1438-1441)
    - Git commit: `406e243` - Fix crop functionality: add Edit modal mode tracking and preserve crop aspect ratio
    - Status: ✅ FIXED - Output aspect ratio now preserved, no more stretching

  - **Bug Fix: Apply Crop Not Saving - Previous CORS Issue (THIS SESSION - March 16, 2026 - Part 4)**
    - Issue: When user clicks "Apply Crop", the cropped image is not saved to the form field
    - Root Cause (Partial): Image loading in applyCrop was failing silently, likely due to:
      1. CORS restrictions when loading images from Firestore URLs
      2. Image could display in preview but not be manipulated on canvas due to security policies
    - Solution:
      1. Add `img.onerror` handler to catch image loading failures
      2. Set `img.crossOrigin = "anonymous"` to enable CORS handling for external URLs
      3. Log diagnostic error messages to help identify issues
      4. Modal now closes gracefully even if image loading fails
    - Result: Helped identify that this was not the main issue (CORS was handled); revealed the state management bug instead
    - Git commit: `4814002`

  - **Bug Fix: Image Preview Cutoff at Top (THIS SESSION - March 16, 2026 - Part 3)**
    - Issue: Top of image was being cut off in the crop preview window
    - Root Cause: Container used `display: flex` with `alignItems: center` and `justifyContent: center` which centered the image vertically; when image was larger than container, the top was cut off by the container's top edge
    - Solution:
      1. Replaced `maxHeight: "400px"` with `aspectRatio: "4 / 3"` for fixed 4:3 aspect ratio
      2. Removed `display: flex`, `alignItems: center`, and `justifyContent: center`
      3. Image now aligns naturally at top-left and scrolls if larger than 4:3 preview
    - Result: Entire image is visible; top is no longer cut off; 4:3 preview ratio maintained
    - Git commit: `b6b69f8`

  - **Bug Fix: Scrollable Preview and Resize Handle Accessibility (THIS SESSION - March 16, 2026 - Part 2)**
    - Issue 1: Resize handle at bottom-right corner was inaccessible because crop box starts at full image size
    - Issue 2: Large images were not fully visible in the 400px max-height preview area
    - Root Cause: Container had `overflow: "hidden"` which prevented scrolling
    - Solution:
      1. Changed container `overflow: "hidden"` to `overflow: "auto"` for scrollable preview
      2. Updated offset calculations to account for scroll position:
         - `imgOffsetX = imgRect.left - containerRect.left + cropContainerRef.current.scrollLeft`
         - `imgOffsetY = imgRect.top - containerRect.top + cropContainerRef.current.scrollTop`
      3. Crop box positioning now works correctly with scrollable container
      4. Resize handle becomes accessible by scrolling down to reach bottom-right corner
    - Result: Users can scroll to see full image and access resize handle at bottom-right
    - Git commit: `e223004`

  - **Bug Fix: Coordinate System Mismatch (THIS SESSION - March 16, 2026 - Part 1)**
    - Issue: Crop box did not move when dragging and would not resize from bottom-right handle
    - Root Cause: Two coordinate system mismatch:
      1. Mouse events (`e.clientX`, `e.clientY`) were in viewport coordinates
      2. Crop box dimensions (`cropBoxX`, `cropBoxY`, etc.) were in image coordinate space
      3. Container had fixed 4:3 aspect ratio but image could have any aspect ratio, causing misalignment
    - Solution:
      1. **Coordinate Conversion**: Added scale factor calculation to convert viewport delta to image coordinates
         - Calculate scale: `scaleX = cropImageWidth / displayedImageWidth`, `scaleY = cropImageHeight / displayedImageHeight`
         - Convert delta: `deltaX = (e.clientX - dragStartX) * scaleX`, `deltaY = (e.clientY - dragStartY) * scaleY`
      2. **Image Position Tracking**: Get actual displayed image position and size within container
         - Removed fixed `aspectRatio: "4 / 3"` constraint from container (changed to `maxHeight: "400px"`)
         - Use `getBoundingClientRect()` on image element to get actual display dimensions
      3. **Crop Box Positioning**: Changed from percentage-based to pixel-based positioning
         - Calculate offset: `imgOffsetX = imgRect.left - containerRect.left`
         - Calculate crop box pixels: `cropBoxPixelX = imgOffsetX + cropBoxX * scaleX`
         - Position overlay with `left: "${cropBoxPixelX}px"` instead of percentages
      4. **Dark Overlay**: Updated all four overlay sections to use pixel-based positioning for accuracy
    - Git commit: `6daca85`
  - **API Route Note:**
    - After modifying crop-related code, the dev server requires a full restart (not just hot-reload) for API routes to properly reload
    - `npm run dev` must be restarted for changes to take effect
    - Browser hard refresh (Ctrl+Shift+R) is also recommended after restart
  - **Current Crop Features:**
    - Crop box initializes covering full image
    - Free-form resizing (any size, no aspect ratio constraint)
    - Drag to reposition crop box anywhere within image bounds
    - Resize from bottom-right handle (both width and height resize independently)
    - Reset button returns crop box to full image size
    - Output: 400px width JPEG with 0.9 quality for optimal size/quality balance
    - Output aspect ratio preserved based on user's crop selection (not forced to 16:9)
    - **Full image now visible and scrollable in crop modal** ✅
    - **Drag and resize functionality fixed with coordinate system conversion** ✅
    - **Resize handle accessible via scrolling** ✅
    - **Crop works in both Add and Edit modals** ✅
    - **Distortion fixed - aspect ratio preserved** ✅
    - **Save functionality working** ✅
  - **State Management:**
    - Crop box dimensions: cropBoxX, cropBoxY, cropBoxWidth, cropBoxHeight
    - Image dimensions: cropImageWidth, cropImageHeight
    - Interaction state: isDraggingCrop, resizingCorner, dragStartX, dragStartY
  - **Event Handlers:**
    - handleCropMouseDown() for initiating drag and resize (with proper event propagation stop)
    - handleCropMouseMove() for updating crop box position/size with coordinate system conversion and scroll support
    - handleCropMouseUp() for ending drag and resize
  - **Styling:**
    - Cyan border (#009DC9) for crop box with semi-transparent fill
    - Resize handle indicator (12px circle) at bottom-right corner
    - Dark overlay outside crop area for visual feedback (now with pixel-based positioning)
    - Container uses fixed `aspectRatio: "4 / 3"` with `overflow: "auto"` for scrollable display
    - Image aligns at top-left (not centered) to prevent cutoff when scrolling
    - Full image is accessible - nothing is hidden or cut off
  - **Crop Buttons:**
    - Available in all Add modals (Printer, Paper, Color, Step)
    - Available in all Edit modals (Printer, Paper, Color, Step)
    - Display with CropIcon for visual consistency
    - Cropping is completely optional

### Previous Session (March 5-9, 2026)
- Fixed duplicate case statements in API route
- Verified all three toggle types (Printers, Papers, Colours) are working
- **Fixed toggle visibility** - Red toggles now hide items from user-facing view
  - Added `published` field to Colour, Paper, and Printer types
  - Implemented filtering in user-facing view to respect published status
  - Printers, papers, and colours now correctly show/hide based on toggle state
- **Fixed final TypeScript type error** (tutorial-store.ts line 221)
  - Root Cause: Printer type expected `papers: PrinterPaperWithPublished[]` but getTutorialState() returned `papers: Paper[]`
  - Solution:
    1. Added `published?: boolean;` to Paper type (line 46) to match actual data structure
    2. Changed Printer.papers from `PrinterPaperWithPublished[]` to `Paper[]` (line 67)
  - Verified: TypeScript compilation passes with no errors
- **Polished user-facing view with modern minimalist design**
  - **Color Palette**: Updated with subtle shadows (cardShadow: "0 2px 8px rgba..."), refined border colors, improved spacing
  - **Card Design**: Replaced hard borders with soft box-shadows; smooth cubic-bezier transitions
  - **Hover Effects**: Cards now lift with `translateY(-4px)` on hover with enhanced shadow
  - **Headers**: Increased font sizes (2.25-3.5rem), added letterSpacing (-0.02em), stronger font weights (800)
  - **Typography**: Improved line heights (1.4-1.6), refined font weights, better visual hierarchy
  - **Navigation Buttons**: Added border-radius (6px), smoother hover transitions (0.2s ease)
  - **Button Styles**: Next button uses contained (filled) variant, Previous button uses outlined variant
  - **All Pages Updated**: Printer, Paper, Colour selection pages + Steps display page
  - **Responsive Design**: Optimized for mobile (xs), tablet (sm), and desktop (md/lg) with proper spacing
  - Verified in `npm run dev` - development server running without errors
- Created deployment log to track build issues and solutions
- Created dated backup files (PROGRESS_LOG.bak-2026-03-09, DEPLOYMENT_LOG.bak-2026-03-09)

### Previous Session
- Implemented deleted item recording for colours and steps
- Fixed all display issues with papers and colours
- Implemented paper and colour toggle functionality
- Fixed step and colour display after creation

### Earlier Sessions
- Fixed critical bug where deleting colour caused all data to disappear
- Implemented two-tier data architecture pattern
- Built core CMS admin interface
- Set up Firestore structure and backend functions

---

## Session March 18, 2026

### File Cleanup
- Identified and removed 4 unused `.md` files from the project root
- Created dated backup: `PROGRESS_LOG.bak-2026-03-16.md`

### Feature: Crop Image Reset-to-Original
**Status:** ⚠️ Partially Working — correct image per item, but still at cropped dimensions

**What was implemented:**
- Added "Reset" button in the crop modal so admins can revert to the original image without re-uploading
- Added `originalCropImage` and `originalCropContext` state variables to track the original per-item image
- `openCropModal` stores the original image on first open; reopening the same item preserves it
- `resetCropBox` restores `cropImage`, resets canvas dimensions, and resets crop box to full dimensions

**Bugs fixed:**
1. ✅ Reset showed image from a different item (e.g., a previously edited printer's photo appeared when editing a colour)
   - Root Cause: `originalCropImage` was global state persisting across items
   - Fix: Added `originalCropContext` with `{ mode, isEdit, originalImageUrl, currentImageUrl }` to detect item changes
   - Commits: `9e6d531`, `a712fc4`
2. ✅ Same-type items (e.g., two Printers) not detected as different
   - Root Cause: mode + isEdit were the same for both; only imageUrl distinguishes them
   - Fix: Added imageUrl comparison to context check
3. ✅ Reset showed cropped image (not original) after apply + reopen
   - Root Cause: After applying crop, reopening modal set new `cropImage` URL, which was treated as "different item" and set `originalCropImage` to the cropped version
   - Fix: Dual imageUrl tracking — if incoming imageDataUrl matches `originalImageUrl` OR `currentImageUrl`, treat as same item

**Remaining Bug (now fixed — see below):**
- ✅ Reset displayed at cropped dimensions despite correct image content — fixed March 18

### Bug Fix: Reset-to-Original Showed Cropped Dimensions ✅
**Date Fixed:** March 18, 2026
**File:** `app/admin/page.tsx` — `applyCrop` function

**Root Cause:**
`applyCrop` created `croppedImageUrl` and set it as the thumbnail, but never updated `originalCropContext.currentImageUrl` to reflect the new cropped URL. When the user reopened the crop modal for the same item (now passing the cropped image URL), the `isDifferentItem` check compared the cropped URL against both `originalImageUrl` and `currentImageUrl` — both still pointing to the original. Both comparisons returned `true`, so `isDifferentItem = true`, causing `originalCropImage` to be overwritten with the cropped image URL. `resetCropBox` then restored the cropped image (400×315) instead of the original.

**Fix:**
Added one line in `applyCrop` immediately after `croppedImageUrl` is created:
```ts
setOriginalCropContext(prev => prev ? { ...prev, currentImageUrl: croppedImageUrl } : null);
```
This keeps `currentImageUrl` in sync with the latest applied crop, so reopening the modal for the same item is correctly detected and `originalCropImage` (the true original) is preserved.

---

### Bug Fix: Image Not Cleared After Remove + Save in Edit Modal ✅
**Date Fixed:** March 18, 2026
**File:** `lib/tutorial-store.ts` — `getTutorialState` function

**Root Cause:**
`getTutorialState` used `||` (OR operator) for the thumbnail fallback chains on colours and papers:
```ts
// Colour (line 280):
thumbnailDataUrl: globalColourData?.thumbnailDataUrl || printerColourData?.thumbnailDataUrl || "",
// Paper (line 293):
thumbnailDataUrl: globalPaperData?.thumbnailDataUrl || paperData.thumbnailDataUrl || "",
```
`||` treats `""` (empty string) as falsy. So when a thumbnail was cleared to `""` in the global Firestore document, the expression fell through to the printer-specific document's `thumbnailDataUrl`. If that document contained an old `thumbnailDataUrl` (possible with migrated or legacy data), the cleared thumbnail appeared to persist.

**Fix:**
Changed `||` to `??` (nullish coalescing) for these two fallback chains. `??` only falls through on `null` or `undefined`, so `""` is now preserved as-is:
```ts
thumbnailDataUrl: globalColourData?.thumbnailDataUrl ?? printerColourData?.thumbnailDataUrl ?? "",
thumbnailDataUrl: globalPaperData?.thumbnailDataUrl ?? paperData.thumbnailDataUrl ?? "",
```

---

### Bug Fix: Crop Box Intermittently Not Appearing ✅
**Date Fixed:** March 18, 2026
**File:** `app/admin/page.tsx` — crop modal overlay rendering

**Root Cause:**
The crop box overlay called `getBoundingClientRect()` directly inside the render function to calculate the displayed image dimensions and scale the crop box. When `setCropImageWidth/Height` fired (from `openCropModal`'s `img.onload`), it triggered a React re-render — but at that moment the modal's `<img>` element had not yet been laid out by the browser. `getBoundingClientRect()` returned `{width: 0, height: 0}`, making `scaleX` and `scaleY` both zero, so the crop box was rendered at 0×0 (invisible). This was intermittent because it depended on browser paint timing.

**Fix:**
Added a `cropImgReady` boolean state (starts `false`). The modal's `<img>` element now has an `onLoad` handler that sets `cropImgReady = true` — this fires only after the browser has finished loading and laying out the image, guaranteeing `getBoundingClientRect()` returns real dimensions. The overlay is now gated on `cropImgReady` in addition to `cropImageWidth > 0 && cropImageHeight > 0`. `openCropModal` and `resetCropBox` both reset `cropImgReady` to `false` when a new image is set.

### Feature: Generic Image Placeholder ✅
**Status:** IMPLEMENTED

**Files Modified:**
- `app/page.tsx` (user-facing)
  - Added `import ImageIcon from "@mui/icons-material/Image"`
  - Printer cards: Now always show image area; displays a light blue placeholder with image icon when no thumbnail
  - Paper cards: Same placeholder treatment
  - Colour cards: Same placeholder treatment
- `app/admin/page.tsx`
  - Added `Image as ImagePlaceholderIcon` to MUI icon imports
  - Colour table rows (both instances): Enhanced grey box placeholder to show `ImagePlaceholderIcon` (18px, `#b0c4cc` colour, `#e8f4f8` bg)
  - Note: Printer/Paper rows in admin already use MUI `Avatar` which shows letter initials as fallback

---

## Feature: Alternate Preview ✅
**Date Implemented:** March 18, 2026
**Status:** IMPLEMENTED

**What it does:**
- Adds an "ALT PREVIEW" button in the CMS sidebar, below the existing PREVIEW button
- When clicked, generates a new unique time-limited token (3-hour expiry), invalidating any previous token
- Opens the user-facing page in a new tab with all content visible — including unpublished printers, papers, colours, and steps
- The link navigates directly to whatever is currently selected in the CMS columns (based on breadcrumb state)
- A persistent orange banner at the top of the page reads "PREVIEW MODE — Includes unpublished content"
- Preview navigation does not overwrite the user's saved localStorage progress

**URL format:**
```
/?previewToken=<token>&printerId=<id>&paperId=<id>&colourId=<id>
```
(only IDs relevant to the current selection depth are included)

**Token behaviour:**
- Stored in Firestore `previewTokens` collection with `createdAt` and `expiresAt` fields
- Only one valid token at a time — generating a new one deletes all previous tokens
- Expires automatically after 3 hours (validated server-side on each page load)

**Files Modified/Created:**
- `lib/tutorial-store.ts` — Added `previewTokensCollection()`, `createPreviewToken()`, `validatePreviewToken()`
- `app/api/preview-token/route.ts` — **New file**: POST endpoint that calls `createPreviewToken()` and returns token
- `app/api/tutorial/route.ts` — GET handler now accepts `?previewToken=` query param; validates token and returns `isPreviewMode: true/false` alongside state
- `app/page.tsx` — Reads `previewToken`/`printerId`/`paperId`/`colourId` from URL on load; fetches with token; skips published filters when `isPreviewMode`; auto-navigates to specified item; shows persistent orange preview banner; does not save preview navigation to localStorage
- `app/admin/page.tsx` — Added `PageviewIcon` import; added `generateAltPreview()` handler; added ALT PREVIEW button (both collapsed icon and expanded label variants)

---

---

## Feature: Full-Screen Loading Indicator on Initial Page Load

**Date Implemented:** March 19, 2026 (Session 4)
**Type:** UX Enhancement

**Request:** When the frontend page first loads (after clicking "Preview from start" or "Preview current page" in the CMS), display a full-screen loading indicator and hide the page until all content for the initial view is ready.

**Behaviour:**
- A full-screen overlay (`#FAFBFC` background, centred spinner) shows immediately on load
- The page is completely hidden until loading is finished — no partial renders
- Once data is fetched and images are preloaded, the overlay disappears and the fully-rendered page appears
- Only the images for the **initial view** are preloaded (not all images in the dataset):
  - Printer selection view → preload all visible printer thumbnails
  - Paper selection view → preload papers for the selected printer
  - Colour selection view → preload colours for the selected paper
  - Steps view → preload the first step image only
- Navigation within the app (clicking between views) is unaffected — no loading screen on in-app transitions

**Loading Indicator Style (MD3-inspired):**
- Two stacked `CircularProgress` components from MUI v5:
  - Static `determinate` at 100% for the faint track ring (`rgba(0, 157, 201, 0.15)`)
  - Animated indeterminate on top with `strokeLinecap: "round"` for MD3 rounded caps
- Uses existing brand colour `#009DC9`

**Technical Notes:**
- `preloadImages(urls)` helper function uses `new window.Image()` to preload each URL; `onload` and `onerror` both count as done (broken images never block the page)
- `loadData` reads localStorage directly (not from React state) to determine the initial view for non-preview loads — avoids relying on async state updates
- For preview mode, URL params (`printerId`, `paperId`, `colourId`) determine the initial view
- Since thumbnails are stored as base64 data URLs, preloading triggers decode only — no extra network requests

**Files Modified:**
- `app/page.tsx` — Added `preloadImages` helper; modified `loadData` to collect and preload initial-view images before setting state; added full-screen MD3 loading overlay (`if (loading) return ...`); removed three inline loading blocks from printer/paper/colour views; simplified `!loading &&` guards

---

## 📌 Pinned: Future Feature — Reset Image to Original After Save

**Pinned:** March 18, 2026
**Status:** Not started — revisit later

**Request:** After cropping and saving an image, admins should be able to revert back to the original (pre-crop) image at any time.

**Current Limitation:** The original image only lives in React state (`originalCropImage`) and is lost when the modal closes or the page reloads. Firestore only stores one field — `thumbnailDataUrl` — with no backup of the pre-crop original.

**Proposed Approach:**
- Add `originalThumbnailDataUrl` field to Printer, Paper, and Colour Firestore documents
- On first crop save: write both `thumbnailDataUrl` (cropped) and `originalThumbnailDataUrl` (original)
- On subsequent crops: only update `thumbnailDataUrl`; leave `originalThumbnailDataUrl` unchanged
- Add a "Reset to Original" button in the Printer/Paper/Colour edit modals

**Files That Need Changing:**
- `lib/tutorial-store.ts` — add field to type definitions; update `updatePrinter/Paper/Colour` to write/preserve it; read it back in `getTutorialState`
- `app/api/tutorial/route.ts` — add `originalThumbnailDataUrl` to ActionPayload types for update actions
- `app/admin/page.tsx` — new state vars for original thumbnails; update `applyCrop` to capture original on first crop; add Reset to Original button in edit modals

**Risk:** Firestore has a 1 MB document size limit. Storing two base64 images per item doubles usage. Typical thumbnails (~200–400 KB as base64) should be fine, but large images could hit the limit.

**Estimated Effort:** 3–4 hours

---

**End of Progress Log**
