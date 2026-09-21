import Link from "next/link";

/**
 * One line of the index - a folder or a note. The row carries its colour in
 * `--c`, which drives both the dot and the hover wash.
 */
export default function Row({
  href,
  title,
  meta,
  color,
  index,
}: {
  href: string;
  title: string;
  meta: string;
  color: string;
  index: number;
}) {
  return (
    <Link
      href={href}
      style={{ ["--c" as string]: color, ["--i" as string]: index }}
      className="rise group relative grid grid-cols-[9px_1fr_auto] items-baseline gap-x-5 border-b border-rule px-3 py-5
                 before:absolute before:inset-0 before:bg-(--c) before:opacity-0 before:transition-opacity before:duration-300
                 hover:before:opacity-8"
    >
      <span
        aria-hidden
        className="relative top-[-3px] size-[9px] rounded-full bg-(--c) transition-transform duration-300 group-hover:scale-150"
        style={{ boxShadow: `0 0 0 0 ${color}` }}
      />
      <span className="relative font-display text-2xl leading-tight text-paper transition-transform duration-300 group-hover:translate-x-1">
        {title || "Untitled"}
      </span>
      <span className="relative text-[10px] uppercase tracking-[0.2em] text-muted">{meta}</span>
    </Link>
  );
}
