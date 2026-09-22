# stickies-core

[Noto](https://github.com/bunlongheng/noto), on the web. One flat list of **all** notes, read one, delete one, and the rest of what Noto does - tabs, find in note, zoom, a search palette over every body, TRASH with restore and undo, a composer, and the dissolve a trashed note leaves behind.

It reads and writes the **same Postgres `stickies` table** as the full app, so it is a real client, not a mock.

| | stickies | stickies-core |
|---|---|---|
| Source lines (`app` + `components` + `lib`) | 17,179 | 3,220 |
| Runtime dependencies | 30 | 7 |
| Largest file | 7,690 lines | 355 lines |
| `useState` in one file | 139 | 13 |

## Run

```bash
cp .env.example .env.local   # DATABASE_URL + OWNER_USER_ID
npm install
npm run dev                  # http://localhost:4445
npm test                     # 84 acceptance checks against the running app
```

## Search

Every word has to land somewhere, and a word may match the start of a longer one.
That is what makes **`repo audit bun`** return Bunlong's repo audits and nothing
else: `repo` and `audit` match the `repo-audit` folder, `bun` matches the start of
`bunlongheng`. Titles outrank folders, folders outrank the posting app, and all
three outrank the body; a run of the query's own words in a title outranks the
same words scattered. A term nobody knows is cut into two that are known, so
`repoaudit` finds notes filed under `repo-audit`.

`content ILIKE '%x%'` is a sequential scan over 141 MB of note bodies and measured
**1.5-2.1s** a query. Postgres would do better with a trigram index on `content`,
but that is a schema change to the database the real app shares, so the index lives
in this process instead: one 4.7s build at boot, then

| query | result |
|---|---|
| `repo audit bun` | 50 hits, **51ms** |
| `repoaudit bun` | 50 hits, **50ms** |
| `session recap stickies` | 31 hits, **109ms** |
| `hue bridge flash` | 4 hits, **44ms** |

The bodies are stripped of markup in Postgres, which is what makes the build
affordable: 141 MB of HTML comes back as 10 MB of words, 28,051 terms.

The real notes app writes to this same table all day, so the index would be stale
the moment it was built. Every search first pulls whatever changed since it last
looked - one indexed range scan, throttled to once a second, because paying a round
trip per keystroke turned a 50ms search into 700ms. A note written straight into
Postgres is searchable by its body about a second later, and one trashed there
disappears just as fast.

## Ported from Noto

Every number below came out of Noto's Swift source, not out of a guess.

| Noto | here |
|---|---|
| One toolbar across the whole window, tab strip under it inside the note pane | same order, same span |
| Toolbar at rest: compose, export, trash - zoom lives on Cmd +/-/0 | same; the zoom controls appear only once used |
| Refresh reloads whichever list is open, TRASH included | same, and it says what it found - a 200ms refresh that reports nothing reads as a dead button |
| `NavigationSplitView`, sidebar 44-480, ideal 320 | draggable divider, same bounds |
| Tabs: inactive 26x26, active 32 tall up to 190 wide, 2pt gaps, no scroller | same, measured in the suite |
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
| Dust tinted with colours sampled off the note | same, sampled from the rendered DOM |
| `SubmitterChip`: the icon alone at 36pt, name in the tooltip | same |
| `NoteFooter`: who, when, how long ago, folder - only with the sidebar closed | same, and the sidebar can close |
| Page zoom clamped 0.5-3, remembered between sessions | same, in `localStorage` |
| `PasteGuard`: an exact repeat paste is refused, not corrected | same, on both fields |
| Export: whole document, 2x, white filled, ~60 MP ceiling, PNG and WebP | same, WebP where the browser can encode |
| Scripts stripped before the note is rendered | same, plus inline handlers and `javascript:` |
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
- Save-as-image writes WebP only where the browser can encode it, which is where Noto needs `cwebp`.
- Links inside a note open in a new tab. In Noto they hand off to the default browser; here the page itself is the browser, and a note that navigated it would take the app with it.

## Not here

Folders, rich text, checklists, the code editor, image upload, Google Drive, AI, automations, integrations, Philips Hue, realtime, public share links, QR codes, note locking, tags, pinning, drag reorder - and editing an existing note, which Noto cannot do either.
