"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FIELD, phraseBonus, score, terms } from "@/lib/query";
import type { Note, Ranked } from "@/lib/notes";

export type Toast = { kind: "success" | "failure"; text: string; undo?: boolean; key: number };

/** A note that was just moved to TRASH, kept so the move can be undone. */
type Trashed = { note: Note; index: number; folder: string | null };

/**
 * The whole app's state, in one place - the web counterpart of Noto's AppState.
 * Components read from it and call into it; none of them own list state.
 */
export function useBoard(initial: Note[]) {
  const [notes, setNotes] = useState(initial);
  const [trashNotes, setTrashNotes] = useState<Note[]>([]);
  const [viewingTrash, setViewingTrash] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(initial[0]?.id ?? null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTrashed = useRef<Trashed | null>(null);
  /** Bounded like Noto's NSCache: oldest out first once the bodies pass 50 MB. */
  const bodies = useRef(new Map<string, string>());
  const bodyBytes = useRef(0);
  const inflight = useRef(new Map<string, Promise<string>>());

  const source = viewingTrash ? trashNotes : notes;

  /**
   * The same matching the palette does, over the fields the client already holds:
   * every word must land, a word may match the start of a longer one, and the
   * closest match sorts first. "repo audit bun" finds bunlongheng's repo audits.
   */
  const visible = useMemo(() => {
    const want = terms(query);
    if (!want.length) return source;
    const ranked: { note: Note; rank: number }[] = [];
    for (const note of source) {
      const hit = score(
        [
          { tokens: terms(note.title), field: FIELD.title },
          { tokens: terms(note.folder_name ?? ""), field: FIELD.folder },
          { tokens: terms(`${note.created_by_key ?? ""} ${note.icon ?? ""}`), field: FIELD.key },
        ],
        want,
      );
      if (hit !== null) {
        ranked.push({ note, rank: hit + phraseBonus(query, note.title, note.folder_name ?? "") });
      }
    }
    // Ties keep the server's order, which is created_at DESC.
    return ranked.sort((a, b) => b.rank - a.rank).map((r) => r.note);
  }, [source, query]);

  /** The strip mirrors the visible list, minus the tabs that were closed. */
  const tabs = useMemo(
    () => (dismissed.size ? visible.filter((n) => !dismissed.has(n.id)) : visible),
    [visible, dismissed],
  );

  const selectedNote = useMemo(
    () => source.find((n) => n.id === selected) ?? null,
    [source, selected],
  );

  // Selection could otherwise point at a note the filter hides, leaving the detail
  // pane and the trash shortcut acting on something not on screen. Landing on the
  // top row also saves the first click on every launch.
  useEffect(() => {
    if (selected && !visible.some((n) => n.id === selected)) setSelected(null);
    else if (!selected && visible.length) setSelected(visible[0].id);
  }, [visible, selected]);

  const show = useCallback((kind: Toast["kind"], text: string, undo = false) => {
    const t: Toast = { kind, text, undo, key: Date.now() };
    setToast(t);
    setTimeout(() => setToast((cur) => (cur?.key === t.key ? null : cur)), 5000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNotes((await res.json()).notes);
    } catch (e) {
      // Keep whatever is already on screen; a failed refresh must not blank the list.
      setError(e instanceof Error ? e.message : "Refresh failed");
    }
    setLoading(false);
  }, []);

  const loadTrash = useCallback(async () => {
    try {
      const res = await fetch("/api/trash");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTrashNotes((await res.json()).notes);
    } catch (e) {
      show("failure", `Could not read TRASH: ${e instanceof Error ? e.message : "failed"}`);
    }
  }, [show]);

  const toggleTrash = useCallback(() => {
    setSelected(null);
    setViewingTrash((was) => {
      if (!was) void loadTrash();
      return !was;
    });
  }, [loadTrash]);

  /** The body of a note, cached by id and revision so re-selecting is instant. */
  const body = useCallback(async (note: Note) => {
    const key = `${note.id}|${note.updated_at}`;
    const hit = bodies.current.get(key);
    if (hit !== undefined) return hit;
    // Share the request rather than firing a second one: selecting a note mounts
    // an effect that runs twice under React's strict double-invoke.
    const pending = inflight.current.get(key);
    if (pending) return pending;
    const request = (async () => {
      const res = await fetch(`/api/notes/${note.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = ((await res.json()).note.content ?? "") as string;
      bodies.current.set(key, content);
      bodyBytes.current += content.length;
      while (bodyBytes.current > 50_000_000 && bodies.current.size > 1) {
        const oldest = bodies.current.keys().next().value as string;
        bodyBytes.current -= bodies.current.get(oldest)?.length ?? 0;
        bodies.current.delete(oldest);
      }
      return content;
    })().finally(() => inflight.current.delete(key));
    inflight.current.set(key, request);
    return request;
  }, []);

  /** Walk the visible list by one. Clamps rather than wraps. */
  const stepSelection = useCallback(
    (direction: number) => {
      if (!visible.length) return;
      const at = visible.findIndex((n) => n.id === selected);
      if (at === -1) return setSelected((direction > 0 ? visible[0] : visible.at(-1))!.id);
      setSelected(visible[Math.min(Math.max(at + direction, 0), visible.length - 1)].id);
    },
    [visible, selected],
  );

  /** Clamped, never wrapped: stepping off the newest tab used to land months back. */
  const stepTab = useCallback(
    (direction: number) => {
      if (!tabs.length) return;
      const at = tabs.findIndex((n) => n.id === selected);
      if (at === -1) return setSelected(tabs[0].id);
      setSelected(tabs[Math.min(Math.max(at + direction, 0), tabs.length - 1)].id);
    },
    [tabs, selected],
  );

  /** Close a tab. The note is untouched; the neighbour slides into the slot. */
  const closeTab = useCallback(
    (id: string) => {
      const at = tabs.findIndex((n) => n.id === id);
      const next = tabs.filter((n) => n.id !== id);
      setDismissed((set) => new Set(set).add(id));
      if (selected !== id) return;
      setSelected(next.length ? next[Math.min(at, next.length - 1)].id : null);
    },
    [tabs, selected],
  );

  const trashSelected = useCallback(async () => {
    if (viewingTrash) return;
    const note = selectedNote;
    if (!note) return;
    if (note.frozen) {
      show("failure", `${note.title} is locked. Unlock it in the web app first.`);
      return;
    }
    const index = notes.findIndex((n) => n.id === note.id);
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trash" }),
    });
    if (!res.ok) {
      show("failure", (await res.json().catch(() => null))?.error ?? "Could not trash it");
      return;
    }
    lastTrashed.current = { note, index, folder: note.folder_name };
    const rest = notes.filter((n) => n.id !== note.id);
    setNotes(rest);
    // Land on a neighbour rather than dumping the user out of the list.
    setSelected(rest[index]?.id ?? rest[index - 1]?.id ?? null);
    show("success", `Moved to TRASH: ${note.title}`, true);
  }, [viewingTrash, selectedNote, notes, show]);

  const undoTrash = useCallback(async () => {
    const last = lastTrashed.current;
    if (!last) return;
    const res = await fetch(`/api/notes/${last.note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", folder: last.folder }),
    });
    if (!res.ok) return show("failure", "Could not restore it");
    setNotes((cur) => {
      const next = [...cur];
      next.splice(Math.min(last.index, next.length), 0, last.note);
      return next;
    });
    setSelected(last.note.id);
    lastTrashed.current = null;
    show("success", `Restored: ${last.note.title}`);
  }, [show]);

  /**
   * Put the selected trashed note back. The trash move overwrote folder_name, but
   * folder_id survived it, so the old folder is recovered by matching that id
   * against a note still in the list. CLAUDE is the fallback.
   */
  const restoreSelected = useCallback(async () => {
    const note = selectedNote;
    if (!viewingTrash || !note) return;
    const folder = notes.find((n) => n.folder_id && n.folder_id === note.folder_id)?.folder_name ?? "CLAUDE";
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", folder }),
    });
    if (!res.ok) return show("failure", "Could not restore it");
    setTrashNotes((cur) => cur.filter((n) => n.id !== note.id));
    setSelected(null);
    show("success", `Restored to ${folder}: ${note.title}`);
    void load();
  }, [viewingTrash, selectedNote, notes, show, load]);

  const emptyTrash = useCallback(async () => {
    const count = trashNotes.length;
    const res = await fetch("/api/trash", { method: "DELETE" });
    if (!res.ok) {
      show("failure", (await res.json().catch(() => null))?.error ?? "Could not empty TRASH");
      return;
    }
    setTrashNotes([]);
    setSelected(null);
    show("success", `TRASH emptied: ${count} note${count === 1 ? "" : "s"} gone for good`);
  }, [trashNotes.length, show]);

  const createNote = useCallback(
    async (title: string, content: string) => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        show("failure", (await res.json().catch(() => null))?.error ?? "Could not create it");
        return;
      }
      const note: Note = (await res.json()).note;
      setNotes((cur) => [note, ...cur]);
      setDismissed((set) => {
        const next = new Set(set);
        next.delete(note.id);
        return next;
      });
      setSelected(note.id);
      show("success", `Created: ${note.title}`);
    },
    [show],
  );

  /** Body matches from the server, which the in-memory filter cannot produce. */
  const searchBodies = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/notes?q=${encodeURIComponent(q)}`);
      return res.ok ? ((await res.json()).notes as Ranked[]) : [];
    } catch {
      return [];
    }
  }, []);

  /**
   * Memoised: a fresh object on every render makes `board` an unstable dependency,
   * and any effect that lists it re-runs constantly. That is what kept restarting
   * the palette's debounce, so its search could never finish.
   */
  return useMemo(
    () => ({
      notes, trashNotes, viewingTrash, query, setQuery, selected, setSelected, visible, tabs,
      selectedNote, toast, setToast, paletteOpen, setPaletteOpen, composerOpen, setComposerOpen,
      isLoading, error, canUndo: lastTrashed.current !== null,
      load, loadTrash, toggleTrash, body, stepSelection, stepTab, closeTab, trashSelected,
      undoTrash, restoreSelected, emptyTrash, createNote, searchBodies, show,
    }),
    [
      notes, trashNotes, viewingTrash, query, selected, visible, tabs, selectedNote, toast,
      paletteOpen, composerOpen, isLoading, error, load, loadTrash, toggleTrash, body,
      stepSelection, stepTab, closeTab, trashSelected, undoTrash, restoreSelected, emptyTrash,
      createNote, searchBodies, show,
    ],
  );
}

export type Board = ReturnType<typeof useBoard>;
