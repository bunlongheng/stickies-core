import { notFound } from "next/navigation";
import TrashButton from "@/components/TrashButton";
import { fullStamp } from "@/lib/format";
import { getNote } from "@/lib/notes";

export const dynamic = "force-dynamic";

/** Escape a plain-text note so it can go into the same HTML document. */
function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) notFound();

  // Noto's rule exactly: an html note is its own document, anything else is
  // preformatted text.
  const body = note.type === "html" ? note.content : `<pre class="plain">${escape(note.content)}</pre>`;

  return (
    <>
      <header className="flex h-[38px] shrink-0 items-center gap-3 border-b border-[var(--divider)] bg-[var(--toolbar)] px-[14px]">
        <span className="truncate text-[12px] font-semibold">{note.title || "Untitled"}</span>
        <span className="shrink-0 text-[10px] text-[var(--secondary)]">
          {note.folder_name} &middot; {fullStamp(note.created_at)}
        </span>
        <TrashButton id={note.id} title={note.title} frozen={note.frozen} />
      </header>

      {/* The note's own HTML, written by the owner in the web app. */}
      <div
        className="note-html scroll flex-1 overflow-y-auto"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </>
  );
}
