# Contributing

## Setup

```bash
npm install
cp .env.example .env.local     # DATABASE_URL + OWNER_USER_ID
npm run dev                    # http://localhost:4445
```

There is no migration step: this app reads a `stickies` table that already
exists. Point it at the database the [full app](https://github.com/bunlongheng/stickies)
created, or at a copy.

## The checks

```bash
npm run typecheck              # tsc --noEmit
npm run build                  # a production build must succeed
npm test                       # 84 acceptance checks against a running dev server
```

`npm test` drives the real app against the real database. It creates its own
fixture rows, all titled `ZZQA ...`, and deletes exactly those at the end -
pass or fail. It also puts back anything that reached TRASH during the run and
was not one of its own rows, because `Cmd+Delete` skips its confirmation by
design and a mis-aimed click would otherwise trash a real note silently.

Start the dev server first; the suite talks to `http://localhost:4445` unless
`CORE_URL` says otherwise.

## What a change needs

- A check in `tests/acceptance.mjs` that fails without it. Assertions that
  cannot fail are worse than none: a check reading "refresh reloads the list"
  once asserted only that a label was non-empty, and passed for weeks while
  refresh was broken in the TRASH view.
- No new dependency unless it removes more code than it adds.
- Comments that say **why**, not what. The file is the what.

## The shape of the thing

It is a reader. It lists notes, opens one, and moves one to TRASH. It does not
edit, and neither does the native client it mirrors. A pull request that adds
editing is a different app.
