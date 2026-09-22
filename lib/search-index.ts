import "server-only";
import { FIELD, phraseBonus, recencyBonus, terms, tokenize, weigh } from "@/lib/query";
import { query } from "@/lib/db";

/**
 * An inverted index over every note body, held in the server process.
 *
 * `content ILIKE '%x%'` is a sequential scan over 141 MB and measured 1.5-2.1s a
 * query. Postgres could do better with a trigram index on `content`, but that is
 * a schema change to the database the real app shares, so the index lives here
 * instead: one 4s build, then every search is arithmetic over typed arrays.
 *
 * The bodies are stripped of markup IN Postgres, which is what makes the build
 * affordable - 141 MB of HTML comes back as 10 MB of words.
 */

type Doc = {
  id: string;
  title: string;
  folder: string;
  /** The posting app, plus the icon token - "__repoaudit" is how 197 notes are
      labelled, and typing "repoaudit" has to find them. */
  key: string;
  createdAt: string;
  /** Stripped body, lowercased, for snippets and for terms the vocab missed. */
  text: string;
};

type Index = {
  docs: Doc[];
  /** Sorted, so a prefix is a binary-searchable range. */
  vocab: string[];
  /** Per vocab entry: the docs it appears in, and in which fields. */
  postings: Int32Array[];
  fields: Uint8Array[];
  builtAt: number;
  /**
   * The real notes app writes to this same table all day, so the index is stale
   * the moment it is built. These three carry the difference: everything changed
   * since `watermark` is re-read into `delta` and searched alongside the index,
   * and anything trashed since lands in `removed`.
   */
  watermark: string;
  delta: Doc[];
  removed: Set<string>;
  checkedAt: number;
};

const CAP = 20_000; // characters of stripped text kept per note
const DELTA_LIMIT = 300; // past this the delta is no longer cheap; rebuild instead
/**
 * How stale the index is allowed to get. The freshness query is one indexed
 * range scan, but it is still a round trip to the database, and paying it on
 * every keystroke turned a 60ms search into 700ms. A second behind is not
 * something anyone can see; 700ms is.
 */
const FRESH_FOR = 1000;
const COLUMNS = `id, title, folder_name, created_by_key, icon, type, created_at, trashed_at,
            left(regexp_replace(regexp_replace(COALESCE(content, \'\'), \'<[^>]*>\', \' \', \'g\'),
                                \'\\s+\', \' \', \'g\'), ${CAP}) AS text`;

let index: Index | null = null;
let building: Promise<Index> | null = null;

/** Kick the build off without waiting for it - called when the board is served. */
export function warm() {
  void ensure();
}

export function ready() {
  return index !== null;
}

export async function ensure(): Promise<Index> {
  if (index) return index;
  building ??= build().finally(() => {
    building = null;
  });
  return building;
}

/**
 * Rebuild in the background, keeping the current index answering until the new
 * one is ready. Blocking here meant every create and every trash cost the next
 * search a 5s stall - and none of them need a rebuild at all, because a write
 * bumps `updated_at` and `topUp` collects it within the second.
 */
export function invalidate() {
  if (!index) return;
  void build().catch((e) => console.error("search index rebuild failed", e));
}

async function build(): Promise<Index> {
  const started = Date.now();
  // Only one rebuild at a time; a second request rides along with the first.
  if (building) return building;
  const rows = await query<Row>(
    `SELECT ${COLUMNS}, updated_at
       FROM stickies
      WHERE user_id = $1 AND NOT is_folder AND trashed_at IS NULL`,
    [process.env.OWNER_USER_ID ?? ""],
  );

  const docs = rows.map(toDoc);
  const watermark = rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), "");

  // token -> doc -> field bitmask, then flattened into parallel typed arrays.
  const table = new Map<string, Map<number, number>>();
  const add = (token: string, doc: number, field: number) => {
    let entry = table.get(token);
    if (!entry) table.set(token, (entry = new Map()));
    entry.set(doc, (entry.get(doc) ?? 0) | field);
  };

  docs.forEach((doc, i) => {
    for (const t of tokenize(doc.title)) add(t, i, FIELD.title);
    for (const t of tokenize(doc.folder)) add(t, i, FIELD.folder);
    for (const t of tokenize(doc.key)) add(t, i, FIELD.key);
    for (const t of tokenize(doc.text)) add(t, i, FIELD.body);
  });

  const vocab = [...table.keys()].sort();
  const postings = new Array<Int32Array>(vocab.length);
  const fields = new Array<Uint8Array>(vocab.length);
  vocab.forEach((token, v) => {
    const entry = table.get(token)!;
    postings[v] = Int32Array.from(entry.keys());
    fields[v] = Uint8Array.from(entry.values());
  });

  const next: Index = {
    docs, vocab, postings, fields,
    builtAt: Date.now(),
    watermark: watermark || new Date(0).toISOString(),
    delta: [],
    removed: new Set(),
    checkedAt: Date.now(),
  };
  index = next;
  console.log(
    `search index: ${docs.length} notes, ${vocab.length} terms, ${Date.now() - started}ms`,
  );
  return next;
}

/**
 * A term nobody knows, split into two terms everybody does.
 *
 * "repoaudit" is how the icon spells it and how people type it, but the folder
 * spells it "repo-audit" - two tokens. Rather than guess at every compound, the
 * unknown term is cut at each position and kept if both halves are real words.
 */
function split(vocab: string[], term: string): [string, string] | null {
  for (let at = 2; at <= term.length - 2; at++) {
    const head = term.slice(0, at);
    const tail = term.slice(at);
    if (known(vocab, head) && known(vocab, tail)) return [head, tail];
  }
  return null;
}

function known(vocab: string[], word: string) {
  const at = lowerBound(vocab, word);
  return at < vocab.length && vocab[at] === word;
}

/** Is any vocab entry a continuation of this term? */
function hasPrefix(vocab: string[], term: string) {
  const at = lowerBound(vocab, term);
  return at < vocab.length && vocab[at].startsWith(term);
}

type Row = {
  id: string;
  title: string | null;
  folder_name: string | null;
  created_by_key: string | null;
  icon: string | null;
  type: string | null;
  created_at: string;
  trashed_at: string | null;
  text: string | null;
  updated_at: string;
};

function toDoc(r: Row): Doc {
  return {
    id: r.id,
    title: r.title ?? "",
    folder: r.folder_name ?? "",
    key: [r.created_by_key, r.icon?.replace(/^__(hero:)?/, ""), r.type].filter(Boolean).join(" "),
    createdAt: r.created_at,
    text: (r.text ?? "").toLowerCase(),
  };
}

/**
 * Pull in whatever changed since the last look.
 *
 * One indexed range scan on (user_id, updated_at), so it costs nothing when
 * nothing has moved - which is the common case, and the case that has to stay
 * fast. Notes that arrived or changed go in the delta, notes that were trashed
 * go in `removed`, and once the delta stops being small the whole index is
 * rebuilt instead.
 */
async function topUp(idx: Index) {
  if (Date.now() - idx.checkedAt < FRESH_FOR) return;
  idx.checkedAt = Date.now();
  const rows = await query<Row>(
    `SELECT ${COLUMNS}, updated_at
       FROM stickies
      WHERE user_id = $1 AND NOT is_folder AND updated_at > $2
      ORDER BY updated_at
      LIMIT ${DELTA_LIMIT + 1}`,
    [process.env.OWNER_USER_ID ?? "", idx.watermark],
  );
  if (!rows.length) return;

  for (const row of rows) {
    idx.watermark = row.updated_at > idx.watermark ? row.updated_at : idx.watermark;
    // A note can only appear once: the fresh copy in the delta wins over the one
    // baked into the postings, and `removed` is what silences the stale copy.
    idx.delta = idx.delta.filter((d) => d.id !== row.id);
    if (row.trashed_at) {
      idx.removed.add(row.id);
    } else {
      idx.removed.add(row.id);
      idx.delta.push(toDoc(row));
    }
  }
  // Past this the delta is no longer cheap to scan. Rebuild behind the scenes;
  // the current index keeps answering until the new one lands.
  if (idx.delta.length > DELTA_LIMIT) invalidate();
}

/** Score one delta doc the long way - there are only ever a handful. */
function scoreDoc(doc: Doc, want: string[]) {
  let total = 0;
  let fields = 0;
  const parts: [string, number][] = [
    [doc.title, FIELD.title], [doc.folder, FIELD.folder], [doc.key, FIELD.key],
  ];
  for (const term of want) {
    let best = 0;
    for (const [text, field] of parts) {
      for (const token of tokenize(text)) {
        if (token === term) { best = Math.max(best, weigh(field, true)); fields |= field; }
        else if (token.startsWith(term)) { best = Math.max(best, weigh(field, false)); fields |= field; }
      }
    }
    if (!best && doc.text.includes(term)) { best = weigh(FIELD.body, false); fields |= FIELD.body; }
    if (!best) return null;
    total += best;
  }
  return { score: total, fields };
}

/** First vocab position at or after `prefix`. */
function lowerBound(vocab: string[], prefix: string) {
  let lo = 0;
  let hi = vocab.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (vocab[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type Hit = { id: string; score: number; fields: number; snippet: string | null };

/**
 * Every term must land somewhere - a query is an AND, so "repo audit bun" cannot
 * come back with notes that are only about audits. A term matches a whole word or
 * the start of one, which is what makes "bun" find "bunlongheng".
 */
export async function search(raw: string, limit = 50): Promise<Hit[]> {
  const asked = terms(raw);
  if (!asked.length) return [];
  const idx = await ensure();
  await topUp(idx);

  // Expand what nobody recognises before deciding a query has no answer.
  const want = asked.flatMap((term) =>
    hasPrefix(idx.vocab, term) ? [term] : (split(idx.vocab, term) ?? [term]),
  );

  // score and field mask per doc, for the docs still in the running
  let alive: Map<number, { score: number; fields: number }> | null = null;

  for (const term of want) {
    const found = new Map<number, { score: number; fields: number }>();
    const from = lowerBound(idx.vocab, term);
    for (let v = from; v < idx.vocab.length && idx.vocab[v].startsWith(term); v++) {
      const exact = idx.vocab[v].length === term.length;
      const docsFor = idx.postings[v];
      const fieldsFor = idx.fields[v];
      for (let i = 0; i < docsFor.length; i++) {
        const doc = docsFor[i];
        if (idx.removed.has(idx.docs[doc].id)) continue;
        if (alive && !alive.has(doc)) continue;
        const mask = fieldsFor[i];
        // The best field this term hit in this note is the one it scores as.
        let best = 0;
        for (const field of [FIELD.title, FIELD.folder, FIELD.key, FIELD.body]) {
          if (mask & field) best = Math.max(best, weigh(field, exact));
        }
        const prev = found.get(doc);
        if (!prev || prev.score < best) found.set(doc, { score: best, fields: mask });
        else prev.fields |= mask;
      }
    }
    // Intersect: this term's hits, carrying the score accumulated so far.
    const next = new Map<number, { score: number; fields: number }>();
    for (const [doc, hit] of found) {
      const carried = alive?.get(doc);
      next.set(doc, {
        score: (carried?.score ?? 0) + hit.score,
        fields: (carried?.fields ?? 0) | hit.fields,
      });
    }
    alive = next;
    // Stop walking the index, but do NOT return: a note that arrived after the
    // build lives in the delta, and returning here never let it be scored.
    if (!alive.size) break;
  }

  const hits: Hit[] = [];
  for (const [doc, hit] of alive ?? []) {
    const d = idx.docs[doc];
    hits.push({
      id: d.id,
      score: hit.score + phraseBonus(raw, d.title, d.folder) + recencyBonus(d.createdAt),
      fields: hit.fields,
      snippet: hit.fields & (FIELD.title | FIELD.folder) ? null : snippet(d.text, want),
    });
  }
  // Notes that arrived or changed since the build, searched the direct way.
  for (const doc of idx.delta) {
    const hit = scoreDoc(doc, want);
    if (!hit) continue;
    hits.push({
      id: doc.id,
      score: hit.score + phraseBonus(raw, doc.title, doc.folder) + recencyBonus(doc.createdAt),
      fields: hit.fields,
      snippet: hit.fields & (FIELD.title | FIELD.folder) ? null : snippet(doc.text, want),
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** A window of the body around the first term that matched it. */
function snippet(text: string, want: string[]) {
  let at = -1;
  for (const term of want) {
    const found = text.indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at === -1) return null;
  const from = Math.max(0, at - 40);
  return (from ? "..." : "") + text.slice(from, from + 140).trim() + "...";
}
