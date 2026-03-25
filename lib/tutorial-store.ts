import {
  FieldValue,
  type CollectionReference,
  type DocumentReference,
} from "firebase-admin/firestore";

import { db } from "./firebase-admin";

// ============= TYPE DEFINITIONS =============

export type Step = {
  id: string;
  name: string;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
  order: number;
};

export type Colour = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  lastModified: Date;
  createdAt?: Date;
  steps: Step[];
  published?: boolean; // Per-printer publish status (when part of printer.paper.colours)
};

export type PrinterPaperColour = {
  colourId: string;
  published: boolean;
  steps: Step[];
};

export type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
  colours: Colour[];
  published?: boolean; // Per-printer publish status
};

export type PrinterPaper = {
  paperId: string;
  published: boolean;
  colours: PrinterPaperColour[];
};

export type PrinterPaperWithPublished = Paper & {
  published: boolean;
};

export type Printer = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  papers: Paper[];
};

export type DeletedItem = {
  id: string;
  type: "printer" | "paper" | "colour" | "step";
  name: string;
  deletedAt: Date;
  deletedBy: string;
  data: unknown; // Stores the full item data for restoration
};

export type SectionSetting = {
  title: string;
  subtitle: string;
};

export type SectionSettings = {
  printers: SectionSetting;
  papers: SectionSetting;
  colours: SectionSetting;
};

export type TutorialState = {
  papers: Paper[];
  printers: Printer[];
  deletedItems?: DeletedItem[];
  homepageTitle?: string;
  homepageDescription?: string;
  sectionSettings?: SectionSettings;
};

// ============= UTILITY FUNCTIONS =============

function normalizeName(value: string, label: string): string {
  const result = value.trim();

  if (result.length < 2) {
    throw new Error(`${label} must be at least 2 characters long.`);
  }

  if (result.length > 100) {
    throw new Error(`${label} must be 100 characters or less.`);
  }

  return result;
}

function normalizeDescription(value: string | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length > 300) {
    throw new Error("Description must be 300 characters or less.");
  }
  return trimmed;
}

function generateId(): string {
  return db.collection("_tmp").doc().id;
}

// ============= COLLECTION REFERENCES =============

function papersCollection() {
  return db.collection("papers");
}

function printersCollection() {
  return db.collection("printers");
}

function deletedItemsCollection() {
  return db.collection("deletedItems");
}

function previewTokensCollection() {
  return db.collection("previewTokens");
}

// ============= PREVIEW TOKEN OPERATIONS =============

export async function createPreviewToken(): Promise<string> {
  // Delete all existing tokens so only one is valid at a time
  const existing = await previewTokensCollection().get();
  const batch = db.batch();
  existing.docs.forEach((doc) => batch.delete(doc.ref));

  // Generate a new token using a Firestore auto-ID as a random string
  const token = db.collection("_tmp").doc().id;
  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours

  batch.set(previewTokensCollection().doc(token), {
    token,
    createdAt: new Date(),
    expiresAt,
  });

  await batch.commit();
  return token;
}

export async function validatePreviewToken(token: string): Promise<boolean> {
  const doc = await previewTokensCollection().doc(token).get();
  if (!doc.exists) return false;
  const data = doc.data();
  if (!data) return false;
  const expiresAt: Date | null = data.expiresAt?.toDate?.() ?? null;
  if (!expiresAt || expiresAt < new Date()) return false;
  return true;
}

// ============= FIRESTORE HELPERS =============

async function assertDocExists(
  collection: CollectionReference,
  id: string,
  label: string,
): Promise<DocumentReference> {
  const ref = collection.doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error(`${label} with ID "${id}" not found.`);
  }

  return ref;
}

async function updatePrinterLastModified(printerId: string): Promise<void> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  await printerRef.update({
    lastModified: new Date(),
  });
}

// ============= STATE RETRIEVAL =============

export async function getTutorialState(): Promise<TutorialState> {
  try {
    // Get all papers (global definitions) with their colours
    console.log("[getTutorialState] Starting to fetch papers...");
    const papersSnapshot = await papersCollection().get();
    console.log(`[getTutorialState] Found ${papersSnapshot.size} global papers`);

    const papers: Paper[] = await Promise.all(
      papersSnapshot.docs.map(async (doc) => {
        const data = doc.data();

        // Get all colours for this paper (without orderBy to avoid composite index requirement)
        const coloursRef = doc.ref.collection("colours");
        const colourDocsSnapshot = await coloursRef.get();
        console.log(`[getTutorialState] Paper "${data.name}" (${doc.id}): Found ${colourDocsSnapshot.size} colours`);

        const colours: Colour[] = await Promise.all(
          colourDocsSnapshot.docs.map(async (colourDoc) => {
            const colourData = colourDoc.data();

            // Get steps for this colour (without orderBy - sort client-side)
            const stepsRef = colourDoc.ref.collection("steps");
            const stepsSnapshot = await stepsRef.get();

            const steps: Step[] = stepsSnapshot.docs
              .map((stepDoc) => {
                const stepData = stepDoc.data();
                return {
                  id: stepDoc.id,
                  name: stepData.name || `Step ${stepDoc.id}`,
                  title: stepData.title,
                  contentHtml: stepData.contentHtml,
                  imageDataUrl: stepData.imageDataUrl,
                  order: stepData.order ?? 0,
                };
              })
              .sort((a, b) => a.order - b.order);

            return {
              id: colourDoc.id,
              name: colourData.name,
              description: colourData.description || "",
              thumbnailDataUrl: colourData.thumbnailDataUrl || "",
              lastModified: colourData.lastModified?.toDate() || new Date(),
              createdAt: colourData.createdAt?.toDate() || new Date(),
              steps,
            };
          }),
        );

        return {
          id: doc.id,
          name: data.name,
          description: data.description || "",
          thumbnailDataUrl: data.thumbnailDataUrl || "",
          lastModified: data.lastModified?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || data.lastModified?.toDate() || new Date(),
          modifiedBy: data.modifiedBy || "system",
          colours,
        };
      }),
    );

    // Get all printers with their papers
    console.log("[getTutorialState] Starting to fetch printers...");
    const printersSnapshot = await printersCollection().get();
    console.log(`[getTutorialState] Found ${printersSnapshot.size} printers`);

    const printers: Printer[] = await Promise.all(
      printersSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const papersRef = doc.ref.collection("papers");
        const paperDocsSnapshot = await papersRef.get();
        console.log(`[getTutorialState] Printer "${data.name}" (${doc.id}): Found ${paperDocsSnapshot.size} printer-specific papers`);

        const papersWithDetails: Paper[] = await Promise.all(
          paperDocsSnapshot.docs.map(async (paperDoc) => {
            const paperData = paperDoc.data();
            const paperId = paperData.paperId;

            // Fetch the global paper details
            const globalPaperDoc = await papersCollection().doc(paperId).get();
            const globalPaperData = globalPaperDoc.exists ? globalPaperDoc.data() : null;

            const coloursRef = paperDoc.ref.collection("colours");
            // Fetch WITHOUT orderBy to avoid composite index requirement - sort client-side instead
            const colourDocsSnapshot = await coloursRef.get();
            console.log(`[getTutorialState] Printer "${data.name}" > Paper "${globalPaperData?.name || 'Unknown'}" (${paperId}): Found ${colourDocsSnapshot.size} colours`);

            const colours: Colour[] = await Promise.all(
              colourDocsSnapshot.docs.map(async (colourDoc) => {
                const colourId = colourDoc.id;
                const printerColourData = colourDoc.data();

                // Fetch colour metadata from the GLOBAL colour (not printer-specific colour)
                // Printer-specific colours only have colourId and published status
                // Global colours have name, description, thumbnail, and steps
                const globalColourRef = globalPaperDoc.ref.collection("colours").doc(colourId);
                const globalColourSnapshot = await globalColourRef.get();
                const globalColourData = globalColourSnapshot.exists ? globalColourSnapshot.data() : null;

                // Fetch steps from the GLOBAL colour
                const stepsRef = globalColourRef.collection("steps");
                // Fetch steps without orderBy - sort client-side
                const stepDocsSnapshot = await stepsRef.get();

                const steps: Step[] = stepDocsSnapshot.docs
                  .map((stepDoc) => {
                    const stepData = stepDoc.data();
                    return {
                      id: stepDoc.id,
                      name: stepData.name || `Step ${stepDoc.id}`,
                      title: stepData.title,
                      contentHtml: stepData.contentHtml,
                      imageDataUrl: stepData.imageDataUrl,
                      order: stepData.order ?? 0,
                    };
                  })
                  .sort((a, b) => a.order - b.order);

                return {
                  id: colourId,
                  name: globalColourData?.name || printerColourData?.name || "Unknown Colour",
                  description: globalColourData?.description || printerColourData?.description || "",
                  thumbnailDataUrl: globalColourData?.thumbnailDataUrl ?? printerColourData?.thumbnailDataUrl ?? "",
                  lastModified: globalColourData?.lastModified?.toDate() || printerColourData?.lastModified?.toDate?.() || new Date(),
                  createdAt: globalColourData?.createdAt?.toDate() || printerColourData?.createdAt?.toDate?.() || new Date(),
                  steps,
                  published: printerColourData.published ?? true,
                };
              }),
            );

            return {
              id: paperId,
              name: globalPaperData?.name || paperData.name || "Unknown Paper",
              description: globalPaperData?.description || paperData.description || "",
              thumbnailDataUrl: globalPaperData?.thumbnailDataUrl ?? paperData.thumbnailDataUrl ?? "",
              lastModified: globalPaperData?.lastModified?.toDate() || new Date(),
              createdAt: globalPaperData?.createdAt?.toDate() || new Date(),
              modifiedBy: globalPaperData?.modifiedBy || "system",
              colours,
              published: paperData.published ?? true,
            };
          }),
        );

        const papers: Paper[] = papersWithDetails;

        return {
          id: doc.id,
          name: data.name,
          description: data.description || "",
          thumbnailDataUrl: data.thumbnailDataUrl || "",
          published: data.published ?? true,
          lastModified: data.lastModified?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || data.lastModified?.toDate() || new Date(),
          papers,
        };
      }),
    );

    // Get deleted items
    const deletedSnapshot = await deletedItemsCollection().get();
    const deletedItems: DeletedItem[] = deletedSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        name: data.name,
        deletedAt: data.deletedAt?.toDate() || new Date(),
        deletedBy: data.deletedBy || "system",
        data: data.data,
      };
    });

    // Get homepage settings
    let homepageTitle = "";
    let homepageDescription = "";
    try {
      const settingsRef = db.collection("settings").doc("homepage");
      const settingsSnapshot = await settingsRef.get();
      if (settingsSnapshot.exists) {
        const settingsData = settingsSnapshot.data();
        homepageTitle = settingsData?.title || "";
        homepageDescription = settingsData?.description || "";
      }
    } catch (error) {
      console.warn("Failed to fetch homepage settings:", error);
    }

    // Get section settings
    let sectionSettings: SectionSettings | undefined;
    try {
      const sectionsRef = db.collection("settings").doc("sections");
      const sectionsSnapshot = await sectionsRef.get();
      if (sectionsSnapshot.exists) {
        const d = sectionsSnapshot.data();
        sectionSettings = {
          printers: { title: d?.printers?.title || "", subtitle: d?.printers?.subtitle || "" },
          papers:   { title: d?.papers?.title   || "", subtitle: d?.papers?.subtitle   || "" },
          colours:  { title: d?.colours?.title  || "", subtitle: d?.colours?.subtitle  || "" },
        };
      }
    } catch (error) {
      console.warn("Failed to fetch section settings:", error);
    }

    console.log("[getTutorialState] Successfully fetched all data");
    return { papers, printers, deletedItems, homepageTitle, homepageDescription, sectionSettings };
  } catch (error) {
    console.error("Error getting tutorial state:", error);
    throw new Error(`Failed to load tutorial state: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= HOMEPAGE SETTINGS =============

export async function updateHomepageSettings(title: string, description: string): Promise<void> {
  if (!title.trim()) {
    throw new Error("Homepage title is required");
  }
  if (!description.trim()) {
    throw new Error("Homepage description is required");
  }

  try {
    const settingsRef = db.collection("settings").doc("homepage");
    await settingsRef.set({
      title: title.trim(),
      description: description.trim(),
      updatedAt: new Date(),
    });
    console.log("[updateHomepageSettings] Successfully saved homepage settings");
  } catch (error) {
    console.error("Error updating homepage settings:", error);
    throw new Error(`Failed to save homepage settings: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= SECTION SETTINGS =============

export async function updateSectionSettings(
  section: "printers" | "papers" | "colours",
  title: string,
  subtitle: string
): Promise<void> {
  try {
    const sectionsRef = db.collection("settings").doc("sections");
    await sectionsRef.set(
      { [section]: { title: title.trim(), subtitle: subtitle.trim(), updatedAt: new Date() } },
      { merge: true }
    );
    console.log(`[updateSectionSettings] Saved ${section} settings`);
  } catch (error) {
    console.error("Error updating section settings:", error);
    throw new Error(`Failed to save section settings: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= PRINTER OPERATIONS =============

export async function addPrinter(
  name: string,
  description?: string,
  thumbnailDataUrl?: string,
): Promise<TutorialState> {
  try {
    const normalizedName = normalizeName(name, "Printer name");
    const normalizedDescription = normalizeDescription(description);
    const now = new Date();

    const newPrinterId = generateId();
    await printersCollection().doc(newPrinterId).set({
      name: normalizedName,
      description: normalizedDescription,
      thumbnailDataUrl: thumbnailDataUrl || "",
      published: true,
      lastModified: now,
      createdAt: FieldValue.serverTimestamp(),
    });

    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to add printer: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function updatePrinter(
  printerId: string,
  name?: string,
  description?: string,
  thumbnailDataUrl?: string,
  published?: boolean,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");

    const updates: Record<string, unknown> = {};
    if (name) updates.name = normalizeName(name, "Printer name");
    if (description !== undefined) updates.description = normalizeDescription(description);
    if (thumbnailDataUrl !== undefined) updates.thumbnailDataUrl = thumbnailDataUrl;
    if (published !== undefined) updates.published = published;

    if (Object.keys(updates).length === 0) {
      throw new Error("No updates provided");
    }

    updates.lastModified = new Date();

    await printerRef.update(updates);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to update printer: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= PAPER OPERATIONS (GLOBAL SHARED) =============

export async function addPaper(
  name: string,
  description?: string,
  thumbnailDataUrl?: string,
  printerIds?: string[],
): Promise<TutorialState> {
  try {
    const normalizedName = normalizeName(name, "Paper name");
    const normalizedDescription = normalizeDescription(description);

    // Check if paper with same name already exists
    const existingPaper = await papersCollection().where("name", "==", normalizedName).limit(1).get();
    if (!existingPaper.empty) {
      throw new Error(`Paper with name "${normalizedName}" already exists.`);
    }

    const newPaperId = generateId();
    const now = new Date();

    await papersCollection().doc(newPaperId).set({
      name: normalizedName,
      description: normalizedDescription,
      thumbnailDataUrl: thumbnailDataUrl || "",
      lastModified: now,
      createdAt: FieldValue.serverTimestamp(),
      modifiedBy: "system",
    });

    // Add paper to selected printers
    if (printerIds && printerIds.length > 0) {
      for (const printerId of printerIds) {
        const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
        await printerRef.collection("papers").doc(newPaperId).set({
          paperId: newPaperId,
        });
        await updatePrinterLastModified(printerId);
      }
    }

    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to add paper: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function updatePaper(
  paperId: string,
  name?: string,
  description?: string,
  thumbnailDataUrl?: string,
): Promise<TutorialState> {
  try {
    const paperRef = await assertDocExists(papersCollection(), paperId, "Paper");

    const updates: Record<string, unknown> = {};
    if (name) updates.name = normalizeName(name, "Paper name");
    if (description !== undefined) updates.description = normalizeDescription(description);
    if (thumbnailDataUrl !== undefined) updates.thumbnailDataUrl = thumbnailDataUrl;

    updates.lastModified = new Date();
    updates.modifiedBy = "system";

    await paperRef.update(updates);

    // Update lastModified for all printers that have this paper
    const printersSnapshot = await printersCollection().get();
    for (const printerDoc of printersSnapshot.docs) {
      const paperLink = await printerDoc.ref.collection("papers").doc(paperId).get();
      if (paperLink.exists) {
        await updatePrinterLastModified(printerDoc.id);
      }
    }

    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to update paper: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= PRINTER PAPER LINKING =============

export async function addPaperToPrinter(
  printerId: string,
  paperId: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    await assertDocExists(papersCollection(), paperId, "Paper");

    // Check if paper already linked to printer
    const existingLink = await printerRef.collection("papers").doc(paperId).get();
    if (existingLink.exists) {
      throw new Error("This paper is already linked to this printer.");
    }

    // Add the paper link with published: true by default
    await printerRef.collection("papers").doc(paperId).set({
      paperId,
      published: true,
      colours: [],
    });

    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to add paper to printer: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function removePaperFromPrinter(
  printerId: string,
  paperId: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const paperRef = printerRef.collection("papers").doc(paperId);

    // Delete all colours and steps for this paper in this printer
    const coloursRef = paperRef.collection("colours");
    const colourDocs = await coloursRef.get();

    for (const colourDoc of colourDocs.docs) {
      const stepsRef = colourDoc.ref.collection("steps");
      const stepDocs = await stepsRef.get();

      for (const stepDoc of stepDocs.docs) {
        await stepDoc.ref.delete();
      }
      await colourDoc.ref.delete();
    }

    // Delete the paper link
    await paperRef.delete();
    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to remove paper from printer: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function removeInvalidPapersFromPrinter(
  printerId: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const papersRef = printerRef.collection("papers");
    const paperDocs = await papersRef.get();

    let removedCount = 0;

    for (const paperDoc of paperDocs.docs) {
      const data = paperDoc.data();
      // Remove papers with undefined or missing paperId
      if (!data.paperId || data.paperId === "undefined") {
        // Delete all colours and steps for this invalid paper
        const coloursRef = paperDoc.ref.collection("colours");
        const colourDocs = await coloursRef.get();

        for (const colourDoc of colourDocs.docs) {
          const stepsRef = colourDoc.ref.collection("steps");
          const stepDocs = await stepsRef.get();

          for (const stepDoc of stepDocs.docs) {
            await stepDoc.ref.delete();
          }
          await colourDoc.ref.delete();
        }

        // Delete the invalid paper entry
        await paperDoc.ref.delete();
        removedCount++;
      }
    }

    console.log(`Removed ${removedCount} invalid papers from printer ${printerId}`);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to remove invalid papers: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function updatePaperInPrinter(
  printerId: string,
  paperId: string,
  published: boolean,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const paperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );

    await paperRef.update({ published });
    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to update paper in printer: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= COLOUR OPERATIONS (PRINTER-SPECIFIC) =============

export async function addColour(
  printerId: string,
  paperId: string,
  name: string,
  thumbnailDataUrl?: string,
  description?: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const globalPaperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const normalizedName = normalizeName(name, "Colour name");
    const normalizedDescription = normalizeDescription(description);
    const now = new Date();

    const printerPaperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );

    const newColourId = generateId();
    const nextGlobalOrder = await getNextOrder(globalPaperRef.collection("colours"));
    const nextPrinterOrder = await getNextOrder(printerPaperRef.collection("colours"));
    const globalColourOrder = (nextGlobalOrder || 0) + 1;
    const printerColourOrder = (nextPrinterOrder || 0) + 1;

    // Create colour in global paper collection (contains metadata)
    await globalPaperRef.collection("colours").doc(newColourId).set({
      id: newColourId,
      name: normalizedName,
      description: normalizedDescription,
      thumbnailDataUrl: thumbnailDataUrl || "",
      lastModified: now,
      createdAt: FieldValue.serverTimestamp(),
      order: globalColourOrder,
    });

    // Create colour reference in printer's paper (contains publish status)
    await printerPaperRef.collection("colours").doc(newColourId).set({
      colourId: newColourId,
      published: true,
      order: printerColourOrder,
    });

    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to add colour: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function updateColour(
  printerId: string,
  paperId: string,
  colourId: string,
  name?: string,
  thumbnailDataUrl?: string,
  published?: boolean,
  description?: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const globalPaperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const printerPaperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );

    // Update colour metadata in global paper (name, description, thumbnail)
    const globalColourRef = globalPaperRef.collection("colours").doc(colourId);
    const globalColourSnapshot = await globalColourRef.get();
    if (globalColourSnapshot.exists) {
      const globalUpdates: Record<string, unknown> = {};
      if (name) globalUpdates.name = normalizeName(name, "Colour name");
      if (thumbnailDataUrl !== undefined) globalUpdates.thumbnailDataUrl = thumbnailDataUrl;
      if (description !== undefined) globalUpdates.description = normalizeDescription(description);
      globalUpdates.lastModified = new Date();

      await globalColourRef.update(globalUpdates);
    }

    // Update publish status in printer's paper collection
    if (published !== undefined) {
      const printerColourRef = await assertDocExists(
        printerPaperRef.collection("colours"),
        colourId,
        "Colour",
      );
      await printerColourRef.update({ published });
    }

    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to update colour: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function deleteColour(
  printerId: string,
  paperId: string,
  colourId: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const globalPaperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const printerPaperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );

    // Get the global colour data before deletion for recording
    const globalColourRef = globalPaperRef.collection("colours").doc(colourId);
    const globalColourSnapshot = await globalColourRef.get();
    const colourData = globalColourSnapshot.exists ? globalColourSnapshot.data() : null;

    // Store deleted colour in deletedItems collection
    if (colourData) {
      const deletedItemId = generateId();
      await deletedItemsCollection().doc(deletedItemId).set({
        type: "colour",
        name: colourData.name || "Unknown",
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: "admin",
        data: {
          ...colourData,
          printerId,
          paperId,
        },
      });
    }

    // Delete all steps from printer's colour
    const printerColourRef = printerPaperRef.collection("colours").doc(colourId);
    const printerColourSnapshot = await printerColourRef.get();
    if (printerColourSnapshot.exists) {
      const stepsRef = printerColourRef.collection("steps");
      const stepDocs = await stepsRef.get();
      for (const stepDoc of stepDocs.docs) {
        await stepDoc.ref.delete();
      }
      await printerColourRef.delete();
    }

    // Delete colour metadata from global paper
    if (globalColourSnapshot.exists) {
      await globalColourRef.delete();
    }

    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to delete colour: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function updateColourInPrinterPaper(
  printerId: string,
  paperId: string,
  colourId: string,
  published: boolean,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const printerPaperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );
    const colourRef = await assertDocExists(
      printerPaperRef.collection("colours"),
      colourId,
      "Colour",
    );

    await colourRef.update({ published });
    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to update colour in printer paper: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= STEP OPERATIONS (COLOUR-SPECIFIC) =============

export async function addStep(
  printerId: string,
  paperId: string,
  colourId: string,
  title: string,
  contentHtml: string,
  imageDataUrl: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const globalPaperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const printerPaperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );

    // Check if colour exists in global paper
    const globalColourRef = globalPaperRef.collection("colours").doc(colourId);
    const globalColourSnapshot = await globalColourRef.get();

    // If colour doesn't exist in global paper, try to get it from printer's paper
    if (!globalColourSnapshot.exists) {
      const printerColourRef = await assertDocExists(
        printerPaperRef.collection("colours"),
        colourId,
        "Colour",
      );
      const printerColourSnapshot = await printerColourRef.get();
      const printerColourData = printerColourSnapshot.data();

      // Create the colour in the global paper if it doesn't exist
      const now = new Date();
      await globalColourRef.set({
        id: colourId,
        name: printerColourData?.name || "Unknown Colour",
        description: printerColourData?.description || "",
        thumbnailDataUrl: printerColourData?.thumbnailDataUrl || "",
        lastModified: now,
        createdAt: FieldValue.serverTimestamp(),
        order: printerColourData?.order || 0,
      });
    }

    const normalizedTitle = normalizeName(title, "Step title");
    if (!contentHtml.trim()) {
      throw new Error("Step content is required.");
    }

    const newStepId = generateId();
    const stepsRef = globalColourRef.collection("steps");
    const nextOrder = await getNextOrder(stepsRef);

    await stepsRef.doc(newStepId).set({
      name: `Step ${nextOrder + 1}`,
      title: normalizedTitle,
      contentHtml: contentHtml.trim(),
      imageDataUrl: imageDataUrl || "",
      order: nextOrder + 1,
    });

    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to add step: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function updateStep(
  printerId: string,
  paperId: string,
  colourId: string,
  stepId: string,
  title?: string,
  contentHtml?: string,
  imageDataUrl?: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const globalPaperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const printerPaperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );

    // Check if colour exists in global paper
    const globalColourRef = globalPaperRef.collection("colours").doc(colourId);
    const globalColourSnapshot = await globalColourRef.get();

    // If colour doesn't exist in global paper, try to get it from printer's paper
    if (!globalColourSnapshot.exists) {
      const printerColourRef = await assertDocExists(
        printerPaperRef.collection("colours"),
        colourId,
        "Colour",
      );
      const printerColourSnapshot = await printerColourRef.get();
      const printerColourData = printerColourSnapshot.data();

      // Create the colour in the global paper if it doesn't exist
      const now = new Date();
      await globalColourRef.set({
        id: colourId,
        name: printerColourData?.name || "Unknown Colour",
        description: printerColourData?.description || "",
        thumbnailDataUrl: printerColourData?.thumbnailDataUrl || "",
        lastModified: now,
        createdAt: FieldValue.serverTimestamp(),
        order: printerColourData?.order || 0,
      });
    }

    const stepRef = await assertDocExists(
      globalColourRef.collection("steps"),
      stepId,
      "Step",
    );

    const updates: Record<string, unknown> = {};
    if (title) updates.title = normalizeName(title, "Step title");
    if (contentHtml !== undefined) {
      const trimmedContent = contentHtml.trim();
      if (!trimmedContent) {
        throw new Error("Step content is required.");
      }
      updates.contentHtml = trimmedContent;
    }
    if (imageDataUrl !== undefined) updates.imageDataUrl = imageDataUrl;

    await stepRef.update(updates);
    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to update step: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function deleteStep(
  printerId: string,
  paperId: string,
  colourId: string,
  stepId: string,
): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const globalPaperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const printerPaperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );

    // Check if colour exists in global paper
    const globalColourRef = globalPaperRef.collection("colours").doc(colourId);
    const globalColourSnapshot = await globalColourRef.get();

    // If colour doesn't exist in global paper, try to get it from printer's paper
    if (!globalColourSnapshot.exists) {
      const printerColourRef = await assertDocExists(
        printerPaperRef.collection("colours"),
        colourId,
        "Colour",
      );
      const printerColourSnapshot = await printerColourRef.get();
      const printerColourData = printerColourSnapshot.data();

      // Create the colour in the global paper if it doesn't exist
      const now = new Date();
      await globalColourRef.set({
        id: colourId,
        name: printerColourData?.name || "Unknown Colour",
        description: printerColourData?.description || "",
        thumbnailDataUrl: printerColourData?.thumbnailDataUrl || "",
        lastModified: now,
        createdAt: FieldValue.serverTimestamp(),
        order: printerColourData?.order || 0,
      });
    }
    const stepRef = await assertDocExists(
      globalColourRef.collection("steps"),
      stepId,
      "Step",
    );

    // Get the step data before deletion for recording
    const stepDoc = await stepRef.get();
    const stepData = stepDoc.data();

    // Store deleted step in deletedItems collection
    if (stepData) {
      const deletedItemId = generateId();
      await deletedItemsCollection().doc(deletedItemId).set({
        type: "step",
        name: stepData.title || `Step ${stepData.order}` || "Unknown",
        deletedAt: FieldValue.serverTimestamp(),
        deletedBy: "admin",
        data: {
          ...stepData,
          printerId,
          paperId,
          colourId,
        },
      });
    }

    await stepRef.delete();
    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to delete step: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= STEP REORDERING =============

export async function reorderStep(
  printerId: string,
  paperId: string,
  colourId: string,
  stepId: string,
  direction: "up" | "down",
): Promise<TutorialState> {
  try {
    const globalPaperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const globalColourRef = await assertDocExists(
      globalPaperRef.collection("colours"),
      colourId,
      "Colour",
    );
    const stepRef = await assertDocExists(
      globalColourRef.collection("steps"),
      stepId,
      "Step",
    );

    const currentStepDoc = await stepRef.get();
    const currentOrder = currentStepDoc.data()?.order ?? 0;

    const stepsRef = globalColourRef.collection("steps");
    let query;

    if (direction === "up") {
      query = stepsRef.where("order", "<", currentOrder).orderBy("order", "desc").limit(1);
    } else {
      query = stepsRef.where("order", ">", currentOrder).orderBy("order", "asc").limit(1);
    }

    const swapDocs = await query.get();

    if (!swapDocs.empty) {
      const swapDoc = swapDocs.docs[0];
      const swapOrder = swapDoc.data()?.order ?? 0;

      await stepRef.update({ order: swapOrder });
      await swapDoc.ref.update({ order: currentOrder });
    }

    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to reorder step: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function setStepOrder(
  printerId: string,
  paperId: string,
  colourId: string,
  stepId: string,
  newIndex: number,
): Promise<TutorialState> {
  try {
    const globalPaperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const globalColourRef = await assertDocExists(
      globalPaperRef.collection("colours"),
      colourId,
      "Colour",
    );
    const stepsRef = globalColourRef.collection("steps");
    const stepsSnapshot = await stepsRef.orderBy("order", "asc").get();

    if (stepsSnapshot.empty) return getTutorialState();

    const steps = stepsSnapshot.docs.map((doc) => ({ id: doc.id, ref: doc.ref }));
    const currentIndex = steps.findIndex((s) => s.id === stepId);
    if (currentIndex === -1) throw new Error("Step not found");

    const reordered = [...steps];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const batch = db.batch();
    reordered.forEach((step, index) => {
      batch.update(step.ref, { order: index });
    });
    await batch.commit();

    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to set step order: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= DELETED ITEMS OPERATIONS =============

export async function deletePrinter(printerId: string): Promise<TutorialState> {
  try {
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const printerDoc = await printerRef.get();
    const printerData = printerDoc.data();

    // Store deleted printer in deletedItems collection
    const deletedItemId = generateId();
    await deletedItemsCollection().doc(deletedItemId).set({
      type: "printer",
      name: printerData?.name || "Unknown",
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: "admin",
      data: printerData,
    });

    // Delete the printer and all its subcollections
    const papersRef = printerRef.collection("papers");
    const papersSnapshot = await papersRef.get();

    for (const paperDoc of papersSnapshot.docs) {
      const coloursRef = paperDoc.ref.collection("colours");
      const coloursSnapshot = await coloursRef.get();

      for (const colourDoc of coloursSnapshot.docs) {
        const stepsRef = colourDoc.ref.collection("steps");
        const stepsSnapshot = await stepsRef.get();

        for (const stepDoc of stepsSnapshot.docs) {
          await stepDoc.ref.delete();
        }

        await colourDoc.ref.delete();
      }

      await paperDoc.ref.delete();
    }

    await printerRef.delete();

    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to delete printer: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function deletePaper(paperId: string): Promise<TutorialState> {
  try {
    const paperRef = await assertDocExists(papersCollection(), paperId, "Paper");
    const paperDoc = await paperRef.get();
    const paperData = paperDoc.data();

    // Collect printer IDs that had this paper before deletion
    const printerIds: string[] = [];
    const printersSnapshot = await printersCollection().get();
    for (const printerDoc of printersSnapshot.docs) {
      const paperInPrinterRef = printerDoc.ref.collection("papers").doc(paperId);
      const paperInPrinter = await paperInPrinterRef.get();

      if (paperInPrinter.exists) {
        printerIds.push(printerDoc.id);
      }
    }

    // Store deleted paper in deletedItems collection with printer assignments
    const deletedItemId = generateId();
    await deletedItemsCollection().doc(deletedItemId).set({
      type: "paper",
      name: paperData?.name || "Unknown",
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: "admin",
      data: {
        ...paperData,
        printerIds, // Store which printers had this paper
      },
    });

    // Remove from all printers
    for (const printerDoc of printersSnapshot.docs) {
      const paperInPrinterRef = printerDoc.ref.collection("papers").doc(paperId);
      const paperInPrinter = await paperInPrinterRef.get();

      if (paperInPrinter.exists) {
        const coloursRef = paperInPrinterRef.collection("colours");
        const coloursSnapshot = await coloursRef.get();

        for (const colourDoc of coloursSnapshot.docs) {
          const stepsRef = colourDoc.ref.collection("steps");
          const stepsSnapshot = await stepsRef.get();

          for (const stepDoc of stepsSnapshot.docs) {
            await stepDoc.ref.delete();
          }

          await colourDoc.ref.delete();
        }

        await paperInPrinterRef.delete();
        await updatePrinterLastModified(printerDoc.id);
      }
    }

    // Delete the paper itself
    await paperRef.delete();

    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to delete paper: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function restoreDeletedItem(deletedItemId: string): Promise<TutorialState> {
  try {
    const deletedRef = await assertDocExists(deletedItemsCollection(), deletedItemId, "Deleted item");
    const deletedDoc = await deletedRef.get();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deletedData = deletedDoc.data() as any;

    if (deletedData.type === "printer") {
      // Restore printer
      const printerId = generateId();
      await printersCollection().doc(printerId).set(deletedData.data);
    } else if (deletedData.type === "paper") {
      // Restore paper with original printer assignments
      const paperId = generateId();
      const { printerIds = [], ...paperData } = deletedData.data;

      // Create the paper in global collection
      await papersCollection().doc(paperId).set(paperData);

      // Restore paper to original printers
      if (Array.isArray(printerIds) && printerIds.length > 0) {
        for (const printerId of printerIds) {
          try {
            await printersCollection().doc(printerId).collection("papers").doc(paperId).set({
              paperId,
              published: true,
              colours: [],
            });
          } catch (error) {
            // Printer may have been deleted, skip it
            console.warn(`Could not restore paper to printer ${printerId}:`, error);
          }
        }
      }
    }

    // Remove from deletedItems
    await deletedRef.delete();

    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to restore item: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function permanentlyDeleteItem(deletedItemId: string): Promise<TutorialState> {
  try {
    const deletedRef = await assertDocExists(deletedItemsCollection(), deletedItemId, "Deleted item");
    await deletedRef.delete();

    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to permanently delete item: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============= DATA MIGRATION =============

export async function migrateToPerPrinterPublishStatus(): Promise<void> {
  try {
    console.log("Starting migration to per-printer publish status...");

    // Step 1: Migrate Paper.published → PrinterPaper.published
    console.log("Step 1: Migrating paper published status to per-printer...");
    const papersSnapshot = await papersCollection().get();
    for (const paperDoc of papersSnapshot.docs) {
      const paperData = paperDoc.data();
      const paperPublished = paperData.published ?? true;

      // Update all printers that have this paper
      const printersSnapshot = await printersCollection().get();
      for (const printerDoc of printersSnapshot.docs) {
        const paperLink = printerDoc.ref.collection("papers").doc(paperDoc.id);
        const linkSnapshot = await paperLink.get();

        if (linkSnapshot.exists) {
          // Add published to the printer-paper doc if not already present
          const linkData = linkSnapshot.data();
          if (linkData && linkData.published === undefined) {
            await paperLink.update({ published: paperPublished });
            console.log(`✓ Updated ${printerDoc.id}/papers/${paperDoc.id} - published: ${paperPublished}`);
          }
        }
      }
    }

    // Step 2: Migrate Colour.published → PrinterPaperColour.published
    console.log("Step 2: Migrating colour published status to per-paper-printer...");
    const printersSnapshot = await printersCollection().get();
    for (const printerDoc of printersSnapshot.docs) {
      const papersRef = printerDoc.ref.collection("papers");
      const paperDocsSnapshot = await papersRef.get();

      for (const paperDoc of paperDocsSnapshot.docs) {
        const coloursRef = paperDoc.ref.collection("colours");
        const colourDocsSnapshot = await coloursRef.get();

        for (const colourDoc of colourDocsSnapshot.docs) {
          const colourData = colourDoc.data();
          const colourPublished = colourData.published ?? true;

          // Ensure colourId and published are set
          if (!colourData.colourId || colourData.published === undefined) {
            const updates: Record<string, unknown> = {};
            if (!colourData.colourId) updates.colourId = colourDoc.id;
            if (colourData.published === undefined) updates.published = colourPublished;

            if (Object.keys(updates).length > 0) {
              await colourDoc.ref.update(updates);
              console.log(`✓ Updated ${printerDoc.id}/papers/${paperDoc.id}/colours/${colourDoc.id}`);
            }
          }
        }
      }
    }

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Migration failed:", errorMsg);
    throw new Error(`Migration to per-printer publish status failed: ${errorMsg}`);
  }
}

// ============= HELPER FUNCTION =============

async function getNextOrder(collection: CollectionReference): Promise<number> {
  const snapshot = await collection.orderBy("order", "desc").limit(1).get();

  if (snapshot.empty) {
    return 0;
  }

  const lastDoc = snapshot.docs[0];
  const lastOrder = lastDoc.data().order;

  return typeof lastOrder === "number" ? lastOrder : 0;
}
