# stickies-core

The core of [Stickies](https://github.com/bunlongheng/stickies), styled like [Noto](https://github.com/bunlongheng/noto): one flat list of **all** notes, read one, delete one. No folders, no writing, nothing else.

It reads the **same Postgres `stickies` table** as the full app, so it is a real client, not a mock.

| | stickies | stickies-core |
|---|---|---|
| Source lines (`app` + `components` + `lib`) | 17,179 | 571 |
| Runtime dependencies | 30 | 5 |
| Source files | 120+ | 13 |
| Largest file | 7,690 lines | 139 lines |
| Client components | most of the app | 2 |

## Run

```bash
cp .env.example .env.local   # DATABASE_URL + OWNER_USER_ID
npm install
npm run dev                  # http://localhost:4445
```

## The Noto look

The chrome is macOS because Noto is a macOS app, and the numbers come straight out of its Swift source:

| | Noto | here |
|---|---|---|
| Split view | `NavigationSplitView`, sidebar ideal 320 | 320px sidebar, detail fills |
| Header | "All Notes" 12pt semibold + count capsule | same, `.secondary` at 0.15 |
| Filter field | 11pt glass, `.secondary` at 0.12, radius 6 | same |
| Row | icon 13pt tinted by folder colour, title 12pt, date 10pt monospaced in a 50pt lane | same |
| Selection | radius 6 pill, folder colour at 28% | same, via `color-mix` |
| Status glyphs | lock amber, key teal, globe green, frozen > private > public | same |
| Date | time today, "Sep 17" this year, short date before | same |
| Note body | `WKWebView`, white, `#1c1c1e`, 14px/1.55 system, 18px padding | same CSS, verbatim |
| Plain text | `<pre class="plain">` 13px/1.5 mono | same |
| Arrow keys | walk the list from the search field | same |
| Trash | asks first, refuses a frozen note | same, 409 from the API |

The note pane stays white in dark mode, exactly as Noto's web view does: a note's own HTML is written for a white page.

## Structure

```
app/
  layout.tsx                  html shell
  (board)/layout.tsx          split view - fetches the list ONCE
  (board)/page.tsx            "Select a note"
  (board)/n/[id]/page.tsx     the note + toolbar
  api/notes/[id]/route.ts     DELETE (soft delete to TRASH)
components/
  NoteList.tsx                sidebar: filter, rows, arrow keys
  NoteIcon.tsx                Heroicon per icon token (server only)
  TrashButton.tsx             toolbar trash
lib/
  db.ts                       pool + query
  notes.ts                    the 3 queries the app makes
  format.ts                   Noto's date rules
```

The list lives in a **layout**, not a page, so walking from note to note never refetches 1,400 rows. Icons are rendered on the server once per distinct token (69, not 1,400), so none of Heroicons' 324 components reach the browser.

## Deliberately absent

Folders, rich text, checklists, code editor, images, Google Drive, AI, automations, integrations, Philips Hue, realtime, public share links, QR codes, locking, tags, pinning, drag reorder, command palette, sounds, themes, auth. Writing of any kind.
