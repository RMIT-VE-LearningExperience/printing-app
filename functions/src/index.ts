import { initializeApp } from "firebase-admin/app";

initializeApp();

export { legacyPrintingCleanupOrphanedImages, legacyPrintingAuditOrphanedImages } from "./cleanupOrphanedImages";
