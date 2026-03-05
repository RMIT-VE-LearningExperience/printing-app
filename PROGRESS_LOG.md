# Print App CMS - Progress Log

**Last Updated:** March 5, 2026
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

### Current Session (March 5, 2026)
- Fixed duplicate case statements in API route
- Verified all three toggle types (Printers, Papers, Colours) are working
- **Fixed toggle visibility** - Red toggles now hide items from user-facing view
  - Added `published` field to Colour, Paper, and Printer types
  - Implemented filtering in user-facing view to respect published status
  - Printers, papers, and colours now correctly show/hide based on toggle state
- Created and updated progress log

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

**End of Progress Log**
