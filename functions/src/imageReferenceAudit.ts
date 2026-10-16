import type { Firestore, CollectionReference } from "firebase-admin/firestore";

type AuditBucket = {
  name: string;
  file(path: string): { exists(): Promise<[boolean]> };
};

type AuditLogger = Pick<Console, "log" | "warn">;

/** Parse the complete object name; substring URL matching is not safe. */
export function storagePathForBucket(value: unknown, bucketName: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "firebasestorage.googleapis.com") return null;
    const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
    if (!match || decodeURIComponent(match[1]) !== bucketName) return null;
    const path = decodeURIComponent(match[2]);
    return path.length ? path : null;
  } catch {
    return null;
  }
}

export function reportDisabledCleanup(logger: AuditLogger): void {
  logger.warn("Legacy Printing automatic image deletion is disabled; no queue or storage mutations performed.");
}

/** Read only the legacy schema, then check the objects it actually references. */
export async function auditLegacyImageReferences(
  db: Firestore,
  bucket: AuditBucket,
  logger: AuditLogger,
): Promise<{ referenced: number; existing: number; missing: string[] }> {
  const references = new Set<string>();
  const collect = (value: unknown): void => {
    if (typeof value === "string") {
      const path = storagePathForBucket(value, bucket.name);
      if (path) references.add(path);
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(collect);
    }
  };

  // Both global papers and the older printer-specific paper copies can contain
  // images. Inspect only known content descendants, never the shared queue.
  const readCollection = async (collection: CollectionReference, childCollections: string[]): Promise<void> => {
    const snapshot = await collection.get();
    for (const document of snapshot.docs) {
      collect(document.data());
      if (childCollections.length) {
        await readCollection(document.ref.collection(childCollections[0]), childCollections.slice(1));
      }
    }
  };
  await readCollection(db.collection("printers"), ["papers", "colours", "steps"]);
  await readCollection(db.collection("papers"), ["colours", "steps"]);

  let existing = 0;
  const missing: string[] = [];
  for (const path of references) {
    // Errors propagate and fail the audit; permission/server errors must never
    // be reported as proof that an image is missing.
    const [exists] = await bucket.file(path).exists();
    if (exists) existing++;
    else missing.push(path);
  }
  const report = { referenced: references.size, existing, missing };
  logger.log("Legacy Printing read-only image reference audit", report);
  return report;
}
