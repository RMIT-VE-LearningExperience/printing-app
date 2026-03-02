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
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  steps: Step[];
};

export type Paper = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  modifiedBy: string;
};

export type PrinterPaper = {
  paperId: string;
  colours: Colour[];
};

export type Printer = {
  id: string;
  name: string;
  description?: string;
  thumbnailDataUrl: string;
  published: boolean;
  lastModified: Date;
  createdAt?: Date;
  papers: PrinterPaper[];
};

export type DeletedItem = {
  id: string;
  type: "printer" | "paper" | "colour" | "step";
  name: string;
  deletedAt: Date;
  deletedBy: string;
  data: unknown; // Stores the full item data for restoration
};

export type TutorialState = {
  papers: Paper[];
  printers: Printer[];
  deletedItems?: DeletedItem[];
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
    // Get all papers
    const papersSnapshot = await papersCollection().get();
    const papers: Paper[] = papersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        description: data.description || "",
        thumbnailDataUrl: data.thumbnailDataUrl || "",
        published: data.published ?? true,
        lastModified: data.lastModified?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || data.lastModified?.toDate() || new Date(),
        modifiedBy: data.modifiedBy || "system",
      };
    });

    // Get all printers with their papers
    const printersSnapshot = await printersCollection().get();
    const printers: Printer[] = await Promise.all(
      printersSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const papersRef = doc.ref.collection("papers");
        const paperDocsSnapshot = await papersRef.get();

        const papers: PrinterPaper[] = await Promise.all(
          paperDocsSnapshot.docs.map(async (paperDoc) => {
            const paperData = paperDoc.data();
            const coloursRef = paperDoc.ref.collection("colours");
            const colourDocsSnapshot = await coloursRef.orderBy("order").get();

            const colours: Colour[] = await Promise.all(
              colourDocsSnapshot.docs.map(async (colourDoc) => {
                const colourData = colourDoc.data();
                const stepsRef = colourDoc.ref.collection("steps");
                const stepDocsSnapshot = await stepsRef.orderBy("order").get();

                const steps: Step[] = stepDocsSnapshot.docs.map((stepDoc) => {
                  const stepData = stepDoc.data();
                  return {
                    id: stepDoc.id,
                    name: stepData.name || `Step ${stepDoc.id}`,
                    title: stepData.title,
                    contentHtml: stepData.contentHtml,
                    imageDataUrl: stepData.imageDataUrl,
                    order: stepData.order ?? 0,
                  };
                });

                return {
                  id: colourDoc.id,
                  name: colourData.name,
                  description: colourData.description || "",
                  thumbnailDataUrl: colourData.thumbnailDataUrl || "",
                  published: colourData.published ?? true,
                  lastModified: colourData.lastModified?.toDate() || new Date(),
                  createdAt: colourData.createdAt?.toDate() || colourData.lastModified?.toDate() || new Date(),
                  steps,
                };
              }),
            );

            return {
              paperId: paperData.paperId,
              colours,
            };
          }),
        );

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

    return { papers, printers, deletedItems };
  } catch (error) {
    console.error("Error getting tutorial state:", error);
    throw new Error(`Failed to load tutorial state: ${error instanceof Error ? error.message : "Unknown error"}`);
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
      published: true,
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
  published?: boolean,
): Promise<TutorialState> {
  try {
    const paperRef = await assertDocExists(papersCollection(), paperId, "Paper");

    const updates: Record<string, unknown> = {};
    if (name) updates.name = normalizeName(name, "Paper name");
    if (description !== undefined) updates.description = normalizeDescription(description);
    if (thumbnailDataUrl !== undefined) updates.thumbnailDataUrl = thumbnailDataUrl;
    if (published !== undefined) updates.published = published;

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

    // Add the paper link
    await printerRef.collection("papers").doc(paperId).set({
      paperId,
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
    const normalizedName = normalizeName(name, "Colour name");
    const normalizedDescription = normalizeDescription(description);
    const now = new Date();

    const paperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );

    const newColourId = generateId();
    await paperRef.collection("colours").doc(newColourId).set({
      name: normalizedName,
      description: normalizedDescription,
      thumbnailDataUrl: thumbnailDataUrl || "",
      published: true,
      lastModified: now,
      createdAt: FieldValue.serverTimestamp(),
      order: (await getNextOrder(paperRef.collection("colours"))) + 1,
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
    const paperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );
    const colourRef = await assertDocExists(
      paperRef.collection("colours"),
      colourId,
      "Colour",
    );

    const updates: Record<string, unknown> = {};
    if (name) updates.name = normalizeName(name, "Colour name");
    if (thumbnailDataUrl !== undefined) updates.thumbnailDataUrl = thumbnailDataUrl;
    if (published !== undefined) updates.published = published;
    if (description !== undefined) updates.description = normalizeDescription(description);

    updates.lastModified = new Date();

    await colourRef.update(updates);
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
    const paperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );
    const colourRef = await assertDocExists(
      paperRef.collection("colours"),
      colourId,
      "Colour",
    );

    // Delete all steps
    const stepsRef = colourRef.collection("steps");
    const stepDocs = await stepsRef.get();

    for (const stepDoc of stepDocs.docs) {
      await stepDoc.ref.delete();
    }

    // Delete the colour
    await colourRef.delete();
    await updatePrinterLastModified(printerId);
    return getTutorialState();
  } catch (error) {
    throw new Error(`Failed to delete colour: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    const paperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );
    const colourRef = await assertDocExists(
      paperRef.collection("colours"),
      colourId,
      "Colour",
    );

    const normalizedTitle = normalizeName(title, "Step title");
    if (!contentHtml.trim()) {
      throw new Error("Step content is required.");
    }

    const newStepId = generateId();
    const stepsRef = colourRef.collection("steps");
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
    const paperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );
    const colourRef = await assertDocExists(
      paperRef.collection("colours"),
      colourId,
      "Colour",
    );
    const stepRef = await assertDocExists(
      colourRef.collection("steps"),
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
    const paperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );
    const colourRef = await assertDocExists(
      paperRef.collection("colours"),
      colourId,
      "Colour",
    );
    const stepRef = await assertDocExists(
      colourRef.collection("steps"),
      stepId,
      "Step",
    );

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
    const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
    const paperRef = await assertDocExists(
      printerRef.collection("papers"),
      paperId,
      "Paper",
    );
    const colourRef = await assertDocExists(
      paperRef.collection("colours"),
      colourId,
      "Colour",
    );
    const stepRef = await assertDocExists(
      colourRef.collection("steps"),
      stepId,
      "Step",
    );

    const currentStepDoc = await stepRef.get();
    const currentOrder = currentStepDoc.data()?.order ?? 0;

    const stepsRef = colourRef.collection("steps");
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
    const deletedData = deletedDoc.data() as DeletedItem;

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
