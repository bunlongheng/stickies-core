const UNITS: [limit: number, per: number, name: Intl.RelativeTimeFormatUnit][] = [
  [60, 1, "second"],
  [3600, 60, "minute"],
  [86400, 3600, "hour"],
  [604800, 86400, "day"],
  [2629800, 604800, "week"],
  [31557600, 2629800, "month"],
  [Infinity, 31557600, "year"],
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 hours ago" from a timestamp. */
export function when(at: string | Date) {
  const secs = (Date.now() - new Date(at).getTime()) / 1000;
  const [, per, name] = UNITS.find(([limit]) => secs < limit)!;
  return rtf.format(-Math.round(secs / per), name);
}
