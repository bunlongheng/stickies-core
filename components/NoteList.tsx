"use client";

import { MagnifyingGlassIcon, XCircleIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export type Row = {
  id: string;
  title: string;
  date: string;
  color: string;
  icon: string;
  status: "frozen" | "locked" | "public" | null;
};

type Props = {
  rows: Row[];
  /** One rendered icon per distinct token, keyed by token. Server-rendered. */
  sprites: Record<string, React.ReactNode>;
  badges: Record<"frozen" | "locked" | "public", React.ReactNode>;
};

export default function NoteList({ rows, sprites, badges }: Props) {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const selected = pathname.startsWith("/n/") ? pathname.slice(3) : null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  // Arrow keys walk the list from anywhere, including the search field - the one
  // thing Noto's sidebar drops into AppKit to get.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const at = visible.findIndex((r) => r.id === selected);
      const next = e.key === "ArrowDown" ? at + 1 : at - 1;
      const row = visible[Math.max(0, Math.min(next, visible.length - 1))];
      if (row && row.id !== selected) router.push(`/n/${row.id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selected, router]);

  return (
    <nav className="flex w-[320px] shrink-0 flex-col border-r border-[var(--divider)] bg-[var(--sidebar)]">
      <div className="flex items-center gap-2 px-[10px] pt-[10px] pb-[6px]">
        <span className="text-[12px] font-semibold">All Notes</span>
        <span className="rounded-full bg-[var(--fill-badge)] px-[5px] py-[2px] text-[10px] font-semibold">
          {query ? `${visible.length} of ${rows.length}` : rows.length}
        </span>
      </div>

      <div className="mx-[10px] mb-[8px] flex items-center gap-[6px] rounded-[6px] bg-[var(--fill-field)] px-[8px] py-[5px]">
        <MagnifyingGlassIcon className="size-[11px] shrink-0 text-[var(--secondary)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter notes"
          className="h-4 w-full bg-transparent text-[12px] outline-none placeholder:text-[var(--secondary)]"
        />
        {query ? (
          <button onClick={() => setQuery("")} aria-label="Clear search">
            <XCircleIcon className="size-[11px] text-[var(--secondary)]" />
          </button>
        ) : null}
      </div>

      <div className="h-px bg-[var(--divider)]" />

      {visible.length === 0 ? (
        <p className="p-8 text-center text-[13px] text-[var(--secondary)]">
          No match for &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="scroll flex-1 overflow-y-auto px-[6px] py-[4px]">
          {visible.map((r) => (
            <NoteRow
              key={r.id}
              row={r}
              selected={r.id === selected}
              icon={sprites[r.icon]}
              badge={r.status ? badges[r.status] : null}
            />
          ))}
        </div>
      )}
    </nav>
  );
}

function NoteRow({
  row,
  selected,
  icon,
  badge,
}: {
  row: Row;
  selected: boolean;
  icon: React.ReactNode;
  badge: React.ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  // Arrow-stepping past the edge of the window would otherwise move a selection
  // nobody can see.
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <Link
      ref={ref}
      href={`/n/${row.id}`}
      // The selected row wears its own folder colour, the way the web list does -
      // the system accent blue says nothing about which note this is.
      style={selected ? { background: `color-mix(in srgb, ${row.color} 28%, transparent)` } : undefined}
      className={`flex items-center gap-[6px] rounded-[6px] px-[6px] py-[3px] ${
        selected ? "" : "hover:bg-[var(--hover)]"
      }`}
    >
      <span className="flex w-4 shrink-0 justify-center" style={{ color: row.color }}>
        {icon}
      </span>
      <span className="truncate text-[12px]">{row.title}</span>
      <span className="ml-auto flex shrink-0 items-center gap-[6px] pl-[6px]">
        {badge}
        <span className="w-[50px] text-right text-[10px] tabular-nums text-[var(--secondary)]">
          {row.date}
        </span>
      </span>
    </Link>
  );
}
