# Type Changes Impact Analysis

## Phase 1 Completed: ✅ Type Definition Updates

### Changes Made:
- ✅ Removed `published: boolean` from `Colour` type
- ✅ Removed `published: boolean` from `Paper` type
- ✅ Added new `PrinterPaperColour` type with `published: boolean`
- ✅ Updated `PrinterPaper` type to include `published: boolean` and changed `colours: PrinterPaperColour[]`

## Phase 2: Code Updates Required (Next Steps)

### 1. Papers Table - Line 2065-2087 (CRITICAL)
Currently reads `paper.published` from Paper object - needs to read from PrinterPaper relationship

```
Lines to update:
- Line 2075: handleUnpublishPaper call - passes paper.published
- Line 2078: backgroundColor styling - uses paper.published
- Line 2083: hover backgroundColor - uses paper.published  
- Line 2087: button text - uses paper.published
```

**Fix Required:**
Get published status from `selectedPrinter?.papers.find(pp => pp.paperId === paper.id)?.published`

### 2. Colours Table - Line 2201-2223 (CRITICAL)
Currently reads `colour.published` from Colour object - needs to read from PrinterPaperColour relationship

```
Lines to update:
- Line 2210: handleUnpublishColour call - passes colour.published
- Line 2213: backgroundColor styling - uses colour.published
- Line 2218: hover backgroundColor - uses colour.published
- Line 2222: button text - uses colour.published
```

**Fix Required:**
Get published status from `selectedPrinterPaper?.colours.find(c => c.colourId === colour.id)?.published`

### 3. Handler Functions - Lines 781-821 (IMPORTANT)

#### handleUnpublishPaper (Line 781)
Currently: `runAction("updatePaper", { paperId, published: newStatus })`
Needs to change to: `runAction("updatePaperInPrinter", { printerId, paperId, published: newStatus })`
Requires access to `selectedPrinterId` (which should already be available when viewing printer papers)

#### handleUnpublishColour (Line 807)
Already correct! Already passes printerId and paperId. Just the action name might change.

### 4. Colour Creation Logic (Minor Impact)
- `handleAddColourFromModal` (Line 824+): Creates new Colour, backend handles wrapping in PrinterPaperColour
- `handleEditColour` (Line 858+): Updates Colour, backend handles the relationship
- These should work as-is with backend changes

### 5. Full Paper List Display (NEW - Not yet implemented)
Need to show which printers have each paper published

## Build Errors Expected

After type changes, you will see TypeScript errors for:
- ❌ `paper.published` - Property 'published' does not exist on type 'Paper'
- ❌ `colour.published` - Property 'published' does not exist on type 'Colour'
- ❌ `colours: Colour[]` - Type mismatch, expecting `PrinterPaperColour[]`

These are expected and will be fixed in Phase 2.

## Firebase Backend Changes Required

1. **updatePaperInPrinter** - NEW function
   - Takes: printerId, paperId, published
   - Updates: printers/{printerId}/papers[paperId].published

2. **updateColourInPrinterPaper** - UPDATE existing
   - Currently: updateColour
   - Takes: printerId, paperId, colourId, published
   - Updates: printers/{printerId}/papers[paperId]/colours[colourId].published

3. **Data Migration** - CRITICAL
   - Migrate all Paper.published → Printer.papers[].published
   - Migrate all Colour.published → Printer.papers[].colours[].published

## Next Steps

Phase 2 involves:
1. Update handler functions (2-3 functions)
2. Update Papers table display (1 section)
3. Update Colours table display (1 section)
4. Update Full Paper List display (1 new section)

Total frontend changes: ~4 main sections
Backend requirements: 2-3 functions + 1 migration script
