"use client";

import { useState } from "react";
import { submitterIcons, submitterName } from "@/lib/format";
import type { Note } from "@/lib/notes";

/**
 * Who posted this note, as the icon the notes app serves for it. Each candidate
 * is tried in turn - a 404 must never leave a row showing a broken image.
 */
export default function SubmitterBadge({ note, size = 13 }: { note: Note; size?: number }) {
  const urls = submitterIcons(note);
  const [at, setAt] = useState(0);
  if (at >= urls.length) return <span className="shrink-0" style={{ width: size }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the notes app serves these, not this one
    <img
      src={urls[at]}
      alt={submitterName(note)}
      title={submitterName(note)}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setAt((i) => i + 1)}
      className="shrink-0 rounded-[3px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}
