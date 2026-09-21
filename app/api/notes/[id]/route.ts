import { NextResponse } from "next/server";
import { getNote, restoreNote, trashNote } from "@/lib/notes";
import { sanitize } from "@/lib/sanitize";

type Ctx = { params: Promise<{ id: string }> };

/** One note with its body. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const note = await getNote(id);
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // html notes are the owner's own markup, but it is still rendered, not run.
    const content = note.type === "html" ? sanitize(note.content) : note.content;
    return NextResponse.json({ note: { ...note, content } });
  } catch (e) {
    console.error("GET /api/notes/[id]", e);
    return NextResponse.json({ error: "Could not read the note" }, { status: 500 });
  }
}

/**
 * `{ action: "trash" }` moves a note to TRASH, `{ action: "restore", folder }`
 * puts it back. 423 for a frozen note, the way the web server answers.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const { action, folder } = await req.json();

    if (action === "restore") {
      const ok = await restoreNote(id, String(folder ?? "CLAUDE"));
      return ok
        ? NextResponse.json({ ok: true })
        : NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await trashNote(id);
    if (result === "missing") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result === "frozen") {
      return NextResponse.json(
        { error: "That note is locked. Unlock it in the web app first" },
        { status: 423 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/notes/[id]", e);
    return NextResponse.json({ error: "Could not update the note" }, { status: 500 });
  }
}
