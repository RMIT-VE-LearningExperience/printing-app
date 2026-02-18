import { NextResponse } from "next/server";

import {
  addColour,
  addPaper,
  addPrinter,
  addStep,
  addStepItem,
  getTutorialState,
} from "../../../lib/tutorial-store";

type ActionPayload =
  | { action: "addPrinter"; name: string }
  | { action: "addPaper"; printerId: number; name: string }
  | { action: "addColour"; printerId: number; paperId: number; name: string }
  | {
      action: "addStep";
      printerId: number;
      paperId: number;
      colourId: number;
      name: string;
    }
  | {
      action: "addStepItem";
      printerId: number;
      paperId: number;
      colourId: number;
      stepId: number;
      title: string;
      contentHtml: string;
      imageDataUrl: string;
    };

export async function GET() {
  return NextResponse.json(getTutorialState());
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
      case "addPrinter": {
        return NextResponse.json(addPrinter(actionPayload.name), { status: 201 });
      }
      case "addPaper": {
        return NextResponse.json(
          addPaper(actionPayload.printerId, actionPayload.name),
          { status: 201 },
        );
      }
      case "addColour": {
        return NextResponse.json(
          addColour(actionPayload.printerId, actionPayload.paperId, actionPayload.name),
          { status: 201 },
        );
      }
      case "addStep": {
        return NextResponse.json(
          addStep(
            actionPayload.printerId,
            actionPayload.paperId,
            actionPayload.colourId,
            actionPayload.name,
          ),
          { status: 201 },
        );
      }
      case "addStepItem": {
        return NextResponse.json(
          addStepItem({
            printerId: actionPayload.printerId,
            paperId: actionPayload.paperId,
            colourId: actionPayload.colourId,
            stepId: actionPayload.stepId,
            title: actionPayload.title,
            contentHtml: actionPayload.contentHtml,
            imageDataUrl: actionPayload.imageDataUrl,
          }),
          { status: 201 },
        );
      }
      default: {
        return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
      }
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
