import { NextResponse } from "next/server";
import { emptyTrash, listTrash } from "@/lib/notes";

/** Everything in TRASH. */
export async function GET() {
  try {
    return NextResponse.json({ notes: await listTrash() });
  } catch (e) {
    console.error("GET /api/trash", e);
    return NextResponse.json({ error: "Could not read TRASH" }, { status: 500 });
  }
}

/** Empty TRASH permanently. Refused unless the deployment opts in. */
export async function DELETE() {
  try {
    const removed = await emptyTrash();
    if (removed === "disabled") {
      return NextResponse.json(
        { error: "Permanent delete is off. Set STICKIES_CORE_ALLOW_PURGE=1 to enable it." },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    console.error("DELETE /api/trash", e);
    return NextResponse.json({ error: "Could not empty TRASH" }, { status: 500 });
  }
}
