import { NextRequest, NextResponse } from "next/server";

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
    };

async function executeAction(payload: ActionPayload): Promise<TutorialState> {
  switch (payload.action) {
    case "addPrinter":
      return addPrinter(payload.name, payload.description, payload.thumbnailDataUrl);

    case "updatePrinter":
      return updatePrinter(
        payload.printerId,
        payload.name,
        payload.description,
        payload.thumbnailDataUrl,
        payload.published,
      );

    case "deletePrinter":
      return deletePrinter(payload.printerId);

    case "addPaper":
      return addPaper(
        payload.name,
        payload.description,
        payload.thumbnailDataUrl,
        payload.printerIds,
      );

    case "updatePaper":
      return updatePaper(
        payload.paperId,
        payload.name,
        payload.description,
        payload.thumbnailDataUrl,
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

    case "restoreDeletedItem":
      return restoreDeletedItem(payload.deletedItemId);

    case "permanentlyDeleteItem":
      return permanentlyDeleteItem(payload.deletedItemId);

    case "removeInvalidPapersFromPrinter":
      return removeInvalidPapersFromPrinter(payload.printerId);

    default:
      throw new Error(`Unknown action: ${(payload as { action: string }).action}`);
  }
}

export async function POST(req: NextRequest) {
  try {
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
    const state = await executeAction(actionPayload);

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

export async function GET() {
  try {
    const state = await getTutorialState();
    return NextResponse.json({ state });
  } catch (error) {
    console.error("API Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
