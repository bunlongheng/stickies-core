"use client";

import {
  ArrowDownTrayIcon, ArrowUturnLeftIcon, MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon, PencilSquareIcon, TrashIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import ShareMenu from "@/components/ShareMenu";
import { canWebp, saveImage } from "@/lib/export";
import type { Board } from "@/lib/use-board";

/**
 * The window's own toolbar: it spans BOTH panes, the way a macOS title bar does,
 * with the list controls on the left and the note's on the right. The tab strip
 * lives under it, inside the detail pane - not above it.
 */
export default function Toolbar({
  board, sidebarHidden, toggleSidebar, cycleWidth, zoom, setZoom, onTrash,
}: {
  board: Board;
  sidebarHidden: boolean;
  toggleSidebar: () => void;
  cycleWidth: () => void;
  zoom: number;
  setZoom: (z: number) => void;
  onTrash: () => void;
}) {
  const note = board.selectedNote;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function save(format: "png" | "webp") {
    if (!note) return;
    const result = await saveImage(note.title, format);
    board.show(result.ok ? "success" : "failure", result.message);
  }

  return (
    <header
      className="flex h-[46px] shrink-0 items-center gap-3 border-b border-[var(--divider)]
                 bg-[var(--toolbar)] px-[14px]"
    >
      <span className="flex shrink-0 items-center gap-[12px] text-[var(--secondary)]">
        <Tool onClick={toggleSidebar} label={sidebarHidden ? "Show the note list" : "Hide the note list"}>
          <SidebarIcon />
        </Tool>
        <Tool
          onClick={cycleWidth}
          disabled={sidebarHidden}
          label="Squeeze the list: narrow, then icons, then back"
        >
          <SqueezeIcon />
        </Tool>
      </span>

      {/* The title, and nothing else. Who posted it and when belong to the
          footer, which is where Noto puts them. */}
      <span className="truncate text-[13px] font-semibold">{note?.title || "Stickies Core"}</span>

      <span className="ml-auto flex shrink-0 items-center gap-[12px] text-[var(--secondary)]">
        {zoom !== 1 && (
          <>
            <Tool onClick={() => setZoom(zoom - 0.1)} label="Zoom Out (Cmd+-)">
              <MagnifyingGlassMinusIcon className="size-[15px]" />
            </Tool>
            <button
              onClick={() => setZoom(1)}
              title="Actual Size (Cmd+0)"
              className="text-[10px] font-semibold tabular-nums hover:text-[var(--label)]"
            >
              {Math.round(zoom * 100)}%
            </button>
            <Tool onClick={() => setZoom(zoom + 0.1)} label="Zoom In (Cmd++)">
              <MagnifyingGlassPlusIcon className="size-[15px]" />
            </Tool>
          </>
        )}
        {note && <ShareMenu board={board} note={note} />}
        <Tool onClick={() => board.setComposerOpen(true)} label="New note (Cmd+N)">
          <PencilSquareIcon className="size-[15px]" />
        </Tool>
        {/* A one-item menu is a worse button: the format picker only appears where
            the browser can encode WebP, and only after mount, since the server
            cannot know that and guessing it is a hydration mismatch. */}
        {mounted && canWebp ? (
          <ExportMenu onPick={save} disabled={!note} />
        ) : (
          <Tool onClick={() => save("png")} label="Save the whole note as an image (Cmd+S)" disabled={!note}>
            <ArrowDownTrayIcon className="size-[15px]" />
          </Tool>
        )}
        {board.viewingTrash ? (
          <Tool onClick={board.restoreSelected} label="Put this note back where it came from" disabled={!note}>
            <ArrowUturnLeftIcon className="size-[15px]" />
          </Tool>
        ) : (
          <Tool
            onClick={onTrash}
            // The server refuses a frozen note, so the button is disabled rather
            // than firing a request that can only fail.
            disabled={!note || note.frozen}
            label={
              note?.frozen
                ? "This note is locked - unlock it in the web app"
                : "Move to TRASH (Cmd+Delete skips the question)"
            }
            danger
          >
            <TrashIcon className="size-[15px]" />
          </Tool>
        )}
      </span>
    </header>
  );
}

function Tool({
  onClick, label, disabled, danger, children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
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

/** macOS's own sidebar glyph: a pane with its left column ruled off. */
function SidebarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="size-[15px]">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <path d="M6 2.5v11" />
    </svg>
  );
}

/** And its "push the divider left" companion. */
function SqueezeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="size-[15px]">
      <path d="M2 2.5v11" />
      <path d="M13.5 8H6m0 0 3-3M6 8l3 3" />
    </svg>
  );
}

/** PNG or WebP, the way Noto offers both only when both can be written. */
function ExportMenu({
  onPick, disabled,
}: { onPick: (format: "png" | "webp") => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <Tool
        onClick={() => setOpen((was) => !was)}
        disabled={disabled}
        label="Save the whole note as an image (Cmd+S)"
      >
        <ArrowDownTrayIcon className="size-[15px]" />
      </Tool>
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span
            className="absolute top-[22px] right-0 z-20 flex w-[104px] flex-col overflow-hidden
                       rounded-[6px] border border-[var(--divider)] bg-[var(--toolbar)] py-1 shadow-lg"
          >
            {(["png", "webp"] as const).map((format) => (
              <button
                key={format}
                onClick={() => { setOpen(false); onPick(format); }}
                className="px-3 py-[5px] text-left text-[12px] hover:bg-[var(--hover)]"
              >
                {format.toUpperCase()}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}
