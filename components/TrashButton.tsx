"use client";

import { TrashIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The toolbar trash. It asks first - a click can land by accident on a toolbar
 * you were only passing through. A frozen note is refused by the server, so the
 * button is disabled rather than failing halfway.
 */
export default function TrashButton({
  id,
  title,
  frozen,
}: {
  id: string;
  title: string;
  frozen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function trash() {
    if (!confirm(`Move “${title}” to TRASH?`)) return;
    setBusy(true);
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert((await res.json().catch(() => null))?.error ?? "Could not move the note to TRASH.");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={trash}
      disabled={frozen || busy}
      title={frozen ? "This note is locked - unlock it in the web app" : "Move to TRASH"}
      aria-label="Move note to trash"
      className="ml-auto shrink-0 rounded-[5px] p-[5px] text-[var(--secondary)] transition-colors
                 hover:bg-[var(--hover)] hover:text-[#ff3b30] disabled:pointer-events-none disabled:opacity-35"
    >
      <TrashIcon className="size-[15px]" />
    </button>
  );
}
