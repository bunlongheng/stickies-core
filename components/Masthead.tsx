import Link from "next/link";

/** Page header: an optional back link, the title, and a one-line caption. */
export default function Masthead({
  title,
  caption,
  back,
  color = "#8a8073",
}: {
  title: string;
  caption: string;
  back?: { href: string; label: string };
  color?: string;
}) {
  return (
    <header className="mb-12">
      {back ? (
        <Link
          href={back.href}
          className="group mb-8 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-paper"
        >
          <span className="transition-transform duration-300 group-hover:-translate-x-1">&larr;</span>
          {back.label}
        </Link>
      ) : null}
      <h1
        className="font-display text-5xl leading-none tracking-tight sm:text-6xl"
        style={{ color }}
      >
        {title || "Untitled"}
      </h1>
      <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-muted">{caption}</p>
    </header>
  );
}
