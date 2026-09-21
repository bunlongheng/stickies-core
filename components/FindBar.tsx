"use client";

import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import * as Finder from "@/lib/find";
import { guardPaste } from "@/lib/paste-guard";

/**
 * Find in note, floating over the page - field, live counter, step buttons. Over
 * the note rather than in the toolbar: as a toolbar item it was the first thing a
 * narrow window pushed into the overflow chevron, so the shortcut focused a field
 * that was not on screen.
 */
export default function FindBar({ pane, onClose }: { pane: HTMLElement | null; onClose: () => void }) {
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState(0);
  const [current, setCurrent] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => field.current?.focus(), []);

  useEffect(() => {
    if (!pane) return;
    const count = Finder.find(pane, term);
    setMatches(count);
    setCurrent(count ? 1 : 0);
  }, [term, pane]);

  // The marks belong to the note, not to this bar: leave them behind and the next
  // note inherits somebody else's highlights.
  useEffect(() => () => { if (pane) Finder.clear(pane); }, [pane]);

  function move(direction: number) {
    if (!pane) return;
    setCurrent(Finder.step(pane, direction));
  }

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Enter") move(e.shiftKey ? -1 : 1);
      }}
      className="absolute top-[10px] right-[10px] z-20 flex items-center gap-[6px] rounded-[8px]
                 border border-[var(--divider)] bg-[var(--toolbar)] px-[10px] py-[7px] shadow-lg"
    >
      <MagnifyingGlassIcon className="size-[11px] shrink-0 text-[var(--secondary)]" />
      <input
        ref={field}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onPaste={guardPaste}
        placeholder="Find in note"
        aria-label="Find in note"
        className="h-[18px] w-[150px] bg-transparent text-[12px] outline-none"
      />
      {term && (
        <span
          role="status"
          aria-label={matches === 0 ? "no matches" : `match ${current} of ${matches}`}
          className="shrink-0 text-[10px] tabular-nums"
          style={{ color: matches === 0 ? "#e08b00" : "var(--secondary)" }}
        >
          {matches === 0 ? "none" : `${current}/${matches}`}
        </span>
      )}
      <button onClick={() => move(-1)} disabled={!matches} aria-label="Previous match" className="disabled:opacity-30">
        <ChevronUpIcon className="size-[10px]" />
      </button>
      <button onClick={() => move(1)} disabled={!matches} aria-label="Next match" className="disabled:opacity-30">
        <ChevronDownIcon className="size-[10px]" />
      </button>
      <button onClick={onClose} aria-label="Close find" className="text-[var(--secondary)]">
        <XMarkIcon className="size-[10px]" />
      </button>
    </div>
  );
}
