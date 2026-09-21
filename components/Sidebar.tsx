"use client";

import {
  ArrowPathIcon, ArrowUturnLeftIcon, Bars3BottomLeftIcon, ChevronLeftIcon,
  MagnifyingGlassIcon, TrashIcon, XCircleIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useEffect, useRef, useState } from "react";
import NoteRow, { ROW_HEIGHT } from "@/components/NoteRow";
import { guardPaste } from "@/lib/paste-guard";
import type { Board } from "@/lib/use-board";

/**
 * How much of a row there is room to draw. Read from the real width, so a drag of
 * the divider changes the layout as it moves - no snapping, and no separate
 * "compact mode" the width can disagree with.
 */
export type Density = "full" | "narrow" | "icons";
const densityFor = (w: number): Density => (w < 110 ? "icons" : w < 260 ? "narrow" : "full");

const MIN = 44;
const MAX = 480;

export default function Sidebar({ board }: { board: Board }) {
  const [width, setWidth] = useState(320);
  const wide = useRef(320);
  const density = densityFor(width);

  const drag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => setWidth(Math.min(MAX, Math.max(MIN, ev.clientX)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  /** One click walks the same three stops a drag can land on by hand, then back. */
  const cycle = () => {
    setWidth((w) => {
      if (w > 260) { wide.current = w; return 150; }
      if (w > 110) return MIN;
      return wide.current;
    });
  };

  const total = board.viewingTrash ? board.trashNotes.length : board.notes.length;

  return (
    <nav
      style={{ width }}
      className="relative flex shrink-0 flex-col border-r border-[var(--divider)] bg-[var(--sidebar)]"
    >
      <div
        className={`flex items-center gap-2 pt-[10px] pb-[6px] ${density === "icons" ? "px-[6px]" : "px-[10px]"}`}
      >
        {/* At icon width there is no room for either, and a clipped "All Not..."
            says less than the icons below it. */}
        {density !== "icons" && (
          <>
            <span className="shrink-0 text-[12px] font-semibold">
              {board.viewingTrash ? "Trash" : "All Notes"}
            </span>
            <span className="shrink-0 rounded-full bg-[var(--fill-badge)] px-[5px] py-[2px] text-[10px] font-semibold tabular-nums">
              {board.query ? `${board.visible.length} of ${total}` : total}
            </span>
            {board.isLoading && <Spinner />}
          </>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-[7px] text-[var(--secondary)]">
          {board.viewingTrash && (
            <>
              <Tool onClick={board.restoreSelected} label="Put this note back where it came from"
                    disabled={!board.selectedNote}>
                <ArrowUturnLeftIcon className="size-[13px]" />
              </Tool>
              <Tool onClick={() => confirmEmpty(board)} label="Delete everything in TRASH permanently"
                    disabled={!board.trashNotes.length}>
                <TrashIcon className="size-[13px]" />
              </Tool>
            </>
          )}
          <Tool onClick={board.toggleTrash} label={board.viewingTrash ? "Back to all notes" : "Show TRASH"}>
            {board.viewingTrash ? <ChevronLeftIcon className="size-[13px]" /> : <TrashIcon className="size-[13px]" />}
          </Tool>
          <Tool onClick={board.load} label="Refresh (Cmd+R)">
            <ArrowPathIcon className="size-[13px]" />
          </Tool>
          <Tool onClick={cycle} label="Squeeze the list: narrow, then icons, then back">
            <Bars3BottomLeftIcon className="size-[13px]" />
          </Tool>
        </span>
      </div>

      {/* A text field 30pt wide is not a text field. At icon width the row becomes
          the button that opens the full search instead. */}
      {density === "icons" ? (
        <button
          onClick={() => board.setPaletteOpen(true)}
          title="Search all notes (Cmd+Shift+F)"
          className="mx-[6px] mb-[8px] flex justify-center rounded-[6px] bg-[var(--fill-field)] py-[5px]"
        >
          <MagnifyingGlassIcon className="size-[13px] text-[var(--secondary)]" />
        </button>
      ) : (
        <div className="mx-[10px] mb-[8px] flex items-center gap-[6px] rounded-[6px] bg-[var(--fill-field)] px-[8px] py-[5px]">
          <MagnifyingGlassIcon className="size-[11px] shrink-0 text-[var(--secondary)]" />
          <input
            value={board.query}
            onChange={(e) => board.setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Type, then walk the results without leaving the field.
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              board.stepSelection(e.key === "ArrowDown" ? 1 : -1);
            }}
            onPaste={guardPaste}
            placeholder="Filter by title"
            aria-label="Filter notes"
            className="h-4 w-full bg-transparent text-[12px] outline-none placeholder:text-[var(--secondary)]"
          />
          {board.query && (
            <button onClick={() => board.setQuery("")} aria-label="Clear search">
              <XCircleIcon className="size-[11px] text-[var(--secondary)]" />
            </button>
          )}
        </div>
      )}

      <div className="h-px bg-[var(--divider)]" />

      {/* A failed refresh must not hide notes that are already loaded. */}
      {board.error && board.visible.length > 0 && (
        <p className="bg-[#e08b0020] px-4 py-[6px] text-[11px] text-[#e08b00]">
          Refresh failed. {board.error}
        </p>
      )}

      {board.visible.length === 0 ? (
        <Message board={board} />
      ) : (
        <VirtualList board={board} density={density} />
      )}

      {/* The divider drags freely between the icon-only floor and 480. */}
      <span
        onPointerDown={drag}
        onDoubleClick={cycle}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize note list"
        className="absolute inset-y-0 -right-[3px] z-10 w-[6px] cursor-col-resize"
      />
    </nav>
  );
}

/**
 * Only the rows on screen exist.
 *
 * AppKit's List windows its rows for free; the browser does not. With all 1,400
 * in the DOM every list change re-rendered the lot and kicked off 1,400 submitter
 * icon requests, which froze the window for ~20 seconds on any write.
 */
function VirtualList({ board, density }: { board: Board; density: Density }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.clientHeight));
    observer.observe(el);
    setHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  const index = board.visible.findIndex((n) => n.id === board.selected);

  // Arrow-stepping past the edge of the window would otherwise move a selection
  // nobody can see - and a windowed row cannot scroll itself into view.
  useEffect(() => {
    const el = viewport.current;
    if (!el || index < 0) return;
    const top = index * ROW_HEIGHT;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight)
      el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
  }, [index]);

  const overscan = 8;
  const first = Math.max(0, Math.floor(scroll / ROW_HEIGHT) - overscan);
  const last = Math.min(board.visible.length, Math.ceil((scroll + height) / ROW_HEIGHT) + overscan);
  const window_ = board.visible.slice(first, last);

  return (
    <div
      ref={viewport}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      className="scroll flex-1 overflow-y-auto px-[6px] py-[4px]"
    >
      <div style={{ height: board.visible.length * ROW_HEIGHT, position: "relative" }}>
        <div style={{ transform: `translateY(${first * ROW_HEIGHT}px)` }}>
          {window_.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              density={density}
              selected={note.id === board.selected}
              onSelect={() => board.setSelected(note.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function confirmEmpty(board: Board) {
  const n = board.trashNotes.length;
  if (confirm(`Delete all ${n} notes in TRASH?\n\nThis cannot be undone - there is no second trash behind this one.`))
    void board.emptyTrash();
}

function Tool({
  onClick, label, disabled, children,
}: { onClick: () => void; label: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} aria-label={label}
            className="transition-colors hover:text-[var(--label)] disabled:opacity-30">
      {children}
    </button>
  );
}

function Spinner() {
  return <span className="size-[11px] shrink-0 animate-spin rounded-full border-[1.5px] border-[var(--divider)] border-t-[var(--secondary)]" />;
}

function Message({ board }: { board: Board }) {
  const text = board.error
    ? board.error
    : board.query
      ? `No match for “${board.query}”`
      : board.viewingTrash
        ? "Trash is empty"
        : board.isLoading
          ? "Loading notes..."
          : "No notes";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[10px] px-[30px] text-center">
      <p className="text-[13px] text-[var(--secondary)]">{text}</p>
      {(board.error || (!board.query && !board.viewingTrash)) && (
        <button onClick={board.load} className="text-[12px] text-[#0066cc] hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}
