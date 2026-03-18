import { NextResponse } from "next/server";

import { createPreviewToken } from "../../../lib/tutorial-store";

export async function POST() {
  try {
    const token = await createPreviewToken();
    return NextResponse.json({ token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
