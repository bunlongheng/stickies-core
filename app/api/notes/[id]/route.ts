import { NextResponse } from "next/server";
import { trashNote } from "@/lib/notes";

/** Move a note to TRASH. 404 when it is gone, 409 when it is frozen. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await trashNote(id);
    if (result === "missing") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result === "frozen")
      return NextResponse.json({ error: "This note is locked" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/notes", e);
    return NextResponse.json({ error: "Could not move the note to TRASH" }, { status: 500 });
  }
}
