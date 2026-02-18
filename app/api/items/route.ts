import { NextResponse } from "next/server";

import { addItem, listItems } from "../../../lib/items-store";

export async function GET() {
  return NextResponse.json({ items: listItems() });
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const name =
    typeof payload === "object" && payload !== null && "name" in payload
      ? (payload as { name?: unknown }).name
      : undefined;

  if (typeof name !== "string") {
    return NextResponse.json(
      { error: "Field 'name' is required and must be a string." },
      { status: 400 },
    );
  }

  try {
    const item = addItem(name);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to add item due to validation error.",
      },
      { status: 400 },
    );
  }
}
