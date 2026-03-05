# Per-Printer Publish Status Implementation Plan

## Current Data Structure

```typescript
type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;  // ❌ GLOBAL - same for all printers
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
};

type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;  // ❌ GLOBAL - same for all papers
  lastModified: Date;
  createdAt?: Date;
  steps: Step[];
};

type PrinterPaper = {
  paperId: string;
  colours: Colour[];  // colours don't know about printer context
};

type Printer = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  papers: PrinterPaper[];
};
```

## Proposed New Data Structure

```typescript
type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  // ✅ published field REMOVED - now stored in relationship
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
};

type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  // ✅ published field REMOVED - now stored in relationship
  lastModified: Date;
  createdAt?: Date;
  steps: Step[];
};

type PrinterPaper = {
  paperId: string;
  published: boolean;  // ✅ NEW - paper's published status per printer
  colours: PrinterPaperColour[];  // ✅ CHANGED - new type
};

type PrinterPaperColour = {
  colourId: string;
  published: boolean;  // ✅ NEW - colour's published status per paper-printer
  steps: Step[];
};

type Printer = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  papers: PrinterPaper[];  // ✅ Now contains published status
};
```

## Firebase Schema Changes

### Current Firestore Structure
```
/papers/{paperId}
  - id
  - name
  - published ❌
  - lastModified
  - ...

/printers/{printerId}
  - id
  - name
  - published
  - papers: [
      { paperId, colours: [...] }
    ]
  - ...
```

### New Firestore Structure
```
/papers/{paperId}
  - id
  - name
  - lastModified
  - ...
  (NO published field)

/printers/{printerId}
  - id
  - name
  - published
  - papers: [
      {
        paperId,
        published: true/false,  ✅ NEW
        colours: [
          {
            colourId,
            published: true/false,  ✅ NEW
            steps: [...]
          }
        ]
      }
    ]
  - ...
```

## Code Changes Required

### 1. Type Definitions (app/admin/page.tsx - lines 52-97)

```typescript
// ADD new type
type PrinterPaperColour = {
  colourId: string;
  published: boolean;
  steps: Step[];
};

// UPDATE Paper type
type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  // published: boolean; ❌ REMOVE
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
};

// UPDATE Colour type
type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  // published: boolean; ❌ REMOVE
  lastModified: Date;
  createdAt?: Date;
  steps: Step[];
};

// UPDATE PrinterPaper type
type PrinterPaper = {
  paperId: string;
  published: boolean;  // ✅ ADD
  colours: PrinterPaperColour[];  // ✅ CHANGE from Colour[]
};
```

### 2. Handler Functions (app/admin/page.tsx - lines 781-821)

#### Current handleUnpublishPaper (lines 781-792)
```typescript
// ❌ CURRENT - updates Paper globally
const handleUnpublishPaper = async (paperId: string, currentStatus?: boolean) => {
  const newStatus = !currentStatus;
  try {
    await runAction("updatePaper", {
      paperId,
      published: newStatus,
    });
  } catch {
    // Error already set in runAction
  }
};
```

#### New handleUnpublishPaper
```typescript
// ✅ NEW - updates paper in specific printer
const handleUnpublishPaper = async (paperId: string, currentStatus?: boolean) => {
  if (!selectedPrinterId) return;  // Must have printer context
  const newStatus = !currentStatus;

  try {
    await runAction("updatePaperInPrinter", {
      printerId: selectedPrinterId,
      paperId,
      published: newStatus,
    });
  } catch {
    // Error already set in runAction
  }
};
```

#### Current handleUnpublishColour (lines 807-821)
```typescript
// ✅ STAYS SAME - but params change slightly
const handleUnpublishColour = async (colourId: string, currentStatus?: boolean) => {
  if (!selectedPrinterId || !selectedPaperId) return;
  const newStatus = !currentStatus;

  try {
    await runAction("updateColourInPrinterPaper", {  // ✅ RENAME action
      printerId: selectedPrinterId,
      paperId: selectedPaperId,
      colourId,
      published: newStatus,
    });
  } catch {
    // Error already set in runAction
  }
};
```

### 3. Table Display Changes

#### Papers Table (lines 2064-2084)
```typescript
// ✅ CHANGE: Read published status from PrinterPaper, not Paper
<TableCell align="center">
  <Button
    size="small"
    variant="contained"
    onClick={(e) => {
      e.stopPropagation();
      // Get published status from the PrinterPaper relationship
      const printerPaper = selectedPrinter?.papers.find(pp => pp.paperId === paper.id);
      void handleUnpublishPaper(paper.id, printerPaper?.published);
    }}
    sx={{
      backgroundColor: printerPaper?.published ? "#d32f2f" : "#388e3c",
      color: "#ffffff",
      fontWeight: 600,
      textTransform: "none",
      "&:hover": {
        backgroundColor: printerPaper?.published ? "#c62828" : "#2e7d32"
      }
    }}
  >
    {printerPaper?.published ? "Unpublished" : "Publish"}
  </Button>
</TableCell>
```

#### Colours Table (lines 2197-2219)
```typescript
// ✅ CHANGE: Read published status from PrinterPaperColour, not Colour
<TableCell align="center">
  <Button
    size="small"
    variant="contained"
    onClick={(e) => {
      e.stopPropagation();
      // Get published status from the PrinterPaperColour relationship
      const ppColour = selectedPrinterPaper?.colours.find(c => c.colourId === colour.id);
      void handleUnpublishColour(colour.id, ppColour?.published);
    }}
    sx={{
      backgroundColor: ppColour?.published ? "#d32f2f" : "#388e3c",
      color: "#ffffff",
      fontWeight: 600,
      textTransform: "none",
      "&:hover": {
        backgroundColor: ppColour?.published ? "#c62828" : "#2e7d32"
      }
    }}
  >
    {ppColour?.published ? "Unpublished" : "Publish"}
  </Button>
</TableCell>
```

### 4. Full Paper List Display

For the FULL PAPER LIST page, display which printers have each paper published:
```typescript
// NEW column in Full Paper List
<TableCell>
  <Stack spacing={0.5}>
    {tutorialState.papers.map((paper) => {
      const activePrinters = tutorialState.printers
        .filter(printer =>
          printer.papers.some(pp => pp.paperId === paper.id && pp.published)
        )
        .map(p => p.name);

      return (
        <Typography variant="caption" key={paper.id}>
          {activePrinters.length > 0 ? activePrinters.join(", ") : "Not active"}
        </Typography>
      );
    })}
  </Stack>
</TableCell>
```

## Backend Firebase Functions Required

### New/Updated Cloud Functions

1. **updatePaperInPrinter(printerId, paperId, published)**
   - Updates `printers/{printerId}/papers[paperId].published`
   - Called when toggling paper status

2. **updateColourInPrinterPaper(printerId, paperId, colourId, published)**
   - Updates `printers/{printerId}/papers[paperId]/colours[colourId].published`
   - Called when toggling colour status

3. **Data Migration Function**
   - Migrates existing `Paper.published` → `Printer.papers[x].published`
   - Migrates existing `Colour.published` → `Printer.papers[x].colours[x].published`

## Implementation Steps

1. ✅ **Phase 1: Type Definition Updates**
   - Add PrinterPaperColour type
   - Remove published from Paper type
   - Remove published from Colour type
   - Update PrinterPaper type

2. **Phase 2: Backend Cloud Functions**
   - Create updatePaperInPrinter function
   - Update updateColourInPrinterPaper logic
   - Create data migration function

3. **Phase 3: Frontend Handler Updates**
   - Update handleUnpublishPaper function
   - Keep handleUnpublishColour same (just rename action)

4. **Phase 4: UI Display Updates**
   - Update Papers table to read from PrinterPaper.published
   - Update Colours table to read from PrinterPaperColour.published
   - Update FULL PAPER LIST to show active printers

5. **Phase 5: Data Migration**
   - Run migration to move published status to relationships
   - Verify all existing data converted correctly

6. **Phase 6: Testing**
   - Test publishing/unpublishing papers per printer
   - Test publishing/unpublishing colours per paper-printer
   - Verify FULL PAPER LIST displays correctly
   - Verify user-facing view shows correct cascade

## Benefits

✅ Papers can be published in one printer and unpublished in another
✅ Colours can be published in one paper-printer and unpublished in another
✅ Respects the hierarchy: Steps → Colours → Papers → Printers
✅ User-facing view only shows fully published chains
✅ Minimal UI format changes - mostly backend refactoring
