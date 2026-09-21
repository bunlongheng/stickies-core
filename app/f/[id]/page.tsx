import { notFound } from "next/navigation";
import Masthead from "@/components/Masthead";
import Row from "@/components/Row";
import { getFolder, listNotes } from "@/lib/notes";
import { when } from "@/lib/when";

export const dynamic = "force-dynamic";

export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [folder, notes] = await Promise.all([getFolder(id), listNotes(id)]);
  if (!folder) notFound();

  return (
    <main>
      <Masthead
        title={folder.title}
        caption={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
        color={folder.folder_color}
        back={{ href: "/", label: "All folders" }}
      />
      {notes.length === 0 ? (
        <p className="text-muted">This folder is empty.</p>
      ) : (
        <div>
          {notes.map((n, i) => (
            <Row
              key={n.id}
              href={`/n/${n.id}`}
              title={n.title}
              meta={when(n.updated_at)}
              color={folder.folder_color}
              index={i}
            />
          ))}
        </div>
      )}
    </main>
  );
}
