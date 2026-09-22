"use client";

import { CheckIcon, ClipboardIcon, KeyIcon, ShareIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/notes";
import type { Board } from "@/lib/use-board";

/**
 * The link is served by the FULL app, not this one. This app has no sign-in and
 * is meant for localhost, so it would be the wrong thing to expose - it flips
 * the flag both apps read and hands you the other app's URL.
 */
const SHARE_BASE =
  process.env.NEXT_PUBLIC_SHARE_BASE ?? process.env.NEXT_PUBLIC_STICKIES_URL ?? "http://localhost:4444";

const shareUrl = (id: string) => `${SHARE_BASE}/share?noteId=${encodeURIComponent(id)}`;

export default function ShareMenu({ board, note }: { board: Board; note: Note }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  // A new note starts with a closed sheet and an empty field - a passcode left
  // in the box is one stray Enter away from landing on the wrong note.
  useEffect(() => { setOpen(false); setPasscode(""); }, [note.id]);

  async function run(work: Promise<unknown>) {
    setBusy(true);
    await work;
    setBusy(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl(note.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      board.show("failure", "The browser would not let me reach the clipboard");
    }
  }

  return (
    <span className="relative">
      <button
        onClick={() => setOpen((was) => !was)}
        disabled={note.frozen}
        title={note.frozen ? "This note is locked - unlock it in the web app" : "Share and lock"}
        aria-label="Share and lock"
        className="transition-colors hover:text-[var(--label)] disabled:pointer-events-none disabled:opacity-30"
      >
        <ShareIcon className={`size-[15px] ${note.is_public ? "text-[#34c759]" : ""}`} />
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Share and lock"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            className="absolute top-[24px] right-0 z-20 w-[300px] rounded-[10px] border border-[var(--divider)]
                       bg-[var(--toolbar)] p-3 text-left shadow-xl"
          >
            <label className="flex items-center gap-2">
              <span className="flex-1 text-[12px] font-semibold">Anyone with the link</span>
              <Switch
                on={note.is_public}
                busy={busy}
                onChange={(next) => void run(board.share(note.id, next))}
              />
            </label>

            {note.is_public && (
              <div className="mt-[10px] flex items-center gap-[6px] rounded-[6px] bg-[var(--fill-field)] px-2 py-[5px]">
                <span className="flex-1 truncate text-[11px] text-[var(--secondary)]">{shareUrl(note.id)}</span>
                <button onClick={copy} aria-label="Copy the link" className="shrink-0 text-[var(--secondary)] hover:text-[var(--label)]">
                  {copied ? <CheckIcon className="size-[13px] text-[#34c759]" /> : <ClipboardIcon className="size-[13px]" />}
                </button>
              </div>
            )}

            <div className="mt-3 border-t border-[var(--divider)] pt-3">
              <span className="flex items-center gap-[6px] text-[12px] font-semibold">
                <KeyIcon className="size-[12px] text-[#30b0c7]" />
                Passcode
                {note.locked && <span className="text-[10px] font-normal text-[var(--secondary)]">set</span>}
              </span>

              {/* Set and replace are the same gesture: the old passcode is never
                  shown, so there is nothing to edit, only something to overwrite. */}
              <div className="mt-[8px] flex items-center gap-[6px]">
                <input
                  ref={field}
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !passcode.trim()) return;
                    void run(board.lock(note.id, passcode.trim()).then(() => setPasscode("")));
                  }}
                  placeholder={note.locked ? "Replace it" : "Set one"}
                  aria-label="Passcode"
                  className="h-[26px] flex-1 rounded-[6px] bg-[var(--fill-field)] px-2 text-[12px] outline-none
                             placeholder:text-[var(--secondary)]"
                />
                <button
                  onClick={() => void run(board.lock(note.id, passcode.trim()).then(() => setPasscode("")))}
                  disabled={busy || !passcode.trim()}
                  className="rounded-[6px] bg-[#0066cc] px-[10px] py-[5px] text-[11px] text-white disabled:opacity-40"
                >
                  {note.locked ? "Replace" : "Set"}
                </button>
              </div>

              {note.locked && (
                <button
                  onClick={() => void run(board.lock(note.id, null))}
                  disabled={busy}
                  className="mt-[8px] text-[11px] text-[#ff3b30] hover:underline disabled:opacity-40"
                >
                  Remove the passcode
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </span>
  );
}

/** Green when on, a solid grey track when off, white thumb with a shadow. */
function Switch({ on, busy, onChange }: { on: boolean; busy: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label="Anyone with the link"
      disabled={busy}
      onClick={() => onChange(!on)}
      style={{ background: on ? "#22c55e" : "var(--switch-off)" }}
      className="relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors disabled:opacity-50"
    >
      <span
        className="absolute top-[2px] size-[16px] rounded-full bg-white transition-all"
        style={{ left: on ? 16 : 2, boxShadow: "0 1px 3px rgba(0,0,0,.3)" }}
      />
    </button>
  );
}
