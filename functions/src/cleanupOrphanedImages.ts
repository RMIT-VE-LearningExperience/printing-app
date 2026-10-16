import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { auditLegacyImageReferences, reportDisabledCleanup } from "./imageReferenceAudit";

// These names belong only to the legacy Printing app. The old unprefixed
// schedules are shared with other PATH apps and must stay paused.
export const legacyPrintingCleanupOrphanedImages = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Australia/Melbourne",
    timeoutSeconds: 60,
  },
  async () => {
    reportDisabledCleanup(console);
  },
);

/**
 * Read-only check of objects explicitly referenced by legacy Printing content.
 * There is no safe exclusive prefix for all historical legacy uploads, so this
 * audit deliberately does not list the shared bucket or identify orphan files.
 */
export const legacyPrintingAuditOrphanedImages = onSchedule(
  {
    schedule: "0 2 * * 0",
    timeZone: "Australia/Melbourne",
    timeoutSeconds: 540,
  },
  async () => {
    // This app's printers/papers schema is in the default database.
    await auditLegacyImageReferences(getFirestore(), getStorage().bucket(), console);
  },
);
