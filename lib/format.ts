import type { Note } from "@/lib/notes";

const timeOnly = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const withYear = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });

/** Time for a note from today, "Sep 17" within this year, a short date before that. */
export function displayDate(stamp: string) {
  const date = new Date(stamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return timeOnly.format(date);
  if (date.getFullYear() === now.getFullYear()) return dayMonth.format(date);
  return withYear.format(date);
}

/** "Sep 17 - 2:32 PM", the stamp the web footer shows. */
export function fullStamp(stamp: string) {
  const date = new Date(stamp);
  return `${dayMonth.format(date)} - ${timeOnly.format(date)}`;
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
const UNITS: [number, number, Intl.RelativeTimeFormatUnit][] = [
  [60, 1, "second"], [3600, 60, "minute"], [86400, 3600, "hour"],
  [604800, 86400, "day"], [2629800, 604800, "week"],
  [31557600, 2629800, "month"], [Infinity, 31557600, "year"],
];

/** "2 hr. ago", next to the stamp, as the web footer shows it. */
export function ago(stamp: string) {
  const secs = (Date.now() - new Date(stamp).getTime()) / 1000;
  const [, per, unit] = UNITS.find(([limit]) => secs < limit)!;
  return RELATIVE.format(-Math.round(secs / per), unit);
}

/** Days before the server purges a trashed note, or null when it is not in TRASH. */
export function daysLeft(trashedAt: string | null) {
  if (!trashedAt) return null;
  const gone = new Date(trashedAt).getTime() + 7 * 86_400_000;
  return Math.max(0, Math.floor((gone - Date.now()) / 86_400_000) + 1);
}

/**
 * Two machines get their own badge instead of the generic one: the hub that runs
 * the notes app, and a second workstation. Both are named in the environment -
 * a machine name is somebody's hardware, not something to ship in source.
 */
const HUB = process.env.NEXT_PUBLIC_HUB_MACHINE ?? "";
const WORKSTATION = process.env.NEXT_PUBLIC_WORKSTATION_MACHINE ?? "";

/** Who posted it: a named machine by its hostname, an app by its key, the owner as "me". */
export function submitterName(note: Note) {
  if (WORKSTATION && note.created_by_machine === WORKSTATION) return WORKSTATION;
  const key = note.created_by_key ?? "";
  return !key || key === "stickies" ? "me" : key;
}

const STICKIES = process.env.NEXT_PUBLIC_STICKIES_URL ?? "http://localhost:4444";

/**
 * Candidate badges for who posted this note, best first - each served by the
 * notes app itself, so the caller falls through the list on a 404. Same order
 * the web list uses, and the same suffix rule, so "automations-pipeline" falls
 * back to "automations".
 */
export function submitterIcons(note: Note): string[] {
  const hub = !!HUB && note.created_by_machine === HUB;
  const fallback = hub ? `${STICKIES}/machines/mac-mini-front.png` : `${STICKIES}/app-icons/stickies.png`;
  if (WORKSTATION && note.created_by_machine === WORKSTATION) {
    return [`${STICKIES}/machines/macbook-m2.png`, fallback];
  }
  const key = (note.created_by_key ?? "").toLowerCase();
  if (!key || key === "stickies" || (!!HUB && key === HUB.toLowerCase())) {
    return [hub ? `${STICKIES}/machines/mac-mini-front.png` : `${STICKIES}/avatar.png`, fallback];
  }
  const head = key.split("-")[0];
  const urls = [`${STICKIES}/app-icons/${key}.png`];
  if (head !== key) urls.push(`${STICKIES}/app-icons/${head}.png`);
  return [...urls, fallback];
}

/**
 * Dark ink on a light tile, white on a dark one. Folder colours run from pale
 * yellow to near-black, so a label has to pick its ink from the tile's own
 * luminance instead of always being white.
 */
export function ink(hex: string | null) {
  const rgb = parse(hex);
  if (!rgb) return "#ffffff";
  const luma = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luma > 0.6 ? "#1c1c1e" : "#ffffff";
}

function parse(hex: string | null): [number, number, number] | null {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** First letter or digit of the title, uppercased - the web's meaningfulInitial. */
export function initial(title: string) {
  return (title.match(/[a-z0-9]/i)?.[0] ?? "N").toUpperCase();
}
