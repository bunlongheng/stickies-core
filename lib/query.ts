/**
 * One tokenizer for both ends of the app: the sidebar filter runs it in the
 * browser over titles it already has, the palette runs it on the server over
 * every body. Same rules either place, so the same query cannot mean two things.
 */

/** Words, lowercased. "bunlongheng/snap-it" -> ["bunlongheng", "snap", "it"]. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** The query, as the terms every result has to satisfy. */
export function terms(query: string): string[] {
  return [...new Set(tokenize(query))];
}

export const FIELD = { title: 1, folder: 2, key: 4, body: 8 } as const;

/** Weight per field, and more for a whole word than for a prefix of one. */
const WEIGHT: Record<number, [exact: number, prefix: number]> = {
  [FIELD.title]: [12, 8],
  [FIELD.folder]: [6, 4],
  [FIELD.key]: [5, 3],
  [FIELD.body]: [1, 0.6],
};

export function weigh(field: number, exact: boolean) {
  return WEIGHT[field]?.[exact ? 0 : 1] ?? 0;
}

/**
 * Score one row against already-tokenized terms, where `fields` maps each field
 * to its tokens. Returns null when any term is unmatched - every term must land
 * somewhere, so "repo audit bun" cannot come back with notes that are merely
 * about audits.
 */
export function score(
  fields: { tokens: string[]; field: number }[],
  want: string[],
  haystack = "",
) {
  let total = 0;
  for (const term of want) {
    let best = 0;
    for (const { tokens, field } of fields) {
      for (const token of tokens) {
        if (token === term) best = Math.max(best, weigh(field, true));
        else if (token.startsWith(term)) best = Math.max(best, weigh(field, false));
      }
    }
    // A term nobody matched drops the row entirely.
    if (!best) {
      if (!haystack.includes(term)) return null;
      best = weigh(FIELD.body, false);
    }
    total += best;
  }
  return total;
}

/**
 * A run of the query's own words, in order, is worth more than the same words
 * scattered: "repo audit" should beat a note that says "audit" once and "repo"
 * somewhere else entirely.
 */
export function phraseBonus(query: string, title: string, folder: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return 0;
  const t = title.toLowerCase();
  if (t.startsWith(q)) return 30;
  if (t.includes(q)) return 18;
  if (folder.toLowerCase().includes(q)) return 10;
  // Adjacent words with anything between them - "repo-audit" for "repo audit".
  const loose = terms(q).join("[^a-z0-9]{0,3}");
  return loose && new RegExp(loose).test(t) ? 14 : 0;
}

/** Newer wins a tie, but recency can never outrank a better match. */
export function recencyBonus(createdAt: string) {
  const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
  return Math.max(0, 3 - days / 120);
}
