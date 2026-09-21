"use client";

import { useEffect, useRef, useState } from "react";
import type { Board } from "@/lib/use-board";

/**
 * Compose a plain-text note. Deliberately title + body only: the note is filed
 * under CLAUDE and given its colour and icon on the way in, so anything more here
 * would be a form asking for values it is going to overwrite.
 */
export default function Composer({ board }: { board: Board }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => field.current?.focus(), []);

  async function create() {
    setSaving(true);
    await board.createNote(title.trim(), body);
    setSaving(false);
    board.setComposerOpen(false);
  }

  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center bg-black/35"
      onClick={() => board.setComposerOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New Note"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") board.setComposerOpen(false);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) void create();
        }}
        className="flex w-[520px] flex-col gap-[10px] rounded-[12px] border border-[var(--divider)]
                   bg-[var(--toolbar)] p-4 shadow-2xl"
      >
        <h2 className="text-[15px] font-semibold">New Note</h2>
        <input
          ref={field}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="rounded-[6px] bg-[var(--fill-field)] px-2 py-[6px] text-[13px] outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[240px] resize-none rounded-[6px] bg-[var(--fill-field)] p-[6px]
                     font-mono text-[13px] outline-none"
        />
        <div className="flex justify-end gap-2 text-[13px]">
          <button onClick={() => board.setComposerOpen(false)} className="rounded-[6px] px-3 py-[5px] hover:bg-[var(--hover)]">
            Cancel
          </button>
          {/* The body is required; a missing title is derived from its first line. */}
          <button
            onClick={create}
            disabled={saving || !body.trim()}
            className="rounded-[6px] bg-[#0066cc] px-3 py-[5px] text-white disabled:opacity-40"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
