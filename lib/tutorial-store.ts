import {
  FieldValue,
  type CollectionReference,
  type DocumentReference,
} from "firebase-admin/firestore";

import { db } from "./firebase-admin";
import { resolveImageUrl } from "./media-storage";

export type Step = {
  id: string;
  name: string;
  title: string;
  contentHtml: string;
  imageDataUrl: string;
};

export type Colour = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  steps: Step[];
};

export type Paper = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  colours: Colour[];
};

export type Printer = {
  id: string;
  name: string;
  thumbnailDataUrl: string;
  papers: Paper[];
};

type State = {
  printers: Printer[];
};

type Direction = "up" | "down";

type StepContentInput = {
  title: string;
  contentHtml: string;
  imageDataUrl: string;
};

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

function normalizeStepContent(input: StepContentInput): StepContentInput {
  const title = normalizeName(input.title, "Step title");
  const contentHtml = input.contentHtml.trim();
  const imageDataUrl = input.imageDataUrl.trim();

  if (!contentHtml) {
    throw new Error("Step content is required.");
  }

  if (!imageDataUrl) {
    throw new Error("A valid step image is required.");
  }

  return { title, contentHtml, imageDataUrl };
}

function printersCollection() {
  return db.collection("printers");
}

async function assertDocExists(
  collection: CollectionReference,
  id: string,
  label: string,
): Promise<DocumentReference> {
  const ref = collection.doc(id);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error(`${label} not found.`);
  }

  return ref;
}

async function getNextOrder(collection: CollectionReference): Promise<number> {
  const lastDoc = await collection.orderBy("order", "desc").limit(1).get();

  if (lastDoc.empty) {
    return 1;
  }

  const maxOrder = Number(lastDoc.docs[0].data().order ?? 0);
  return Number.isFinite(maxOrder) ? maxOrder + 1 : 1;
}

async function moveInCollection(
  collection: CollectionReference,
  id: string,
  direction: Direction,
  label: string,
): Promise<void> {
  const docs = (await collection.orderBy("order", "asc").get()).docs;
  const currentIndex = docs.findIndex((doc) => doc.id === id);

  if (currentIndex < 0) {
    throw new Error(`${label} not found.`);
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= docs.length) {
    return;
  }

  const currentDoc = docs[currentIndex];
  const targetDoc = docs[targetIndex];
  const currentOrder = Number(currentDoc.data().order ?? currentIndex + 1);
  const targetOrder = Number(targetDoc.data().order ?? targetIndex + 1);

  const batch = db.batch();
  batch.update(currentDoc.ref, { order: targetOrder });
  batch.update(targetDoc.ref, { order: currentOrder });
  await batch.commit();
}

async function reorderInCollection(
  collection: CollectionReference,
  sourceId: string,
  targetId: string,
  label: string,
): Promise<void> {
  if (sourceId === targetId) {
    return;
  }

  const docs = (await collection.orderBy("order", "asc").get()).docs;
  const sourceIndex = docs.findIndex((doc) => doc.id === sourceId);
  const targetIndex = docs.findIndex((doc) => doc.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    throw new Error(`${label} not found.`);
  }

  const ordered = [...docs];
  const [moved] = ordered.splice(sourceIndex, 1);
  ordered.splice(targetIndex, 0, moved);

  const batch = db.batch();
  ordered.forEach((doc, index) => {
    batch.update(doc.ref, { order: index + 1 });
  });
  await batch.commit();
}

async function getLegacyStepFallback(stepRef: DocumentReference): Promise<StepContentInput> {
  const firstItem = await stepRef.collection("items").orderBy("createdAt", "asc").limit(1).get();

  if (firstItem.empty) {
    return {
      title: "",
      contentHtml: "",
      imageDataUrl: "",
    };
  }

  const data = firstItem.docs[0].data();
  return {
    title: String(data.title ?? ""),
    contentHtml: String(data.contentHtml ?? ""),
    imageDataUrl: String(data.imageDataUrl ?? ""),
  };
}

async function saveStepHistory(stepRef: DocumentReference) {
  const existingStep = await stepRef.get();
  if (!existingStep.exists) {
    return;
  }

  const data = existingStep.data() ?? {};
  const historyRef = stepRef.collection("history").doc();
  await historyRef.set({
    title: String(data.title ?? ""),
    contentHtml: String(data.contentHtml ?? ""),
    imageDataUrl: String(data.imageDataUrl ?? ""),
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function getTutorialState(): Promise<State> {
  const printerDocs = await printersCollection().orderBy("order", "asc").get();
  const printers: Printer[] = [];

  for (const printerDoc of printerDocs.docs) {
    const printerData = printerDoc.data();
    const papersDocs = await printerDoc.ref.collection("papers").orderBy("order", "asc").get();
    const papers: Paper[] = [];

    for (const paperDoc of papersDocs.docs) {
      const paperData = paperDoc.data();
      const coloursDocs = await paperDoc.ref.collection("colours").orderBy("order", "asc").get();
      const colours: Colour[] = [];

      for (const colourDoc of coloursDocs.docs) {
        const colourData = colourDoc.data();
        const stepsDocs = await colourDoc.ref.collection("steps").orderBy("order", "asc").get();
        const steps: Step[] = [];

        let stepNumber = 1;
        for (const stepDoc of stepsDocs.docs) {
          const stepData = stepDoc.data();
          const legacy = await getLegacyStepFallback(stepDoc.ref);

          steps.push({
            id: stepDoc.id,
            name: `Step ${stepNumber}`,
            title: String(stepData.title ?? legacy.title ?? ""),
            contentHtml: String(stepData.contentHtml ?? legacy.contentHtml ?? ""),
            imageDataUrl: String(stepData.imageDataUrl ?? legacy.imageDataUrl ?? ""),
          });
          stepNumber += 1;
        }

        colours.push({
          id: colourDoc.id,
          name: String(colourData.name ?? "Unnamed Colour"),
          thumbnailDataUrl: String(colourData.thumbnailDataUrl ?? ""),
          steps,
        });
      }

      papers.push({
        id: paperDoc.id,
        name: String(paperData.name ?? "Unnamed Paper"),
        thumbnailDataUrl: String(paperData.thumbnailDataUrl ?? ""),
        colours,
      });
    }

    printers.push({
      id: printerDoc.id,
      name: String(printerData.name ?? "Unnamed Printer"),
      thumbnailDataUrl: String(printerData.thumbnailDataUrl ?? ""),
      papers,
    });
  }

  return { printers };
}

export async function addPrinter(name: string, thumbnailDataUrl: string): Promise<State> {
  const ref = printersCollection().doc();
  const thumbnailUrl = await resolveImageUrl(
    thumbnailDataUrl,
    `tutorial/printers/${ref.id}/thumbnail`,
  );

  await ref.set({
    name: normalizeName(name, "Printer name"),
    thumbnailDataUrl: thumbnailUrl,
    order: await getNextOrder(printersCollection()),
    createdAt: FieldValue.serverTimestamp(),
  });

  return getTutorialState();
}

export async function addPaper(
  printerId: string,
  name: string,
  thumbnailDataUrl: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const papers = printerRef.collection("papers");
  const ref = papers.doc();
  const thumbnailUrl = await resolveImageUrl(
    thumbnailDataUrl,
    `tutorial/printers/${printerId}/papers/${ref.id}/thumbnail`,
  );

  await ref.set({
    name: normalizeName(name, "Paper name"),
    thumbnailDataUrl: thumbnailUrl,
    order: await getNextOrder(papers),
    createdAt: FieldValue.serverTimestamp(),
  });

  return getTutorialState();
}

export async function addColour(
  printerId: string,
  paperId: string,
  name: string,
  thumbnailDataUrl: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colours = paperRef.collection("colours");
  const ref = colours.doc();
  const thumbnailUrl = await resolveImageUrl(
    thumbnailDataUrl,
    `tutorial/printers/${printerId}/papers/${paperId}/colours/${ref.id}/thumbnail`,
  );

  await ref.set({
    name: normalizeName(name, "Colour name"),
    thumbnailDataUrl: thumbnailUrl,
    order: await getNextOrder(colours),
    createdAt: FieldValue.serverTimestamp(),
  });

  return getTutorialState();
}

export async function addStep(
  printerId: string,
  paperId: string,
  colourId: string,
  content: StepContentInput,
): Promise<State> {
  const normalizedContent = normalizeStepContent(content);

  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colourRef = await assertDocExists(paperRef.collection("colours"), colourId, "Colour");
  const steps = colourRef.collection("steps");
  const ref = steps.doc();
  const nextOrder = await getNextOrder(steps);
  const imageUrl = await resolveImageUrl(
    normalizedContent.imageDataUrl,
    `tutorial/printers/${printerId}/papers/${paperId}/colours/${colourId}/steps/${ref.id}/image`,
  );

  await ref.set({
    name: `Step ${nextOrder}`,
    title: normalizedContent.title,
    contentHtml: normalizedContent.contentHtml,
    imageDataUrl: imageUrl,
    order: nextOrder,
    createdAt: FieldValue.serverTimestamp(),
  });

  return getTutorialState();
}

export async function updatePrinter(
  printerId: string,
  name: string,
  thumbnailDataUrl: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const thumbnailUrl = await resolveImageUrl(
    thumbnailDataUrl,
    `tutorial/printers/${printerId}/thumbnail`,
  );

  await printerRef.update({
    name: normalizeName(name, "Printer name"),
    thumbnailDataUrl: thumbnailUrl,
  });

  return getTutorialState();
}

export async function updatePaper(
  printerId: string,
  paperId: string,
  name: string,
  thumbnailDataUrl: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const thumbnailUrl = await resolveImageUrl(
    thumbnailDataUrl,
    `tutorial/printers/${printerId}/papers/${paperId}/thumbnail`,
  );

  await paperRef.update({
    name: normalizeName(name, "Paper name"),
    thumbnailDataUrl: thumbnailUrl,
  });

  return getTutorialState();
}

export async function updateColour(
  printerId: string,
  paperId: string,
  colourId: string,
  name: string,
  thumbnailDataUrl: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colourRef = await assertDocExists(paperRef.collection("colours"), colourId, "Colour");
  const thumbnailUrl = await resolveImageUrl(
    thumbnailDataUrl,
    `tutorial/printers/${printerId}/papers/${paperId}/colours/${colourId}/thumbnail`,
  );

  await colourRef.update({
    name: normalizeName(name, "Colour name"),
    thumbnailDataUrl: thumbnailUrl,
  });

  return getTutorialState();
}

export async function updateStep(
  printerId: string,
  paperId: string,
  colourId: string,
  stepId: string,
  content: StepContentInput,
): Promise<State> {
  const normalizedContent = normalizeStepContent(content);

  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colourRef = await assertDocExists(paperRef.collection("colours"), colourId, "Colour");
  const stepRef = await assertDocExists(colourRef.collection("steps"), stepId, "Step");
  await saveStepHistory(stepRef);
  const imageUrl = await resolveImageUrl(
    normalizedContent.imageDataUrl,
    `tutorial/printers/${printerId}/papers/${paperId}/colours/${colourId}/steps/${stepId}/image`,
  );

  await stepRef.update({
    title: normalizedContent.title,
    contentHtml: normalizedContent.contentHtml,
    imageDataUrl: imageUrl,
  });

  return getTutorialState();
}

export async function undoStep(
  printerId: string,
  paperId: string,
  colourId: string,
  stepId: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colourRef = await assertDocExists(paperRef.collection("colours"), colourId, "Colour");
  const stepRef = await assertDocExists(colourRef.collection("steps"), stepId, "Step");

  const historyQuery = await stepRef
    .collection("history")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();

  if (historyQuery.empty) {
    throw new Error("No previous version available for this step.");
  }

  const historyDoc = historyQuery.docs[0];
  const historyData = historyDoc.data();

  await stepRef.update({
    title: String(historyData.title ?? ""),
    contentHtml: String(historyData.contentHtml ?? ""),
    imageDataUrl: String(historyData.imageDataUrl ?? ""),
  });

  await historyDoc.ref.delete();

  return getTutorialState();
}

export async function deletePrinter(printerId: string): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  await db.recursiveDelete(printerRef);
  return getTutorialState();
}

export async function deletePaper(printerId: string, paperId: string): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  await db.recursiveDelete(paperRef);
  return getTutorialState();
}

export async function deleteColour(
  printerId: string,
  paperId: string,
  colourId: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colourRef = await assertDocExists(paperRef.collection("colours"), colourId, "Colour");
  await db.recursiveDelete(colourRef);
  return getTutorialState();
}

export async function deleteStep(
  printerId: string,
  paperId: string,
  colourId: string,
  stepId: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colourRef = await assertDocExists(paperRef.collection("colours"), colourId, "Colour");
  const stepRef = await assertDocExists(colourRef.collection("steps"), stepId, "Step");
  await db.recursiveDelete(stepRef);
  return getTutorialState();
}

export async function movePrinter(printerId: string, direction: Direction): Promise<State> {
  await moveInCollection(printersCollection(), printerId, direction, "Printer");
  return getTutorialState();
}

export async function movePaper(
  printerId: string,
  paperId: string,
  direction: Direction,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  await moveInCollection(printerRef.collection("papers"), paperId, direction, "Paper");
  return getTutorialState();
}

export async function moveColour(
  printerId: string,
  paperId: string,
  colourId: string,
  direction: Direction,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  await moveInCollection(paperRef.collection("colours"), colourId, direction, "Colour");
  return getTutorialState();
}

export async function moveStep(
  printerId: string,
  paperId: string,
  colourId: string,
  stepId: string,
  direction: Direction,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colourRef = await assertDocExists(paperRef.collection("colours"), colourId, "Colour");
  await moveInCollection(colourRef.collection("steps"), stepId, direction, "Step");
  return getTutorialState();
}

export async function reorderPrinter(sourceId: string, targetId: string): Promise<State> {
  await reorderInCollection(printersCollection(), sourceId, targetId, "Printer");
  return getTutorialState();
}

export async function reorderPaper(
  printerId: string,
  sourceId: string,
  targetId: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  await reorderInCollection(printerRef.collection("papers"), sourceId, targetId, "Paper");
  return getTutorialState();
}

export async function reorderColour(
  printerId: string,
  paperId: string,
  sourceId: string,
  targetId: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  await reorderInCollection(paperRef.collection("colours"), sourceId, targetId, "Colour");
  return getTutorialState();
}

export async function reorderStep(
  printerId: string,
  paperId: string,
  colourId: string,
  sourceId: string,
  targetId: string,
): Promise<State> {
  const printerRef = await assertDocExists(printersCollection(), printerId, "Printer");
  const paperRef = await assertDocExists(printerRef.collection("papers"), paperId, "Paper");
  const colourRef = await assertDocExists(paperRef.collection("colours"), colourId, "Colour");
  await reorderInCollection(colourRef.collection("steps"), sourceId, targetId, "Step");
  return getTutorialState();
}
