import { query } from "@/lib/db";

/** A row of the `stickies` table. Folders live in the same table; `is_folder` splits them. */
export type Note = {
  id: string;
  title: string;
  icon: string | null;
  folder_color: string | null;
  created_at: string;
  frozen: boolean;
  locked: boolean;
  is_public: boolean;
};

export type FullNote = Note & { content: string; type: string | null; folder_name: string };

const OWNER = () => process.env.OWNER_USER_ID ?? "";

/** Every live note, newest first. This is the whole sidebar - there are no folders. */
export function listNotes() {
  return query<Note>(
    `SELECT id, title, icon, folder_color, created_at,
            COALESCE(frozen, false) AS frozen,
            COALESCE(locked, false) AS locked,
            COALESCE(is_public, false) AS is_public
       FROM stickies
      WHERE user_id = $1 AND NOT is_folder AND trashed_at IS NULL
      ORDER BY updated_at DESC`,
    [OWNER()],
  );
}

/** One note, with its body. */
export async function getNote(id: string) {
  const rows = await query<FullNote>(
    `SELECT id, title, icon, folder_color, created_at, content, type, folder_name,
            COALESCE(frozen, false) AS frozen,
            COALESCE(locked, false) AS locked,
            COALESCE(is_public, false) AS is_public
       FROM stickies
      WHERE id = $1 AND user_id = $2 AND NOT is_folder AND trashed_at IS NULL`,
    [id, OWNER()],
  );
  return rows[0] ?? null;
}

export type TrashResult = "trashed" | "frozen" | "missing";

/**
 * Move a note to TRASH. Soft delete, the way the web app does it - the row stays
 * and the server purges it on its own schedule. A frozen note is refused here,
 * not just hidden in the UI.
 */
export async function trashNote(id: string): Promise<TrashResult> {
  const [note] = await query<{ frozen: boolean }>(
    `SELECT COALESCE(frozen, false) AS frozen FROM stickies
      WHERE id = $1 AND user_id = $2 AND NOT is_folder AND trashed_at IS NULL`,
    [id, OWNER()],
  );
  if (!note) return "missing";
  if (note.frozen) return "frozen";

  await query(`UPDATE stickies SET trashed_at = now() WHERE id = $1 AND user_id = $2`, [id, OWNER()]);
  return "trashed";
}
