"use client";

import {
  ArrowDownTrayIcon, ArrowUturnLeftIcon, Bars3Icon, MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon, PencilSquareIcon, PhotoIcon, TrashIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import FindBar from "@/components/FindBar";
import SubmitterBadge from "@/components/SubmitterBadge";
import TabBar from "@/components/TabBar";
import { ago, fullStamp, initial, ink, submitterName } from "@/lib/format";
import type { Note } from "@/lib/notes";
import { canWebp, saveImage } from "@/lib/export";
import type { Board } from "@/lib/use-board";

type Props = {
  board: Board;
  sidebarHidden: boolean;
  toggleSidebar: () => void;
  pane: HTMLElement | null;
  setPane: (el: HTMLElement | null) => void;
  zoom: number;
  setZoom: (z: number) => void;
  findOpen: boolean;
  setFindOpen: (open: boolean) => void;
  onTrash: () => void;
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
      <Toolbar {...props} note={note} />

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

function Toolbar({ board, note, zoom, setZoom, onTrash, sidebarHidden, toggleSidebar }: Props & { note: Note | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function save(format: "png" | "webp") {
    if (!note) return;
    const result = await saveImage(note.title, format);
    board.show(result.ok ? "success" : "failure", result.message);
  }

  return (
    <header className="flex h-[38px] shrink-0 items-center gap-3 border-b border-[var(--divider)] px-[14px]">
      <button
        onClick={toggleSidebar}
        title={sidebarHidden ? "Show the note list" : "Hide the note list"}
        aria-label={sidebarHidden ? "Show the note list" : "Hide the note list"}
        className="shrink-0 text-[var(--secondary)] hover:text-[var(--label)]"
      >
        <Bars3Icon className="size-[14px]" />
      </button>
      <span className="truncate text-[12px] font-semibold">{note?.title || "Stickies Core"}</span>
      {note && (
        <span className="shrink-0 text-[10px] text-[var(--secondary)]">
          {note.folder_name} &middot; {fullStamp(note.created_at)}
          {/* Client only: "2 hr. ago" computed on the server is already stale by
              the time the browser hydrates, which is a hydration mismatch. */}
          {mounted && <> &middot; {ago(note.created_at)}</>}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-[10px] text-[var(--secondary)]">
        {zoom !== 1 && (
          <button onClick={() => setZoom(1)} title="Actual Size (Cmd+0)"
                  className="text-[10px] font-semibold tabular-nums hover:text-[var(--label)]">
            {Math.round(zoom * 100)}%
          </button>
        )}
        <Tool onClick={() => setZoom(round(zoom - 0.1))} label="Zoom Out (Cmd+-)" disabled={!note}>
          <MagnifyingGlassMinusIcon className="size-[14px]" />
        </Tool>
        <Tool onClick={() => setZoom(round(zoom + 0.1))} label="Zoom In (Cmd++)" disabled={!note}>
          <MagnifyingGlassPlusIcon className="size-[14px]" />
        </Tool>
        <Tool onClick={() => board.setComposerOpen(true)} label="New note (Cmd+N)">
          <PencilSquareIcon className="size-[14px]" />
        </Tool>
        <Tool onClick={() => save("png")} label="Save the whole note as a PNG (Cmd+S)" disabled={!note}>
          <ArrowDownTrayIcon className="size-[14px]" />
        </Tool>
        {/* A one-item menu is a worse button: WebP only appears where it encodes -
            and only after mount, since the server cannot know what this browser
            can write, and guessing there is a hydration mismatch. */}
        {mounted && canWebp && (
          <Tool onClick={() => save("webp")} label="Save the whole note as a WebP (Cmd+Shift+S)" disabled={!note}>
            <PhotoIcon className="size-[14px]" />
          </Tool>
        )}
        {board.viewingTrash ? (
          <Tool onClick={board.restoreSelected} label="Put this note back where it came from" disabled={!note}>
            <ArrowUturnLeftIcon className="size-[14px]" />
          </Tool>
        ) : (
          <Tool
            onClick={onTrash}
            // The server refuses a frozen note, so the button is disabled rather
            // than firing a request that can only fail.
            disabled={!note || note.frozen}
            label={note?.frozen ? "This note is locked - unlock it in the web app" : "Move to TRASH (Cmd+Delete skips the question)"}
            danger
          >
            <TrashIcon className="size-[14px]" />
          </Tool>
        )}
      </span>
    </header>
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

/** Noto clamps page zoom to 0.5-3. */
const round = (z: number) => Math.min(3, Math.max(0.5, Math.round(z * 10) / 10));

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
