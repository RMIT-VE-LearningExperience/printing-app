import { NextResponse } from "next/server";

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
  moveColour,
  movePaper,
  movePrinter,
  moveStep,
  updateColour,
  updatePaper,
  updatePrinter,
  updateStep,
} from "../../../lib/tutorial-store";

type Direction = "up" | "down";

type ActionPayload =
  | { action: "addPrinter"; name: string; thumbnailDataUrl: string }
  | { action: "addPaper"; printerId: string; name: string; thumbnailDataUrl: string }
  | {
      action: "addColour";
      printerId: string;
      paperId: string;
      name: string;
      thumbnailDataUrl: string;
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
  | { action: "updatePrinter"; printerId: string; name: string; thumbnailDataUrl: string }
  | {
      action: "updatePaper";
      printerId: string;
      paperId: string;
      name: string;
      thumbnailDataUrl: string;
    }
  | {
      action: "updateColour";
      printerId: string;
      paperId: string;
      colourId: string;
      name: string;
      thumbnailDataUrl: string;
    }
  | {
      action: "updateStep";
      printerId: string;
      paperId: string;
      colourId: string;
      stepId: string;
      title: string;
      contentHtml: string;
      imageDataUrl: string;
    }
  | { action: "deletePrinter"; printerId: string }
  | { action: "deletePaper"; printerId: string; paperId: string }
  | { action: "deleteColour"; printerId: string; paperId: string; colourId: string }
  | {
      action: "deleteStep";
      printerId: string;
      paperId: string;
      colourId: string;
      stepId: string;
    }
  | { action: "movePrinter"; printerId: string; direction: Direction }
  | { action: "movePaper"; printerId: string; paperId: string; direction: Direction }
  | {
      action: "moveColour";
      printerId: string;
      paperId: string;
      colourId: string;
      direction: Direction;
    }
  | {
      action: "moveStep";
      printerId: string;
      paperId: string;
      colourId: string;
      stepId: string;
      direction: Direction;
    };

export async function GET() {
  return NextResponse.json(await getTutorialState());
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || !("action" in payload)) {
    return NextResponse.json({ error: "Field 'action' is required." }, { status: 400 });
  }

  try {
    const actionPayload = payload as ActionPayload;

    switch (actionPayload.action) {
      case "addPrinter":
        return NextResponse.json(
          await addPrinter(actionPayload.name, actionPayload.thumbnailDataUrl),
          { status: 201 },
        );
      case "addPaper":
        return NextResponse.json(
          await addPaper(
            actionPayload.printerId,
            actionPayload.name,
            actionPayload.thumbnailDataUrl,
          ),
          { status: 201 },
        );
      case "addColour":
        return NextResponse.json(
          await addColour(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.name,
            actionPayload.thumbnailDataUrl,
          ),
          { status: 201 },
        );
      case "addStep":
        return NextResponse.json(
          await addStep(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.colourId,
            {
              title: actionPayload.title,
              contentHtml: actionPayload.contentHtml,
              imageDataUrl: actionPayload.imageDataUrl,
            },
          ),
          { status: 201 },
        );
      case "updatePrinter":
        return NextResponse.json(
          await updatePrinter(
            actionPayload.printerId,
            actionPayload.name,
            actionPayload.thumbnailDataUrl,
          ),
          { status: 200 },
        );
      case "updatePaper":
        return NextResponse.json(
          await updatePaper(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.name,
            actionPayload.thumbnailDataUrl,
          ),
          { status: 200 },
        );
      case "updateColour":
        return NextResponse.json(
          await updateColour(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.colourId,
            actionPayload.name,
            actionPayload.thumbnailDataUrl,
          ),
          { status: 200 },
        );
      case "updateStep":
        return NextResponse.json(
          await updateStep(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.colourId,
            actionPayload.stepId,
            {
              title: actionPayload.title,
              contentHtml: actionPayload.contentHtml,
              imageDataUrl: actionPayload.imageDataUrl,
            },
          ),
          { status: 200 },
        );
      case "deletePrinter":
        return NextResponse.json(await deletePrinter(actionPayload.printerId), { status: 200 });
      case "deletePaper":
        return NextResponse.json(
          await deletePaper(actionPayload.printerId, actionPayload.paperId),
          { status: 200 },
        );
      case "deleteColour":
        return NextResponse.json(
          await deleteColour(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.colourId,
          ),
          { status: 200 },
        );
      case "deleteStep":
        return NextResponse.json(
          await deleteStep(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.colourId,
            actionPayload.stepId,
          ),
          { status: 200 },
        );
      case "movePrinter":
        return NextResponse.json(
          await movePrinter(actionPayload.printerId, actionPayload.direction),
          { status: 200 },
        );
      case "movePaper":
        return NextResponse.json(
          await movePaper(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.direction,
          ),
          { status: 200 },
        );
      case "moveColour":
        return NextResponse.json(
          await moveColour(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.colourId,
            actionPayload.direction,
          ),
          { status: 200 },
        );
      case "moveStep":
        return NextResponse.json(
          await moveStep(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.colourId,
            actionPayload.stepId,
            actionPayload.direction,
          ),
          { status: 200 },
        );
      default:
        return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to process request.",
      },
      { status: 400 },
    );
  }
}
