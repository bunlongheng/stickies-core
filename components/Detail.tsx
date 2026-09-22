"use client";

import { useEffect, useState } from "react";
import FindBar from "@/components/FindBar";
import SubmitterBadge from "@/components/SubmitterBadge";
import TabBar from "@/components/TabBar";
import { ago, fullStamp, initial, ink, submitterName } from "@/lib/format";
import type { Note } from "@/lib/notes";
import type { Board } from "@/lib/use-board";

type Props = {
  board: Board;
  sidebarHidden: boolean;
  pane: HTMLElement | null;
  setPane: (el: HTMLElement | null) => void;
  zoom: number;
  findOpen: boolean;
  setFindOpen: (open: boolean) => void;
};

export default function Detail(props: Props) {
  const { board, setPane, zoom, findOpen, setFindOpen, sidebarHidden } = props;
  const fetchBody = board.body;
  const note = board.selectedNote;
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;
    let live = true;
    setContent(null);
    setError(null);
    fetchBody(note)
      .then((text) => live && setContent(text))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not read the note"));
    return () => { live = false; };
  }, [note, fetchBody]);

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--toolbar)]">
      <TabBar board={board} />

      {!note ? (
        <Centered>Select a note</Centered>
      ) : error ? (
        <Centered>{error}</Centered>
      ) : content === null ? (
        <Centered><LaunchTile note={note} /></Centered>
      ) : (
        <>
          {findOpen && <FindBar pane={props.pane} onClose={() => setFindOpen(false)} />}
          <div
            key={note.id}
            ref={setPane}
            style={{ zoom }}
            className="note-html scroll relative flex-1 overflow-y-auto"
            // The note's own HTML, as the owner wrote it in the web app. An html
            // note is its own document; anything else is preformatted text.
            dangerouslySetInnerHTML={{
              __html: note.type === "html" ? content : `<pre class="plain">${escape(content)}</pre>`,
            }}
          />
          <SubmitterChip note={note} />
          {/* With the sidebar open the list row already carries all of this. */}
          {sidebarHidden && <NoteFooter note={note} />}
        </>
      )}
    </main>
  );
}

/**
 * What the web app shows while a note's body is on the way: a tile in the note's
 * own colour carrying its initial, breathing. Same numbers as the web app's
 * noteLaunchBreath, so a note opening here and in the browser look like one app.
 */
function LaunchTile({ note }: { note: Note }) {
  const color = note.folder_color ?? "#8a8073";
  return (
    <span
      role="img"
      aria-label={`Loading ${note.title}`}
      className="launch-tile grid size-[96px] place-items-center rounded-[23px] text-[40px] font-black"
      style={{ background: color, color: ink(note.folder_color), boxShadow: `0 0 24px ${color}ba` }}
    >
      {initial(note.title)}
    </span>
  );
}

/**
 * Who posted the open note, bottom left over the page: the device or app icon by
 * itself, no chrome. Name and time live in the tooltip and the footer.
 */
function SubmitterChip({ note }: { note: Note }) {
  return (
    <span
      className="pointer-events-none absolute bottom-0 left-0 p-[14px] opacity-90"
      title={`Posted by ${submitterName(note)} \u00b7 ${fullStamp(note.created_at)}`}
    >
      <SubmitterBadge note={note} size={36} />
    </span>
  );
}

/**
 * The web app's footer bar: who, when, how long ago, and the folder. Shown only
 * with the sidebar closed - open, the list row already carries all of it.
 */
function NoteFooter({ note }: { note: Note }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <footer className="flex h-[28px] shrink-0 items-center gap-[6px] border-t border-[var(--divider)]
                       bg-[var(--toolbar)] px-3 font-mono text-[11px] text-[var(--secondary)]">
      <SubmitterBadge note={note} />
      <span>Posted by {submitterName(note)}</span>
      <span className="opacity-50">&middot;</span>
      <span className="tabular-nums">{fullStamp(note.created_at)}</span>
      {mounted && (
        <>
          <span className="opacity-50">&middot;</span>
          <span>{ago(note.created_at)}</span>
        </>
      )}
      <span className="ml-auto truncate">{note.folder_name}</span>
    </footer>
  );
}

function Tool({
  onClick, label, disabled, danger, children,
}: { onClick: () => void; label: string; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`transition-colors disabled:pointer-events-none disabled:opacity-30 ${
        danger ? "hover:text-[#ff3b30]" : "hover:text-[var(--label)]"
      }`}
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center text-[13px] text-[var(--secondary)]">{children}</div>
  );
}

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
