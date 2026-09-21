import { GlobeAltIcon, KeyIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import NoteIcon from "@/components/NoteIcon";
import NoteList, { type Row } from "@/components/NoteList";
import { displayDate } from "@/lib/format";
import { listNotes } from "@/lib/notes";

export const dynamic = "force-dynamic";

/**
 * Noto's split view: the list on the left, the note on the right. This is a
 * layout, not a page, so walking from note to note never refetches the list.
 */
export default async function BoardLayout({ children }: { children: React.ReactNode }) {
  const notes = await listNotes();

  const rows: Row[] = notes.map((n) => ({
    id: n.id,
    title: n.title || "Untitled",
    date: displayDate(n.created_at),
    color: n.folder_color ?? "var(--secondary)",
    icon: n.icon ?? "",
    status: n.frozen ? "frozen" : n.locked ? "locked" : n.is_public ? "public" : null,
  }));

  // One rendered icon per distinct token - 69 of them, not 1,400 - so none of
  // Heroicons' 324 components reach the browser.
  const sprites = Object.fromEntries(
    [...new Set(rows.map((r) => r.icon))].map((token) => [token, <NoteIcon key={token} token={token} />]),
  );

  // Same glyphs and the same frozen > private > public priority the web list uses.
  const badges = {
    frozen: <LockClosedIcon className="size-[11px] text-[#e08b00]" title="Locked - cannot be trashed" />,
    locked: <KeyIcon className="size-[11px] text-[#30b0c7]" title="Private - passcode to view" />,
    public: <GlobeAltIcon className="size-[11px] text-[#34c759]" title="Public - anyone with the link" />,
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      <NoteList rows={rows} sprites={sprites} badges={badges} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
