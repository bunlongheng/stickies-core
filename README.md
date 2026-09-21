# stickies-core

The core of [Stickies](https://github.com/bunlongheng/stickies) and nothing else: browse folders, open a note, delete it. The same 3 things Noto does.

It reads the **same Postgres `stickies` table** as the full app, so it is a real client, not a mock.

| | stickies | stickies-core |
|---|---|---|
| Source lines (`app` + `components` + `lib`) | 17,179 | 476 |
| Runtime dependencies | 30 | 4 |
| Files | 120+ | 13 |
| Largest file | 7,690 lines | 81 lines |
| Client components | most of the app | 1 |

## Run

```bash
cp .env.example .env.local   # DATABASE_URL + OWNER_USER_ID
npm install
npm run dev                  # http://localhost:4445
```

## Structure

```
app/
  page.tsx              folder index
  f/[id]/page.tsx       notes in a folder
  n/[id]/page.tsx       one note
  api/notes/[id]/route.ts   DELETE (soft delete)
components/
  Row.tsx               one line of the index
  Masthead.tsx          page header
  DeleteButton.tsx      the only client component
lib/
  db.ts                 pool + query
  notes.ts              the 5 queries the app makes
  when.ts               relative time
```

Every page is a server component. The only `"use client"` is the delete button, because it is the only thing that needs state.

## Deliberately absent

Rich text, checklists, code editor, images, Google Drive, AI, automations, integrations, Philips Hue, realtime, public share links, QR codes, locking, tags, pinning, drag reorder, search, command palette, sounds, themes, auth. Writing of any kind: this is read and delete only.
