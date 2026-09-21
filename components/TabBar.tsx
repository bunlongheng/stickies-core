"use client";

import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ink } from "@/lib/format";
import { NoteGlyph } from "@/lib/icons";
import type { Note } from "@/lib/notes";
import type { Board } from "@/lib/use-board";

/**
 * The tab strip above the note, mirroring the web app's tabs view.
 *
 * Inactive tabs are icon-only in their folder colour so many fit; the active tab
 * grows, keeps its title and carries the close button. The < > stepper - and the
 * plain arrow keys - flick through the notes one at a time.
 *
 * Windowed, because the strip mirrors the WHOLE list: building all 1,400 tabs
 * froze the window for 22 seconds on every write. Widths are fixed, so a tab's
 * position is arithmetic and the track keeps its true scroll length.
 */
const INACTIVE = 28; // 26 wide + the 2px gap
const ACTIVE = 190;
const PAD = 240; // render this far beyond each edge

export default function TabBar({ board }: { board: Board }) {
  if (!board.tabs.length) return null;
  return (
    <div className="flex h-[32px] shrink-0 items-end bg-[var(--fill-badge)]">
      <Strip board={board} />
      <div className="flex h-full items-center gap-[2px] px-[6px]">
        <Arrow board={board} direction={-1} label="Previous note (left arrow)" />
        <span className="shrink-0 text-[9px] font-bold text-[var(--secondary)] tabular-nums">
          ALL ({board.tabs.length})
        </span>
        <Arrow board={board} direction={1} label="Next note (right arrow)" />
      </div>
    </div>
  );
}

function Strip({ board }: { board: Board }) {
  const track = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [width, setWidth] = useState(800);

  const active = board.tabs.findIndex((n) => n.id === board.selected);
  const left = (i: number) =>
    active === -1 || i <= active ? i * INACTIVE : active * INACTIVE + ACTIVE + (i - active - 1) * INACTIVE;
  const total = board.tabs.length * INACTIVE + (active === -1 ? 0 : ACTIVE - INACTIVE);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Selection also moves from the sidebar, the stepper and the arrow keys, so the
  // active tab has to be scrolled into view rather than assumed visible.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el || active === -1) return;
    el.scrollLeft = Math.max(0, left(active) + ACTIVE / 2 - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, board.tabs.length]);

  const from = scroll - PAD;
  const to = scroll + width + PAD;

  return (
    <div
      ref={track}
      onScroll={(e) => setScroll(e.currentTarget.scrollLeft)}
      className="scroll h-full flex-1 overflow-x-auto"
    >
      <div className="relative h-full" style={{ width: total }}>
        {board.tabs.map((note, i) => {
          const x = left(i);
          const isActive = i === active;
          if (x + (isActive ? ACTIVE : INACTIVE) < from || x > to) return null;
          return <Tab key={note.id} note={note} board={board} active={isActive} x={x} />;
        })}
      </div>
    </div>
  );
}

function Tab({ note, board, active, x }: { note: Note; board: Board; active: boolean; x: number }) {
  const tint = note.folder_color ?? "#8a8073";
  return (
    <div
      data-active={active}
      onClick={() => board.setSelected(note.id)}
      title={note.title}
      style={{
        left: x,
        width: active ? ACTIVE : INACTIVE - 2,
        height: active ? 32 : 26,
        background: active ? tint : `color-mix(in srgb, ${tint} 55%, transparent)`,
        // Folder colours run from pale yellow to near-black, so the label picks its
        // ink from the tab's own luminance instead of always being white.
        color: ink(note.folder_color),
      }}
      className={`absolute bottom-0 flex cursor-default items-center gap-[5px] overflow-hidden
                  rounded-t-[7px] px-[7px] ${active ? "z-10" : "opacity-85"}`}
    >
      <NoteGlyph token={note.icon} className="size-[12px] shrink-0" />
      {active && (
        <>
          <span className="truncate text-[11px] font-semibold">{note.title || "Untitled"}</span>
          <button
            onClick={(e) => { e.stopPropagation(); board.closeTab(note.id); }}
            aria-label="Close tab"
            className="shrink-0"
          >
            <XMarkIcon className="size-[10px]" />
          </button>
        </>
      )}
    </div>
  );
}

function Arrow({ board, direction, label }: { board: Board; direction: number; label: string }) {
  const Icon = direction < 0 ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <button
      onClick={() => board.stepTab(direction)}
      disabled={board.tabs.length < 2}
      title={label}
      aria-label={label}
      className="text-[var(--secondary)] disabled:opacity-30"
    >
      <Icon className="size-[10px]" />
    </button>
  );
}
