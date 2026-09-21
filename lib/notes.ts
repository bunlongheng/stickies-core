import { query } from "@/lib/db";

/** A row of the `stickies` table. Folders and notes share it; `is_folder` splits them. */
export type Note = {
  id: string;
  title: string;
  content: string;
  folder_color: string;
  is_folder: boolean;
  updated_at: string;
};

export type Folder = Note & { count: number };

const OWNER = () => process.env.OWNER_USER_ID ?? "";

/** Top-level folders, each with the number of live notes inside it. */
export function listFolders() {
  return query<Folder>(
    `SELECT f.id, f.title, f.folder_color, f.updated_at,
            COUNT(n.id)::int AS count
       FROM stickies f
       LEFT JOIN stickies n
         ON n.folder_id = f.id AND NOT n.is_folder AND n.trashed_at IS NULL
      WHERE f.user_id = $1 AND f.is_folder AND f.parent_folder_id IS NULL
      GROUP BY f.id
      ORDER BY f."order", f.title`,
    [OWNER()],
  );
}

/** The folder itself, so the page can show its name and colour. */
export function getFolder(id: string) {
  return one<Note>(
    `SELECT id, title, folder_color FROM stickies
      WHERE id = $1 AND user_id = $2 AND is_folder`,
    [id, OWNER()],
  );
}

/** Live notes in a folder, newest first. Trashed notes never appear. */
export function listNotes(folderId: string) {
  return query<Note>(
    `SELECT id, title, folder_color, updated_at FROM stickies
      WHERE folder_id = $1 AND user_id = $2 AND NOT is_folder AND trashed_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 200`,
    [folderId, OWNER()],
  );
}

/** One note, with its body and a back-link to its folder. */
export function getNote(id: string) {
  return one<Note & { folder_id: string; folder_title: string }>(
    `SELECT n.id, n.title, n.content, n.folder_color, n.updated_at,
            n.folder_id, f.title AS folder_title
       FROM stickies n
       LEFT JOIN stickies f ON f.id = n.folder_id
      WHERE n.id = $1 AND n.user_id = $2 AND NOT n.is_folder AND n.trashed_at IS NULL`,
    [id, OWNER()],
  );
}

/**
 * Soft delete. Stickies never hard-deletes a note from the UI - it stamps
 * `trashed_at` and the row drops out of every list above.
 */
export async function trashNote(id: string) {
  const rows = await query<{ id: string }>(
    `UPDATE stickies SET trashed_at = now()
      WHERE id = $1 AND user_id = $2 AND NOT is_folder AND trashed_at IS NULL
      RETURNING id`,
    [id, OWNER()],
  );
  return rows.length > 0;
}

async function one<T>(sql: string, params: unknown[]) {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
