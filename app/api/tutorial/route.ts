import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/firebase-admin";

import {
  addColour,
  addPaper,
  addPrinter,
  addStep,
  deleteColour,
  deletePaper,
  deletePrinter,
  deleteStep,
  getTutorialState,
  reorderStep,
  setStepOrder,
  updateColour,
  updatePaper,
  updatePrinter,
  updateStep,
  addPaperToPrinter,
  removePaperFromPrinter,
  updatePaperInPrinter,
  updateColourInPrinterPaper,
  restoreDeletedItem,
  permanentlyDeleteItem,
  removeInvalidPapersFromPrinter,
  updateHomepageSettings,
  updateSectionSettings,
  validatePreviewToken,
  type TutorialState,
} from "../../../lib/tutorial-store";

type ActionPayload =
  | {
      action: "addPrinter";
      name: string;
      description?: string;
      thumbnailDataUrl?: string;
    }
  | {
      action: "updatePrinter";
      printerId: string;
      name?: string;
      description?: string;
      thumbnailDataUrl?: string;
      published?: boolean;
    }
  | { action: "deletePrinter"; printerId: string }
  | {
      action: "addPaper";
      name: string;
      description?: string;
      thumbnailDataUrl?: string;
      printerIds?: string[];
    }
  | {
      action: "updatePaper";
      paperId: string;
      name?: string;
      description?: string;
      thumbnailDataUrl?: string;
      published?: boolean;
    }
  | { action: "deletePaper"; paperId: string }
  | {
      action: "addPaperToPrinter";
      printerId: string;
      paperId: string;
    }
  | {
      action: "removePaperFromPrinter";
      printerId: string;
      paperId: string;
    }
  | {
      action: "updatePaperInPrinter";
      printerId: string;
      paperId: string;
      published: boolean;
    }
  | {
      action: "addColour";
      printerId: string;
      paperId: string;
      name: string;
      thumbnailDataUrl?: string;
      description?: string;
    }
  | {
      action: "updateColour";
      printerId: string;
      paperId: string;
      colourId: string;
      name?: string;
      thumbnailDataUrl?: string;
      published?: boolean;
      description?: string;
    }
  | {
      action: "deleteColour";
      printerId: string;
      paperId: string;
      colourId: string;
    }
  | {
      action: "updateColourInPrinterPaper";
      printerId: string;
      paperId: string;
      colourId: string;
      published: boolean;
    }
  | {
      action: "addStep";
      printerId: string;
      paperId: string;
      colourId: string;
      title: string;
      contentHtml: string;
      imageDataUrl: string;
      videoUrl?: string;
    }
  | {
      action: "updateStep";
      printerId: string;
      paperId: string;
      colourId: string;
      stepId: string;
      title?: string;
      contentHtml?: string;
      imageDataUrl?: string;
      videoUrl?: string;
    }
  | {
      action: "deleteStep";
      printerId: string;
      paperId: string;
      colourId: string;
      stepId: string;
    }
  | {
      action: "reorderStep";
      printerId: string;
      paperId: string;
      colourId: string;
      stepId: string;
      direction: "up" | "down";
    }
  | {
      action: "setStepOrder";
      printerId: string;
      paperId: string;
      colourId: string;
      stepId: string;
      newIndex: number;
    }
  | {
      action: "restoreDeletedItem";
      deletedItemId: string;
    }
  | {
      action: "permanentlyDeleteItem";
      deletedItemId: string;
    }
  | {
      action: "removeInvalidPapersFromPrinter";
      printerId: string;
    }
  | {
      action: "updateHomepageSettings";
      title: string;
      description: string;
    }
  | {
      action: "updateSectionSettings";
      section: "printers" | "papers" | "colours";
      title: string;
      subtitle: string;
    };

async function executeAction(payload: ActionPayload, modifiedBy?: string): Promise<TutorialState> {
  switch (payload.action) {
    case "addPrinter":
      return addPrinter(payload.name, payload.description, payload.thumbnailDataUrl, modifiedBy);

    case "updatePrinter":
      return updatePrinter(
        payload.printerId,
        payload.name,
        payload.description,
        payload.thumbnailDataUrl,
        payload.published,
        modifiedBy,
      );

    case "deletePrinter":
      return deletePrinter(payload.printerId);

    case "addPaper":
      return addPaper(
        payload.name,
        payload.description,
        payload.thumbnailDataUrl,
        payload.printerIds,
        modifiedBy,
      );

    case "updatePaper":
      return updatePaper(
        payload.paperId,
        payload.name,
        payload.description,
        payload.thumbnailDataUrl,
        modifiedBy,
      );

    case "deletePaper":
      return deletePaper(payload.paperId);

    case "addPaperToPrinter":
      return addPaperToPrinter(payload.printerId, payload.paperId);

    case "removePaperFromPrinter":
      return removePaperFromPrinter(payload.printerId, payload.paperId);

    case "updatePaperInPrinter":
      return updatePaperInPrinter(
        payload.printerId,
        payload.paperId,
        payload.published,
      );

    case "addColour":
      return addColour(
        payload.printerId,
        payload.paperId,
        payload.name,
        payload.thumbnailDataUrl,
        payload.description,
        modifiedBy,
      );

    case "updateColour":
      return updateColour(
        payload.printerId,
        payload.paperId,
        payload.colourId,
        payload.name,
        payload.thumbnailDataUrl,
        payload.published,
        payload.description,
        modifiedBy,
      );

    case "deleteColour":
      return deleteColour(payload.printerId, payload.paperId, payload.colourId);

    case "updateColourInPrinterPaper":
      return updateColourInPrinterPaper(
        payload.printerId,
        payload.paperId,
        payload.colourId,
        payload.published,
      );

    case "addStep":
      return addStep(
        payload.printerId,
        payload.paperId,
        payload.colourId,
        payload.title,
        payload.contentHtml,
        payload.imageDataUrl,
        payload.videoUrl,
        modifiedBy,
      );

    case "updateStep":
      return updateStep(
        payload.printerId,
        payload.paperId,
        payload.colourId,
        payload.stepId,
        payload.title,
        payload.contentHtml,
        payload.imageDataUrl,
        payload.videoUrl,
        modifiedBy,
      );

    case "deleteStep":
      return deleteStep(
        payload.printerId,
        payload.paperId,
        payload.colourId,
        payload.stepId,
      );

    case "reorderStep":
      return reorderStep(
        payload.printerId,
        payload.paperId,
        payload.colourId,
        payload.stepId,
        payload.direction,
      );

    case "setStepOrder":
      return setStepOrder(
        payload.printerId,
        payload.paperId,
        payload.colourId,
        payload.stepId,
        payload.newIndex,
      );

    case "restoreDeletedItem":
      return restoreDeletedItem(payload.deletedItemId);

    case "permanentlyDeleteItem":
      return permanentlyDeleteItem(payload.deletedItemId);

    case "removeInvalidPapersFromPrinter":
      return removeInvalidPapersFromPrinter(payload.printerId);

    case "updateHomepageSettings":
      await updateHomepageSettings(payload.title, payload.description);
      return getTutorialState();

    case "updateSectionSettings":
      await updateSectionSettings(payload.section, payload.title, payload.subtitle);
      return getTutorialState();

    default:
      throw new Error(`Unknown action: ${(payload as { action: string }).action}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin auth token
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let modifiedBy: string = "system";
    try {
      const decoded = await auth.verifyIdToken(token);
      const role = decoded.role as string | undefined;
      if (role !== "admin" && role !== "superadmin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      modifiedBy = decoded.email || decoded.uid || "system";
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { action: string; payload: unknown };

    if (!body.action || !body.payload) {
      return NextResponse.json(
        { error: "Missing action or payload" },
        { status: 400 },
      );
    }

    console.log(`[API] Processing action: ${body.action}`);

    // Merge action into payload for executeAction
    const actionPayload = { ...(body.payload as Record<string, unknown>), action: body.action } as ActionPayload;
    const state = await executeAction(actionPayload, modifiedBy);

    return NextResponse.json({ state });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : "";

    console.error("API Error:", {
      message: errorMessage,
      stack: errorStack,
      error,
    });

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const previewToken = searchParams.get("previewToken");

    let isPreviewMode = false;
    if (previewToken) {
      isPreviewMode = await validatePreviewToken(previewToken);
    }

    const state = await getTutorialState();
    return NextResponse.json({ state, isPreviewMode });
  } catch (error) {
    console.error("API Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
