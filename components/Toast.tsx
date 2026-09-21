"use client";

import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import type { Board } from "@/lib/use-board";

/** Success and failure read differently, and both are announced to a screen reader. */
export default function Toast({ board }: { board: Board }) {
  const toast = board.toast;
  if (!toast) return null;
  const Icon = toast.kind === "success" ? CheckCircleIcon : ExclamationTriangleIcon;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute bottom-[24px] left-1/2 flex -translate-x-1/2 items-center gap-2
                 rounded-[9px] border border-[var(--divider)] bg-[var(--toolbar)] px-[14px] py-[9px]
                 text-[13px] shadow-lg"
    >
      <Icon className={`size-[15px] ${toast.kind === "success" ? "text-[#34c759]" : "text-[#e08b00]"}`} />
      <span className="max-w-[420px] truncate">{toast.text}</span>
      {toast.undo && board.canUndo && (
        <button onClick={board.undoTrash} className="text-[#0066cc] hover:underline">
          Undo
        </button>
      )}
    </div>
  );
}
