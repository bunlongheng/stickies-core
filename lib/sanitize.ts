/**
 * A note is rendered, never executed.
 *
 * Noto strips scripts from the markup before handing it to WebKit rather than
 * disabling JavaScript wholesale, because its own find highlighter has to run.
 * The same rule here, plus the two things innerHTML lets through that a
 * `<script>` tag does not: inline handlers, and `javascript:` URLs.
 *
 * Links are also forced to open in a new tab - a note whose link navigated this
 * page would take the whole app with it.
 */
export function sanitize(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/((?:href|src|action)\s*=\s*["']?)\s*javascript:/gi, "$1#blocked:")
    .replace(/<a\b([^>]*)>/gi, (tag, attrs: string) =>
      /\btarget\s*=/i.test(attrs)
        ? `<a${attrs}>`
        : `<a${attrs} target="_blank" rel="noopener noreferrer">`,
    );
}
