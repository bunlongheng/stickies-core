import { NextResponse } from "next/server";
import { createNote, listNotes, notesByIds } from "@/lib/notes";
import { search } from "@/lib/search-index";

/** The list, or - with `?q=` - a ranked search over every title, folder and body. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  try {
    if (!q) {
      const notes = await listNotes();
      return NextResponse.json({ notes, total: notes.length });
    }
    const hits = await search(q);
    const notes = await notesByIds(hits.map((h) => h.id));
    // The rank, why it matched and the body excerpt travel with each row.
    const byId = new Map(hits.map((h) => [h.id, h]));
    return NextResponse.json({
      notes: notes.map((n) => ({ ...n, ...pick(byId.get(n.id)) })),
      total: notes.length,
    });
  } catch (e) {
    console.error("GET /api/notes", e);
    return NextResponse.json({ error: "Could not read the notes" }, { status: 500 });
  }
}

function pick(hit?: { score: number; fields: number; snippet: string | null }) {
  return hit ? { score: hit.score, matched: hit.fields, snippet: hit.snippet } : {};
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
