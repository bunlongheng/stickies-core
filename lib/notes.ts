import { query } from "@/lib/db";
import { hashLockPassword } from "@/lib/lock-password";

/** A list row. The list never carries `content` - bodies are fetched one at a time. */
export type Note = {
  id: string;
  title: string;
  icon: string | null;
  folder_name: string | null;
  folder_id: string | null;
  folder_color: string | null;
  type: string | null;
  created_at: string;
  updated_at: string;
  trashed_at: string | null;
  created_by_key: string | null;
  created_by_machine: string | null;
  frozen: boolean;
  locked: boolean;
  is_public: boolean;
};

export type FullNote = Note & { content: string };

/** A list row carrying why the search returned it. Only set on search results. */
export type Ranked = Note & { score?: number; matched?: number; snippet?: string | null };

const OWNER = () => process.env.OWNER_USER_ID ?? "";

const LIST_COLUMNS = `
  id, title, icon, folder_name, folder_id, folder_color, type,
  created_at, updated_at, trashed_at, created_by_key, created_by_machine,
  COALESCE(frozen, false)    AS frozen,
  COALESCE(locked, false)    AS locked,
  COALESCE(is_public, false) AS is_public`;

/**
 * Every live note, newest first. Server order is created_at DESC - the web All
 * view - and the client never re-sorts it.
 */
export function listNotes() {
  return query<Note>(
    `SELECT ${LIST_COLUMNS} FROM stickies
      WHERE user_id = $1 AND NOT is_folder AND trashed_at IS NULL
      ORDER BY created_at DESC`,
    [OWNER()],
  );
}

/** TRASH, its own list: the main query filters trashed notes out by design. */
export function listTrash() {
  return query<Note>(
    `SELECT ${LIST_COLUMNS} FROM stickies
      WHERE user_id = $1 AND NOT is_folder AND trashed_at IS NOT NULL
      ORDER BY trashed_at DESC
      LIMIT 500`,
    [OWNER()],
  );
}

/**
 * The fallback search, used only while the in-memory index is still building.
 * A sequential scan over every body - slow, but a first search that answers in
 * 1.5s beats one that waits 4s for the index to finish.
 */
export function searchNotesInDb(q: string) {
  return query<Note>(
    `SELECT ${LIST_COLUMNS} FROM stickies
      WHERE user_id = $1 AND NOT is_folder AND trashed_at IS NULL
        AND (title ILIKE $2 OR folder_name ILIKE $2 OR content ILIKE $2)
      ORDER BY created_at DESC
      LIMIT 50`,
    [OWNER(), `%${q}%`],
  );
}

/** The given notes, in the order asked for. */
export async function notesByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await query<Note>(
    `SELECT ${LIST_COLUMNS} FROM stickies WHERE user_id = $1 AND id = ANY($2)`,
    [OWNER(), ids],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((n): n is Note => !!n);
}

/** One note WITH its body. */
export async function getNote(id: string) {
  const rows = await query<FullNote>(
    `SELECT ${LIST_COLUMNS}, COALESCE(content, '') AS content FROM stickies
      WHERE id = $1 AND user_id = $2 AND NOT is_folder`,
    [id, OWNER()],
  );
  return rows[0] ?? null;
}

export type WriteResult = "ok" | "frozen" | "missing";

/** The row as it stands, or why it may not be written to. */
async function writable(id: string): Promise<WriteResult> {
  const [note] = await query<{ frozen: boolean }>(
    `SELECT COALESCE(frozen, false) AS frozen FROM stickies
      WHERE id = $1 AND user_id = $2 AND NOT is_folder AND trashed_at IS NULL`,
    [id, OWNER()],
  );
  if (!note) return "missing";
  // The full app refuses every edit to a frozen note with a 423, not just the
  // trash move. Sharing and locking are edits.
  return note.frozen ? "frozen" : "ok";
}

/**
 * Share the note with anyone holding the link, or stop.
 *
 * The link itself is served by the full app - this only flips the flag both
 * apps read, so a note shared here is shareable there and nothing has to be
 * exposed from this one.
 */
export async function setPublic(id: string, isPublic: boolean): Promise<WriteResult> {
  const can = await writable(id);
  if (can !== "ok") return can;
  await query(`UPDATE stickies SET is_public = $3, updated_at = now() WHERE id = $1 AND user_id = $2`,
    [id, OWNER(), isPublic]);
  return "ok";
}

/**
 * Put a passcode on the note, or take it off. A null passcode clears both the
 * flag and the hash, so a cleared note leaves nothing behind to verify against.
 */
export async function setLock(id: string, passcode: string | null): Promise<WriteResult> {
  const can = await writable(id);
  if (can !== "ok") return can;
  const hash = passcode ? await hashLockPassword(passcode) : null;
  await query(
    `UPDATE stickies SET locked = $3, lock_password_hash = $4, updated_at = now()
      WHERE id = $1 AND user_id = $2`,
    [id, OWNER(), passcode !== null, hash],
  );
  return "ok";
}

export type TrashResult = "trashed" | "frozen" | "missing";

/**
 * Move to TRASH. Not a destructive delete - the web app purges trash on its own
 * 7 day schedule, and `restoreNote` puts it back until then. A frozen note is
 * refused here, the way the server refuses it with a 423.
 */
export async function trashNote(id: string): Promise<TrashResult> {
  const [note] = await query<{ frozen: boolean }>(
    `SELECT COALESCE(frozen, false) AS frozen FROM stickies
      WHERE id = $1 AND user_id = $2 AND NOT is_folder AND trashed_at IS NULL`,
    [id, OWNER()],
  );
  if (!note) return "missing";
  if (note.frozen) return "frozen";
  await query(
    `UPDATE stickies SET folder_name = 'TRASH', trashed_at = now() WHERE id = $1 AND user_id = $2`,
    [id, OWNER()],
  );
  return "trashed";
}

/**
 * Put a note back where it came from. The trash move overwrote folder_name, but
 * folder_id survived it, so the caller passes the folder it remembers.
 * `trashed_at` must go back to NULL, not an empty string - the column is a
 * timestamp and Postgres rejects the update otherwise.
 */
export async function restoreNote(id: string, folder: string) {
  const rows = await query<{ id: string }>(
    `UPDATE stickies SET folder_name = $3, trashed_at = NULL
      WHERE id = $1 AND user_id = $2 AND NOT is_folder
      RETURNING id`,
    [id, OWNER(), folder || "CLAUDE"],
  );
  return rows.length > 0;
}

/**
 * Delete everything in TRASH, permanently. There is no undo.
 *
 * Off unless STICKIES_CORE_ALLOW_PURGE=1: this app points at the real notes
 * database, and a permanent delete is the one thing that cannot be walked back.
 */
export async function emptyTrash(): Promise<number | "disabled"> {
  if (process.env.STICKIES_CORE_ALLOW_PURGE !== "1") return "disabled";
  const rows = await query<{ id: string }>(
    `DELETE FROM stickies
      WHERE user_id = $1 AND NOT is_folder AND trashed_at IS NOT NULL
      RETURNING id`,
    [OWNER()],
  );
  return rows.length;
}

/**
 * Write a plain-text note into CLAUDE, the folder the web app files an
 * unplaceable note into. `type: 'text'` is set explicitly so a body that happens
 * to open with a tag is not filed as html.
 */
export async function createNote(title: string, content: string) {
  const [folder] = await query<{ id: string; folder_color: string | null }>(
    `SELECT id, folder_color FROM stickies
      WHERE user_id = $1 AND is_folder AND title = 'CLAUDE' LIMIT 1`,
    [OWNER()],
  );
  const rows = await query<FullNote>(
    `INSERT INTO stickies (title, content, type, icon, folder_name, folder_id, folder_color, is_folder, user_id, created_by_key)
          VALUES ($1, $2, 'text', $3, 'CLAUDE', $4, $5, false, $6, 'stickies')
       RETURNING ${LIST_COLUMNS}, content`,
    [
      title || firstLine(content),
      content,
      iconFor(title || firstLine(content)),
      folder?.id ?? null,
      folder?.folder_color ?? "#FF9500",
      OWNER(),
    ],
  );
  return rows[0];
}

/** The server derives a missing title from the first line; so does this. */
function firstLine(content: string) {
  return content.trim().split("\n")[0]?.slice(0, 80) || "Untitled";
}

/**
 * The web app's deterministic icon matcher, trimmed to its most-used rows. A new
 * note that arrives iconless reads as broken next to 1,400 notes that have one.
 */
const KEYWORDS: [string[], string][] = [
  [["deploy", "ship", "release", "launch", "vercel"], "RocketLaunchIcon"],
  [["email", "mail", "inbox", "gmail", "reply"], "EnvelopeIcon"],
  [["pr", "review", "approve", "audit", "verify"], "CheckCircleIcon"],
  [["recap", "handoff", "retro", "summary"], "ArrowPathIcon"],
  [["ai", "llm", "gpt", "claude", "robot"], "RobotIcon"],
  [["security", "vuln", "auth", "owasp", "key"], "KeyIcon"],
  [["todo", "checklist", "task", "test", "qa"], "ClipboardDocumentListIcon"],
  [["database", "db", "postgres", "sql", "migration"], "TableCellsIcon"],
  [["api", "rest", "graphql", "endpoint", "route"], "GlobeAltIcon"],
  [["terminal", "bash", "shell", "cli", "script"], "CodeBracketIcon"],
  [["config", "env", "settings", "setup", "install"], "WrenchIcon"],
  [["git", "github", "branch", "commit", "repo"], "FolderIcon"],
  [["bug", "fix", "error", "debug", "crash"], "BugAntIcon"],
  [["design", "ui", "ux", "css", "theme"], "SwatchIcon"],
  [["meeting", "standup", "sync", "agenda"], "ChatBubbleLeftRightIcon"],
  [["idea", "brainstorm", "plan", "strategy"], "LightBulbIcon"],
  [["chart", "metrics", "dashboard", "report", "status"], "ChartBarIcon"],
  [["book", "docs", "readme", "runbook", "guide"], "BookOpenIcon"],
];

function iconFor(title: string) {
  const text = title.toLowerCase();
  for (const [words, icon] of KEYWORDS) {
    if (words.some((w) => text.includes(w))) return `__hero:${icon}`;
  }
  return "__hero:DocumentTextIcon";
}
