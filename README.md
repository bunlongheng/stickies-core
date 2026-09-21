# stickies-core

[Noto](https://github.com/bunlongheng/noto), on the web. One flat list of **all** notes, read one, delete one, and the rest of what Noto does - tabs, find in note, zoom, a search palette over every body, TRASH with restore and undo, a composer, and the dissolve a trashed note leaves behind.

It reads and writes the **same Postgres `stickies` table** as the full app, so it is a real client, not a mock.

| | stickies | stickies-core |
|---|---|---|
| Source lines (`app` + `components` + `lib`) | 17,179 | 2,435 |
| Runtime dependencies | 30 | 6 |
| Largest file | 7,690 lines | 284 lines |
| `useState` in one file | 139 | 13 |

## Run

```bash
cp .env.example .env.local   # DATABASE_URL + OWNER_USER_ID
npm install
npm run dev                  # http://localhost:4445
npm test                     # 59 acceptance checks against the running app
```

## Ported from Noto

Every number below came out of Noto's Swift source, not out of a guess.

| Noto | here |
|---|---|
| `NavigationSplitView`, sidebar 44-480, ideal 320 | draggable divider, same bounds |
| `ListDensity` full / narrow / icons at 260 and 110 | same thresholds, read from the live width |
| Cycle-width button: full, narrow, icons, back | same, plus double-click on the divider |
| Row: icon tinted by folder colour, title 12pt, badges, submitter, date 10pt in a 50pt lane | same |
| Status glyphs: lock amber, key teal, globe green, frozen > private > public | same |
| Selection: 6pt pill, folder colour at 28% | same, via `color-mix` |
| `displayDate`: time today, "Sep 17" this year, short date before | same |
| `submitterIconURLs`: work laptop, then app key, then its prefix, then a fallback | same, falling through on a 404 |
| Trash rows count down "Nd left", red at 1 day | same |
| Tab strip: inactive icon-only, active grows with title + close, `< ALL (n) >` | same |
| Tab ink chosen from the tab's own luminance | same formula |
| Arrows step tabs, Cmd+Shift+`[`/`]`/`W` | same |
| Cmd+F find: `<mark>` every hit, counter, step, scroll into view | the same script, ported |
| Cmd +/-/0 zoom with a HUD badge | same |
| Cmd+Shift+F palette: titles local, bodies from the server, "in text" chip, 250ms debounce, 2-char floor | same |
| Cmd+N composer: title + body, plain text, filed under CLAUDE | same |
| Trash asks; Cmd+Delete does not; a frozen note is refused | same, 423 from the API |
| Undo in the toast, restore from TRASH, empty TRASH | same |
| `Dust.dissolve`: erase left to right on `cubic-bezier(0.45,0,0.75,0.1)` over 1.2s, dust off the front, next note blurs in | same curve, same timings, a CSS mask over a snapshot |
| `Whoosh`: xorshift noise through two climbing one-pole lowpasses | same synth, in WebAudio |
| `LaunchTile`: folder-coloured tile, initial, 1s breath 0.9/-3deg to 1.05/+2deg | same |
| Note body: white, `#1c1c1e`, 14px/1.55 system, 18px padding | the same CSS, verbatim |
| Plain text in `<pre class="plain">` 13px/1.5 mono | same |

The note pane stays white in dark mode, exactly as Noto's `WKWebView` does: a note's own HTML is written for a white page.

## Structure

```
app/
  page.tsx                 server-renders the first list, hands it to the client
  api/notes/               GET list | GET ?q= body search | POST create
  api/notes/[id]/          GET body | PATCH trash | PATCH restore
  api/trash/               GET trash | DELETE purge
components/
  Board.tsx                the shell: shortcuts, dissolve, overlays
  Sidebar.tsx              header, filter, density, resize, windowed list
  NoteRow.tsx  TabBar.tsx  Detail.tsx  FindBar.tsx
  SearchPalette.tsx  Composer.tsx  Toast.tsx  SubmitterBadge.tsx
lib/
  use-board.ts             all list state in one hook (Noto's AppState)
  notes.ts                 every query the app makes
  db.ts  format.ts  icons.tsx  find.ts  dust.ts  whoosh.ts  export.ts
```

Two lists are windowed, because both mirror all 1,400 notes and neither the sidebar nor the tab strip gets AppKit's virtualisation for free. With every row in the DOM, one write froze the window for 22 seconds.

## Deliberately different

- **Empty TRASH is off** unless `STICKIES_CORE_ALLOW_PURGE=1`. This points at the real notes database, and a permanent delete is the one thing that cannot be walked back.
- **No auth.** Noto carries an API key; this talks to Postgres directly and is meant for localhost.
- Save-as-image writes PNG only. Noto also writes WebP when `cwebp` is installed.

## Not here

Folders, rich text, checklists, the code editor, image upload, Google Drive, AI, automations, integrations, Philips Hue, realtime, public share links, QR codes, note locking, tags, pinning, drag reorder - and editing an existing note, which Noto cannot do either.
