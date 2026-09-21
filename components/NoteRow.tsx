"use client";

import { GlobeAltIcon, KeyIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import { memo } from "react";
import SubmitterBadge from "@/components/SubmitterBadge";
import { daysLeft, displayDate } from "@/lib/format";
import { NoteGlyph } from "@/lib/icons";
import type { Note } from "@/lib/notes";
import type { Density } from "@/components/Sidebar";

/**
 * Tight on purpose: every point the trailing columns give back is a point of
 * title the row can show before it truncates. Only the rows that HAVE a badge
 * pay for the lane.
 */
function NoteRow({
  note,
  selected,
  density,
  onSelect,
}: {
  note: Note;
  selected: boolean;
  density: Density;
  onSelect: () => void;
}) {
  const tint = note.folder_color ?? "var(--secondary)";
  const left = daysLeft(note.trashed_at);

  return (
    <button
      onClick={onSelect}
      title={density === "icons" ? note.title : undefined}
      aria-current={selected}
      // The selected row wears its own folder colour, the way the web list does -
      // the system accent blue says nothing about which note this is.
      className={`flex w-full items-center gap-[6px] rounded-[6px] px-[6px] text-left ${
        selected ? "" : "hover:bg-[var(--hover)]"
      }`}
      style={{ ...(selected ? { background: `color-mix(in srgb, ${tint} 28%, transparent)` } : {}), height: ROW_HEIGHT }}
    >
      <span className="flex w-4 shrink-0 justify-center" style={{ color: tint }}>
        <NoteGlyph token={note.icon} />
      </span>

      {/* The folder used to sit under the title, which cost every row a second
          line for something the icon's colour already carries. */}
      {density !== "icons" && <span className="truncate text-[12px]">{note.title || "Untitled"}</span>}

      {density === "full" && (
        <span className="ml-auto flex shrink-0 items-center gap-[6px] pl-[6px]">
          {/* One status glyph, never two locks, in the web list's own priority. */}
          {note.frozen ? (
            <LockClosedIcon className="size-[11px] text-[#e08b00]" title="Locked - cannot be trashed" />
          ) : note.locked ? (
            <KeyIcon className="size-[11px] text-[#30b0c7]" title="Private - passcode to view" />
          ) : note.is_public ? (
            <GlobeAltIcon className="size-[11px] text-[#34c759]" title="Public - anyone with the link" />
          ) : null}

          <SubmitterBadge note={note} />

          {/* In TRASH the date that matters is the deadline, not the creation time. */}
          {left !== null ? (
            <span
              className="w-[50px] text-right text-[10px] font-medium tabular-nums"
              style={{ color: left <= 1 ? "#ff3b30" : "#e08b00" }}
            >
              {left > 0 ? `${left}d left` : "expiring"}
            </span>
          ) : (
            <span className="w-[50px] text-right text-[10px] tabular-nums text-[var(--secondary)]">
              {displayDate(note.created_at)}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/** Fixed, so the list can window 1,400 rows without measuring any of them. */
export const ROW_HEIGHT = 23;

export default memo(NoteRow);
