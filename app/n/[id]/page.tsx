import { notFound } from "next/navigation";
import DeleteButton from "@/components/DeleteButton";
import Masthead from "@/components/Masthead";
import { getNote } from "@/lib/notes";
import { when } from "@/lib/when";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) notFound();

  return (
    <main>
      <Masthead
        title={note.title}
        caption={`Edited ${when(note.updated_at)}`}
        color={note.folder_color}
        back={{ href: `/f/${note.folder_id}`, label: note.folder_title ?? "Back" }}
      />

      {/* The body is this owner's own HTML, written by the full app. */}
      <article
        className="prose-note max-w-none border-t border-rule pt-10 text-[15px] leading-relaxed text-paper/90"
        dangerouslySetInnerHTML={{ __html: note.content }}
      />

      <footer className="mt-16 border-t border-rule pt-6">
        <DeleteButton id={note.id} backHref={`/f/${note.folder_id}`} />
      </footer>
    </main>
  );
}
