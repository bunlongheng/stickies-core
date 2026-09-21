"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";
import { useEffect, useMemo, useRef, useState } from "react";
import { displayDate, searchKey } from "@/lib/format";
import { NoteGlyph } from "@/lib/icons";
import type { Note } from "@/lib/notes";
import type { Board } from "@/lib/use-board";

/**
 * Centred search over every note, the way the web app's Cmd-K palette works.
 *
 * The sidebar already filters the list in place, but that is browsing, not
 * jumping - and at icon width the sidebar has no field at all. This floats over
 * whatever is open, takes a query, and lands on a note.
 */
export default function SearchPalette({ board }: { board: Board }) {
  const { searchBodies } = board;
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [bodyHits, setBodyHits] = useState<Note[]>([]);
  const [searching, setSearching] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();

  const titleIds = useMemo(
    () => new Set(q ? board.notes.filter((n) => searchKey(n).includes(q)).map((n) => n.id) : []),
    [board.notes, q],
  );

  /**
   * Titles first, then the notes that only matched in their text. Capped: the
   * palette is for finding one note, and a list of 1,400 rows is not a result, it
   * is the whole database again.
   */
  const results = useMemo(() => {
    if (!q) return board.notes.slice(0, 30);
    const titles = board.notes.filter((n) => searchKey(n).includes(q)).slice(0, 30);
    const seen = new Set(titles.map((n) => n.id));
    return [...titles, ...bodyHits.filter((n) => !seen.has(n.id)).slice(0, 30)];
  }, [board.notes, q, bodyHits]);

  useEffect(() => setHighlighted(0), [query]);

  // Debounced: one request per pause in typing, not one per keystroke. Two
  // characters is the floor - "a" would come back with half the database.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setBodyHits([]);
      setSearching(false);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      const hits = await searchBodies(term);
      if (!live) return;
      setBodyHits(hits);
      setSearching(false);
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, searchBodies]);

  useEffect(() => {
    list.current?.children[highlighted]?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  /** Selecting a note also clears the sidebar filter - landing on a note the list
      is hiding would drop the selection again on the next refilter. */
  function open(note: Note | undefined) {
    if (!note) return;
    board.setQuery("");
    board.setSelected(note.id);
    board.setPaletteOpen(false);
  }

  return (
    <div
      className="absolute inset-0 z-30 bg-black/35"
      onClick={() => board.setPaletteOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search all notes"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto mt-[110px] w-[620px] overflow-hidden rounded-[12px] border
                   border-[var(--divider)] bg-[var(--toolbar)] shadow-2xl"
      >
        <div className="flex h-[52px] items-center gap-[9px] px-4">
          <MagnifyingGlassIcon className="size-[14px] shrink-0 text-[var(--secondary)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") return board.setPaletteOpen(false);
              if (e.key === "Enter") return open(results[highlighted]);
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              e.preventDefault();
              if (!results.length) return;
              const step = e.key === "ArrowDown" ? 1 : -1;
              setHighlighted((at) => (at + step + results.length) % results.length);
            }}
            placeholder="Search all notes"
            aria-label="Search all notes"
            className="w-full bg-transparent text-[17px] outline-none"
          />
          <span className="shrink-0 rounded-[4px] bg-[var(--fill-badge)] px-[6px] py-[2px] text-[10px] font-semibold text-[var(--secondary)]">
            esc
          </span>
        </div>

        {results.length === 0 ? (
          <p className="border-t border-[var(--divider)] py-[22px] text-center text-[12px] text-[var(--secondary)]">
            {searching ? "Searching..." : `No note matches “${query}”`}
          </p>
        ) : (
          <div ref={list} className="scroll max-h-[340px] overflow-y-auto border-t border-[var(--divider)]">
            {results.map((note, index) => (
              <Row
                key={note.id}
                note={note}
                active={index === highlighted}
                inBody={!!q && !titleIds.has(note.id)}
                onPick={() => open(note)}
                onHover={() => setHighlighted(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  note, active, inBody, onPick, onHover,
}: { note: Note; active: boolean; inBody: boolean; onPick: () => void; onHover: () => void }) {
  return (
    <button
      onClick={onPick}
      onMouseMove={onHover}
      className={`flex w-full items-center gap-[10px] px-4 py-[7px] text-left ${active ? "bg-[#0066cc38]" : ""}`}
    >
      <span className="flex w-[18px] shrink-0 justify-center" style={{ color: note.folder_color ?? "var(--secondary)" }}>
        <NoteGlyph token={note.icon} className="size-[13px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{note.title || "Untitled"}</span>
        {note.folder_name && (
          <span className="block truncate text-[11px] text-[var(--secondary)]">{note.folder_name}</span>
        )}
      </span>
      {inBody && (
        <span className="shrink-0 rounded-full bg-[var(--fill-badge)] px-[5px] py-[2px] text-[9px] font-semibold text-[var(--secondary)]">
          in text
        </span>
      )}
      <span className="shrink-0 text-[10px] text-[var(--secondary)]">{displayDate(note.created_at)}</span>
    </button>
  );
}
