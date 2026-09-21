import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid h-dvh place-items-center bg-[var(--toolbar)] text-[13px] text-[var(--secondary)]">
      <p>
        That note is gone.{" "}
        <Link href="/" className="underline">
          All notes
        </Link>
      </p>
    </div>
  );
}
