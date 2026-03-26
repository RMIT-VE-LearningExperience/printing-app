# Firebase Storage Wire-Up Plan

**Created:** March 26, 2026
**Status:** Pending — to be implemented before launch, after test data is wiped
**Prerequisites:** Firebase project with Storage bucket configured (`FIREBASE_STORAGE_BUCKET` env var already set)

---

## Overview

Currently all images (printer thumbnails, paper thumbnails, colour thumbnails, step images) are stored inline in Firestore as base64 data URL strings. This plan outlines migrating new uploads to Firebase Storage while keeping Firestore clean (storing short URLs instead of large base64 blobs).

The `resolveImageUrl()` utility in `lib/media-storage.ts` is already written and handles the core upload logic — it just needs to be wired into the store functions.

**When to implement:** After the test data wipe, before the app goes live. All new content will use Storage from day one — no migration of old base64 data is needed.

---

## Storage File Path Convention

Files will be stored using the following path structure. Each upload generates a UUID filename so that replacing an image creates a new file (the old one becomes an orphan, handled by the cleanup system).

```
thumbnails/printers/{printerId}/{uuid}.jpg
thumbnails/papers/{paperId}/{uuid}.jpg
thumbnails/colours/{colourId}/{uuid}.jpg
images/steps/{stepId}/{uuid}.jpg
```

**Why UUID filenames instead of fixed names (e.g. `thumbnail.jpg`):**
- Allows the old file to persist briefly as an orphan rather than being overwritten immediately
- The 30-day cleanup system then handles deletion safely
- Avoids cache-busting issues when images are updated

---

## Step 1 — Wire Up `resolveImageUrl` in Store Functions

**File:** `lib/tutorial-store.ts`

For each store function that writes an image field, wrap the value with `resolveImageUrl()` before saving to Firestore. The utility already handles both cases — if the value is already a `https://` URL it passes through unchanged; if it's a base64 data URL it uploads to Storage and returns the download URL.

### Functions to update

| Function | Field | Storage path |
|----------|-------|--------------|
| `addPrinter()` | `thumbnailDataUrl` | `thumbnails/printers/{newPrinterId}/{uuid}.jpg` |
| `updatePrinter()` | `thumbnailDataUrl` | `thumbnails/printers/{printerId}/{uuid}.jpg` |
| `addPaper()` | `thumbnailDataUrl` | `thumbnails/papers/{newPaperId}/{uuid}.jpg` |
| `updatePaper()` | `thumbnailDataUrl` | `thumbnails/papers/{paperId}/{uuid}.jpg` |
| `addColour()` | `thumbnailDataUrl` | `thumbnails/colours/{newColourId}/{uuid}.jpg` |
| `updateColour()` | `thumbnailDataUrl` | `thumbnails/colours/{colourId}/{uuid}.jpg` |
| `addStep()` | `imageDataUrl` | `images/steps/{newStepId}/{uuid}.jpg` |
| `updateStep()` | `imageDataUrl` | `images/steps/{stepId}/{uuid}.jpg` |

### Code pattern (example for `addPrinter`)

```typescript
import { resolveImageUrl } from "./media-storage";
import { randomUUID } from "crypto";

export async function addPrinter(
  name: string,
  description?: string,
  thumbnailDataUrl?: string,
): Promise<TutorialState> {
  const newPrinterId = generateId();
  const storedThumbnailUrl = await resolveImageUrl(
    thumbnailDataUrl,
    `thumbnails/printers/${newPrinterId}/${randomUUID()}.jpg`,
  );

  await printersCollection().doc(newPrinterId).set({
    name: normalizedName,
    description: normalizedDescription,
    thumbnailDataUrl: storedThumbnailUrl, // now a https:// URL
    published: true,
    lastModified: now,
    createdAt: FieldValue.serverTimestamp(),
  });

  // ...
}
```

### What happens when an image is replaced (update functions)

When `updatePrinter()` is called with a new image, the new upload goes to a new UUID path in Storage. The **old file's URL is still in Firestore until overwritten** — but once the Firestore field is updated, the old Storage file becomes an orphan. The cleanup system (Step 3) handles its eventual deletion.

---

## Step 2 — Firebase Storage Security Rules

Set rules so that only the server-side Admin SDK can write to Storage (uploads happen server-side via `lib/tutorial-store.ts`), while public read access is allowed for serving images to users.

**File:** `storage.rules` (create in project root, deploy via Firebase CLI)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Thumbnails and step images — public read, no client write
    match /thumbnails/{allPaths=**} {
      allow read: if true;
      allow write: if false; // server-side Admin SDK bypasses these rules
    }

    match /images/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

> Note: Firebase Admin SDK (used in `lib/tutorial-store.ts`) bypasses Storage security rules entirely — these rules only apply to client-side Firebase SDKs.

---

## Step 3 — Orphan Tracking & 30-Day Auto-Delete Cleanup System

When an image is replaced or a record is deleted, the old Storage file is no longer referenced. Rather than deleting it immediately (which risks data loss if something goes wrong), it is marked as an orphan with a timestamp. A scheduled function then permanently deletes it after 30 days.

### 3a — Orphaned Files Firestore Collection

Create a `orphanedStorageFiles` collection in Firestore. Each document records a file that is no longer in use.

```typescript
// Document shape in Firestore: orphanedStorageFiles/{docId}
type OrphanedStorageFile = {
  storagePath: string;   // e.g. "thumbnails/printers/abc123/uuid.jpg"
  orphanedAt: Timestamp; // when it became unreferenced
  reason: string;        // e.g. "printer deleted", "thumbnail replaced"
};
```

### 3b — Marking Orphans (in `lib/tutorial-store.ts`)

Add a helper that writes to the `orphanedStorageFiles` collection:

```typescript
async function markOrphan(storagePath: string, reason: string): Promise<void> {
  if (!storagePath || !storagePath.startsWith("https://firebasestorage")) return;
  // Extract the Storage path from the download URL
  const pathMatch = storagePath.match(/\/o\/(.+?)\?/);
  if (!pathMatch) return;
  const decodedPath = decodeURIComponent(pathMatch[1]);
  await db.collection("orphanedStorageFiles").add({
    storagePath: decodedPath,
    orphanedAt: FieldValue.serverTimestamp(),
    reason,
  });
}
```

Call `markOrphan()` in these situations:

| Trigger | Old value to mark |
|---------|------------------|
| `updatePrinter()` called with new thumbnail | Previous `thumbnailDataUrl` from Firestore |
| `deletePrinter()` | `thumbnailDataUrl` of the deleted printer |
| `updatePaper()` called with new thumbnail | Previous `thumbnailDataUrl` |
| `deletePaper()` | `thumbnailDataUrl` of the deleted paper |
| `updateColour()` called with new thumbnail | Previous `thumbnailDataUrl` |
| `deleteColour()` | `thumbnailDataUrl` of the deleted colour |
| `updateStep()` called with new image | Previous `imageDataUrl` |
| `deleteStep()` | `imageDataUrl` of the deleted step |

### 3c — Scheduled Cleanup Cloud Function

Create a Firebase Cloud Function that runs on a schedule (daily at midnight) and permanently deletes any orphaned files older than 30 days.

**File:** `functions/src/cleanupOrphanedImages.ts` (new Firebase Functions project, or add to existing)

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { initializeApp } from "firebase-admin/app";

initializeApp();

const db = getFirestore();
const storage = getStorage();

export const cleanupOrphanedImages = onSchedule(
  {
    schedule: "0 0 * * *", // daily at midnight
    timeZone: "Australia/Melbourne",
    timeoutSeconds: 300,
  },
  async () => {
    const thirtyDaysAgo = Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );

    const snapshot = await db
      .collection("orphanedStorageFiles")
      .where("orphanedAt", "<=", thirtyDaysAgo)
      .get();

    if (snapshot.empty) {
      console.log("No orphaned files to clean up.");
      return;
    }

    const bucket = storage.bucket();
    const results = await Promise.allSettled(
      snapshot.docs.map(async (doc) => {
        const { storagePath } = doc.data() as { storagePath: string };
        try {
          await bucket.file(storagePath).delete();
          await doc.ref.delete();
          console.log(`Deleted orphaned file: ${storagePath}`);
        } catch (error) {
          // File may already be gone — still remove the Firestore record
          if ((error as { code?: number }).code === 404) {
            await doc.ref.delete();
            console.log(`File already gone, removed record: ${storagePath}`);
          } else {
            throw error;
          }
        }
      }),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error(`${failed.length} file(s) failed to delete.`);
    }

    console.log(
      `Cleanup complete: ${snapshot.size} record(s) processed, ${failed.length} failed.`,
    );
  },
);
```

### 3d — Safety Net Audit (Weekly)

As a belt-and-suspenders check, a second scheduled function runs weekly to catch any orphans that were missed (e.g. if a record was deleted outside of the app). It scans all Storage files and checks if their URL appears in any Firestore document.

```typescript
export const auditOrphanedImages = onSchedule(
  {
    schedule: "0 2 * * 0", // weekly, Sunday 2am
    timeZone: "Australia/Melbourne",
    timeoutSeconds: 540,
  },
  async () => {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles();

    // Collect all image URLs currently in Firestore
    const [printers, papers] = await Promise.all([
      db.collection("printers").get(),
      db.collection("papers").get(),
    ]);

    const referencedUrls = new Set<string>();

    printers.docs.forEach((d) => {
      if (d.data().thumbnailDataUrl) referencedUrls.add(d.data().thumbnailDataUrl as string);
    });

    papers.docs.forEach((d) => {
      if (d.data().thumbnailDataUrl) referencedUrls.add(d.data().thumbnailDataUrl as string);
      // colours and steps are subcollections — extend this to fetch them too
    });

    // Mark any Storage file not referenced in Firestore as an orphan
    for (const file of files) {
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;
      const isReferenced = [...referencedUrls].some((url) => url.includes(encodeURIComponent(file.name)));

      if (!isReferenced) {
        const [metadata] = await file.getMetadata();
        const createdAt = new Date(metadata.timeCreated as string);
        const ageMs = Date.now() - createdAt.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        // Only mark as orphan if file is older than 1 day (grace period for new uploads)
        if (ageDays > 1) {
          const existing = await db
            .collection("orphanedStorageFiles")
            .where("storagePath", "==", file.name)
            .get();

          if (existing.empty) {
            await db.collection("orphanedStorageFiles").add({
              storagePath: file.name,
              orphanedAt: Timestamp.now(),
              reason: "audit: not referenced in Firestore",
            });
            console.log(`Audit marked orphan: ${file.name}`);
          }
        }
      }
    }
  },
);
```

---

## Step 4 — Deployment Checklist

Before going live, complete the following:

- [ ] Wipe all test data from Firestore (printers, papers, colours, steps, deletedItems)
- [ ] Wire `resolveImageUrl()` into all 8 store functions (Step 1)
- [ ] Add `markOrphan()` helper and call it in all delete/update functions (Step 3b)
- [ ] Deploy Firebase Storage security rules (`firebase deploy --only storage`)
- [ ] Set up Firebase Functions project and deploy `cleanupOrphanedImages` and `auditOrphanedImages`
- [ ] Verify `FIREBASE_STORAGE_BUCKET` env var is set in App Hosting environment
- [ ] Test: upload a thumbnail, confirm URL (not base64) is saved to Firestore
- [ ] Test: replace a thumbnail, confirm old path appears in `orphanedStorageFiles`
- [ ] Test: delete a record, confirm its image path appears in `orphanedStorageFiles`
- [ ] Test: manually trigger cleanup function, confirm files older than 30 days are deleted

---

## Files to Create / Modify

| File | Action | Notes |
|------|--------|-------|
| `lib/tutorial-store.ts` | Modify | Add `resolveImageUrl()` calls and `markOrphan()` helper |
| `lib/media-storage.ts` | Already exists | No changes needed — utility is ready |
| `storage.rules` | Create | Firebase Storage security rules |
| `functions/src/cleanupOrphanedImages.ts` | Create | Scheduled cleanup + audit Cloud Functions |
| `functions/package.json` | Create | Firebase Functions project config |

---

## Notes

- The 30-day window is intentionally generous — it gives time to notice accidental deletions before files are permanently gone
- The audit function is a safety net only; the primary orphan tracking is via `markOrphan()` in the store functions
- `resolveImageUrl()` in `lib/media-storage.ts` already sets `cache-control: public, max-age=31536000, immutable` on uploaded files — browsers will cache images aggressively, reducing Storage read costs
- Firebase Admin SDK uploads (server-side) are not subject to Storage security rules, so no auth changes are needed for the upload path
