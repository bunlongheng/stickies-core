/**
 * The sidebar stamp, formatted the way Noto formats it: the time for a note from
 * today, "Sep 17" within this year, and a short numeric date before that.
 */
const timeOnly = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayMonth = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const withYear = new Intl.DateTimeFormat("en-US", { dateStyle: "short" });

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
