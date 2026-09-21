import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1 className="font-display text-5xl">Not here.</h1>
      <Link href="/" className="mt-6 inline-block text-[10px] uppercase tracking-[0.2em] text-muted hover:text-paper">
        &larr; All folders
      </Link>
    </main>
  );
}
