import { NextResponse } from "next/server";
import { createNote, listNotes, searchNotes } from "@/lib/notes";

/** The list, or - with `?q=` - the notes whose body matches. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  try {
    const notes = q ? await searchNotes(q) : await listNotes();
    return NextResponse.json({ notes, total: notes.length });
  } catch (e) {
    console.error("GET /api/notes", e);
    return NextResponse.json({ error: "Could not read the notes" }, { status: 500 });
  }
}

/** Create a plain-text note. The body is required; the title is derived if absent. */
export async function POST(req: Request) {
  try {
    const { title, content } = await req.json();
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "A note needs a body" }, { status: 400 });
    }
    return NextResponse.json({ note: await createNote(String(title ?? "").trim(), content) });
  } catch (e) {
    console.error("POST /api/notes", e);
    return NextResponse.json({ error: "Could not create the note" }, { status: 500 });
  }
}
