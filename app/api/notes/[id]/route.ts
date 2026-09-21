import { NextResponse } from "next/server";
import { trashNote } from "@/lib/notes";

/** Soft-delete a note. Returns 404 when it is already gone or not the owner's. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ok = await trashNote(id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/notes", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
