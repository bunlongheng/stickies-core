"use client";

import { MagnifyingGlassIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from "@heroicons/react/24/solid";
import { useCallback, useEffect, useRef, useState } from "react";
import Composer from "@/components/Composer";
import Detail from "@/components/Detail";
import SearchPalette from "@/components/SearchPalette";
import Sidebar, { MAX_WIDTH, MIN_WIDTH } from "@/components/Sidebar";
import Toolbar from "@/components/Toolbar";
import Toast from "@/components/Toast";
import { dissolve } from "@/lib/dust";
import { canWebp, saveImage } from "@/lib/export";
import type { Note } from "@/lib/notes";
import { useBoard } from "@/lib/use-board";

export default function Board({ initial }: { initial: Note[] }) {
  const board = useBoard(initial);
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [findOpen, setFindOpen] = useState(false);
  const [zoomBadge, setZoomBadge] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [width, setWidth] = useState(320);
  const wide = useRef(320);

  /** One click walks the same three stops a drag can land on by hand, then back. */
  const cycleWidth = useCallback(() => {
    setWidth((w) => {
      if (w > 260) { wide.current = w; return 150; }
      if (w > 110) return MIN_WIDTH;
      return Math.min(MAX_WIDTH, wide.current);
    });
  }, []);
  const badgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A new note starts at actual size and with nothing found in it.
  useEffect(() => { setFindOpen(false); }, [board.selected]);

  // Restored from the last session, so a note opens at the size you chose rather
  // than at whatever its own HTML asks for.
  useEffect(() => {
    const saved = Number(localStorage.getItem("pageZoom"));
    if (saved > 0) setZoom(saved);
  }, []);

  const zoomTo = useCallback((next: number) => {
    const clamped = Math.min(3, Math.max(0.5, Math.round(next * 10) / 10));
    setZoom(clamped);
    try {
      localStorage.setItem("pageZoom", String(clamped));
    } catch {
      // A locked-down browser is no reason to refuse the zoom itself.
    }
    setZoomBadge(true);
    if (badgeTimer.current) clearTimeout(badgeTimer.current);
    badgeTimer.current = setTimeout(() => setZoomBadge(false), 1100);
  }, []);

  /**
   * Move the open note to TRASH behind the dissolve. `ask` is the toolbar path -
   * a click can land by accident on a toolbar you were only passing through. The
   * shortcut exists to be fast, so it skips the question.
   */
  const trash = useCallback(
    async (ask: boolean) => {
      const note = board.selectedNote;
      if (!note || board.viewingTrash || note.frozen) return;
      if (ask && !confirm(`Move “${note.title}” to TRASH?\n\nIt stays in TRASH for 7 days. Cmd+Delete skips this question.`))
        return;
      const work = () => board.trashSelected();
      if (pane) await dissolve(pane, note.folder_color ?? "#8a8073", work);
      else await work();
    },
    [board, pane],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const cmd = e.metaKey || e.ctrlKey;
      const typing = isTyping(e.target);

      // The palette handles its own keys; stepping tabs behind it would move the
      // selection out from under the result being aimed at.
      if (board.paletteOpen || board.composerOpen) {
        if (e.key === "Escape" && board.paletteOpen) board.setPaletteOpen(false);
        return;
      }

      if (e.key === "Escape" && findOpen) { setFindOpen(false); return void e.preventDefault(); }

      if (cmd) {
        const key = e.key.toLowerCase();
        // SwiftUI's "+" shortcut only ever matched the shifted key, so a plain
        // Cmd+= - what everyone actually presses - never fired. Both are matched.
        if (key === "=" || key === "+") return hit(e, () => zoomTo(zoom + 0.1));
        if (key === "-" || key === "_") return hit(e, () => zoomTo(zoom - 0.1));
        if (key === "0") return hit(e, () => zoomTo(1));
        if (key === "f") return hit(e, () => (e.shiftKey ? board.setPaletteOpen(true) : board.selectedNote && setFindOpen(true)));
        if (key === "n") return hit(e, () => board.setComposerOpen(true));
        if (key === "r") return hit(e, () => void board.load());
        if (key === "s")
          return hit(e, () => {
            if (!board.selectedNote) return;
            const format = e.shiftKey && canWebp ? "webp" : "png";
            void saveImage(board.selectedNote.title, format).then((r) =>
              board.show(r.ok ? "success" : "failure", r.message),
            );
          });
        if (e.shiftKey && key === "]") return hit(e, () => board.stepTab(1));
        if (e.shiftKey && key === "[") return hit(e, () => board.stepTab(-1));
        if (e.shiftKey && key === "w") return hit(e, () => board.selected && board.closeTab(board.selected));
        if (e.key === "Backspace" || e.key === "Delete") return hit(e, () => void trash(false));
        return;
      }

      // Plain arrows step through the notes, but stand down while a field is being
      // typed into so they still move the caret there.
      if (typing) return;
      if (e.key === "ArrowLeft") return hit(e, () => board.stepTab(-1));
      if (e.key === "ArrowRight") return hit(e, () => board.stepTab(1));
      if (e.key === "ArrowUp") return hit(e, () => board.stepSelection(-1));
      if (e.key === "ArrowDown") return hit(e, () => board.stepSelection(1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [board, zoom, zoomTo, findOpen, trash]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <Toolbar
        board={board}
        sidebarHidden={sidebarHidden}
        toggleSidebar={() => setSidebarHidden((was) => !was)}
        cycleWidth={cycleWidth}
        zoom={zoom}
        setZoom={zoomTo}
        onTrash={() => void trash(true)}
      />
      <div className="flex min-h-0 flex-1">
        {!sidebarHidden && <Sidebar board={board} width={width} setWidth={setWidth} />}
        <Detail
          board={board}
          sidebarHidden={sidebarHidden}
          pane={pane}
          setPane={setPane}
          zoom={zoom}
          findOpen={findOpen}
          setFindOpen={setFindOpen}
        />
      </div>

      {/* Top centre: the find bar owns the top right and the submitter chip the
          bottom left, so this lands on the one edge nothing else uses. */}
      {zoomBadge && <ZoomBadge zoom={zoom} />}
      <Toast board={board} />
      {board.paletteOpen && <SearchPalette board={board} />}
      {board.composerOpen && <Composer board={board} />}
    </div>
  );
}

/** A fixed dark HUD, not a translucent one: the note under it is a white page. */
function ZoomBadge({ zoom }: { zoom: number }) {
  const Icon = zoom > 1 ? MagnifyingGlassPlusIcon : zoom < 1 ? MagnifyingGlassMinusIcon : MagnifyingGlassIcon;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-[16px] left-1/2 flex -translate-x-1/2 items-center gap-[7px]
                 rounded-full border border-white/12 bg-black/78 px-[14px] py-[8px] text-[15px]
                 font-semibold text-white shadow-lg"
    >
      <Icon className="size-[15px] text-white/65" />
      <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
    </div>
  );
}

function hit(e: KeyboardEvent, run: () => void) {
  e.preventDefault();
  run();
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable === true;
}
