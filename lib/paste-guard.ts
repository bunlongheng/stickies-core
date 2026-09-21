/**
 * Stops the second Cmd+V.
 *
 * A paste that only repeats what the field already holds is an accident - the
 * key landing twice, or a trackpad click that fired twice - and the search then
 * runs against "Iframe Iframe" and reports none, which reads as a broken search
 * rather than as a double paste.
 *
 * Only an exact repeat of the WHOLE field is refused. Pasting a word into a
 * field that holds something else, or a second different word, is a normal edit
 * and goes through untouched.
 */
export function guardPaste(e: React.ClipboardEvent<HTMLInputElement>) {
  const pasted = e.clipboardData.getData("text").trim();
  const held = e.currentTarget.value.trim();
  if (!pasted || !held) return;
  if (held.toLowerCase() === pasted.toLowerCase()) e.preventDefault();
}
