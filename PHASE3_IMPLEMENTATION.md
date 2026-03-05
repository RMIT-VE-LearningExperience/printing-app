# Phase 3: Backend Implementation Guide

## Overview
Phase 3 involves updating the Firestore backend (`lib/tutorial-store.ts`) to support per-printer publish status for papers and colors.

## Current Firestore Structure
```
/papers/{paperId}
  - name, description, thumbnailDataUrl, published ❌, lastModified, ...

/printers/{printerId}
  - name, description, published, ...
  - /papers/{paperId}
    - paperId, colours: Colour[] ❌
    - /colours/{colourId}
      - name, description, published ❌, lastModified, ...
      - /steps/{stepId}
```

## New Firestore Structure
```
/papers/{paperId}
  - name, description, thumbnailDataUrl, colours: Colour[], lastModified, ...
  (NO published field)

/printers/{printerId}
  - name, description, published, ...
  - /papers/{paperId}
    - paperId, published ✅, colours: PrinterPaperColour[]
    - /colours/{colourId}
      - colourId, published ✅, steps
      (NO name, description, thumbnailDataUrl - use colourId to look up)
```

## Implementation Steps

### Step 1: Update Type Definitions
**File:** `lib/tutorial-store.ts` (lines 20-45)

```typescript
// OLD
export type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;  // ❌ REMOVE
  lastModified: Date;
  createdAt?: Date;
  steps: Step[];
};

export type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;  // ❌ REMOVE
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
};

export type PrinterPaper = {
  paperId: string;
  colours: Colour[];  // ❌ CHANGE
};

// NEW
export type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  // published removed
  lastModified: Date;
  createdAt?: Date;
  steps: Step[];
};

export type PrinterPaperColour = {  // ✅ NEW
  colourId: string;
  published: boolean;
  steps: Step[];
};

export type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  // published removed
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
  colours: Colour[];  // ✅ ADD
};

export type PrinterPaper = {
  paperId: string;
  published: boolean;  // ✅ ADD
  colours: PrinterPaperColour[];  // ✅ CHANGE
};
```

### Step 2: Update getTutorialState()
**File:** `lib/tutorial-store.ts` (lines 142-245)

**Changes:**
1. Remove `published` from Paper mapping (line 153)
2. Add `colours` array to Paper mapping
3. Update PrinterPaper mapping to include `published` (lines 205-208)
4. Update colour mapping to use `PrinterPaperColour` structure
5. Change colour reference from `colourDoc.id` to `colourData.colourId`

**Key change:** When reading colours from printer papers, they should return PrinterPaperColour with published status

### Step 3: Create updatePaperInPrinter() Function
**Location:** After updatePaper() (around line 386)

```typescript
export async function updatePaperInPrinter(
  printerId: string,
  paperId: string,
  published: boolean,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const paperRef = printerRef.collection("papers").doc(paperId);

    // Update the published status in the printer's paper doc
    await paperRef.update({
      published,
    });

    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to update paper in printer: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
```

### Step 4: Update/Rename updateColour()
**File:** `lib/tutorial-store.ts` (line 526)

**Current implementation is mostly correct!** Only needs:
1. Rename to `updateColourInPrinterPaper` (or keep both names)
2. When updating `published`, ensure it updates the correct location
3. The current implementation already has proper printer/paper context

**No major changes needed** - updateColour already stores published in the right place at `printerRef.collection("papers").doc(paperId).collection("colours").doc(colourId)`

### Step 5: Update updatePaper() Function
**File:** `lib/tutorial-store.ts` (line 351)

**Remove:** The `published` parameter handling from updatePaper()

```typescript
export async function updatePaper(
  paperId: string,
  name?: string,
  description?: string,
  thumbnailDataUrl?: string,
  // published?: boolean;  // ❌ REMOVE - use updatePaperInPrinter instead
): Promise<TutorialState> {
  // ... rest of function
  // Remove: if (published !== undefined) updates.published = published;
  // Remove: updates.lastModified = new Date();  (keep this for metadata updates only)
}
```

### Step 6: Update addColour() Function
**File:** `lib/tutorial-store.ts` (line 489)

**Required changes:**
1. When storing a new colour in printer's paper, set the structure as `PrinterPaperColour`
2. Store: `{ colourId, published: true, steps }`
3. Do NOT store: `name, description, thumbnailDataUrl` (these come from global Colour doc)

### Step 7: Update addPaperToPrinter() Function
**File:** `lib/tutorial-store.ts` (line 389)

**Required changes:**
1. When adding a paper to a printer, set `published: true` by default
2. Store structure: `{ paperId, published: true, colours: [] }`

### Step 8: Create Migration Function
**New function:** Add around line 950

```typescript
export async function migrateToPerPrinterPublishStatus(): Promise<void> {
  try {
    console.log("Starting migration to per-printer publish status...");

    // Step 1: Migrate Paper.published → PrinterPaper.published
    const papersSnapshot = await papersCollection().get();
    for (const paperDoc of papersSnapshot.docs) {
      const paperData = paperDoc.data();
      const published = paperData.published ?? true;

      // Update all printers that have this paper
      const printersSnapshot = await printersCollection().get();
      for (const printerDoc of printersSnapshot.docs) {
        const paperLink = printerDoc.ref.collection("papers").doc(paperDoc.id);
        const linkSnapshot = await paperLink.get();

        if (linkSnapshot.exists) {
          // Add published to the printer-paper doc
          await paperLink.update({ published });
          console.log(`Updated ${printerDoc.id}/papers/${paperDoc.id} - published: ${published}`);
        }
      }
    }

    // Step 2: Migrate Colour.published → PrinterPaperColour.published
    const printersSnapshot = await printersCollection().get();
    for (const printerDoc of printersSnapshot.docs) {
      const papersRef = printerDoc.ref.collection("papers");
      const paperDocsSnapshot = await papersRef.get();

      for (const paperDoc of paperDocsSnapshot.docs) {
        const coloursRef = paperDoc.ref.collection("colours");
        const colourDocsSnapshot = await coloursRef.get();

        for (const colourDoc of colourDocsSnapshot.docs) {
          const colourData = colourDoc.data();
          const published = colourData.published ?? true;

          // The colour doc in the printer-paper structure already has published
          // Just verify it's set correctly
          await colourDoc.ref.update({ published });
          console.log(`Updated ${printerDoc.id}/papers/${paperDoc.id}/colours/${colourDoc.id} - published: ${published}`);
        }
      }
    }

    console.log("Migration completed successfully!");
  } catch (error) {
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
```

## Functions Affected Summary

| Function | Changes Required | Priority |
|----------|-----------------|----------|
| getTutorialState() | Update mapping structure | HIGH |
| updatePaperInPrinter() | Create new function | HIGH |
| updatePaper() | Remove published parameter | HIGH |
| updateColour() | Verify structure (minimal) | MEDIUM |
| addPaperToPrinter() | Add published field | HIGH |
| addColour() | Update structure | HIGH |
| migrateToPerPrinterPublishStatus() | Create new function | HIGH |

## Testing Checklist

- [ ] Type definitions match between frontend and backend
- [ ] getTutorialState() returns correct structure
- [ ] updatePaperInPrinter() updates correct location
- [ ] updateColour() maintains correct location
- [ ] Migration preserves all existing published states
- [ ] New papers added to printers have published: true
- [ ] New colours have published: true by default
- [ ] Frontend can read and toggle published status
- [ ] Colours can have different status per paper-printer
- [ ] No data loss during migration

## Firestore Rules Update (Optional)

If you have Firestore security rules, they may need updating to reflect the new structure where `published` is at the relationship level rather than the object level.

## Deployment Order

1. Update type definitions
2. Update getTutorialState()
3. Create updatePaperInPrinter()
4. Update updatePaper()
5. Update addPaperToPrinter()
6. Update addColour()
7. Verify functions not yet mentioned
8. Create migration function
9. Test thoroughly
10. Run migration
11. Deploy frontend and backend together
