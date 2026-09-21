"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Two-step delete: the first click arms it, the second sends it. Deleting is a
 * soft delete server-side, so an accident is recoverable in the full app.
 */
export default function DeleteButton({ id, backHref }: { id: string; backHref: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      router.push(backHref);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => (armed ? remove() : setArmed(true))}
        onBlur={() => setArmed(false)}
        className={`rounded-full border px-5 py-2 text-[10px] uppercase tracking-[0.2em] transition-colors duration-200 disabled:opacity-40 ${
          armed
            ? "border-[#c2442f] bg-[#c2442f] text-paper"
            : "border-rule text-muted hover:border-[#c2442f] hover:text-[#c2442f]"
        }`}
      >
        {busy ? "Deleting" : armed ? "Confirm delete" : "Delete note"}
      </button>
      {error ? <span className="text-[11px] text-[#c2442f]">{error}</span> : null}
    </div>
  );
}
