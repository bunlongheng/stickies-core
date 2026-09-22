# Security

## Reporting

Email **bheng.code@gmail.com**. Do not open a public issue for a vulnerability.

## What this app can reach

It connects straight to Postgres with the credentials in `.env.local` and acts
as the single account named by `OWNER_USER_ID`. There is no sign-in, no session
and no per-request authorisation - anyone who can open the page has that
account's notes. **Run it on localhost.** Putting it on a public address
publishes the database behind it.

## Deliberate limits

- **A note is rendered, never executed.** Bodies are sanitised on the way out of
  the API: `<script>` and `<iframe>` are removed, inline `on*` handlers are
  stripped, and `javascript:` URLs are defused. Links are forced to open in a
  new tab so a note cannot navigate the app away.
- **Deletes are soft.** Trashing sets `trashed_at`; nothing is destroyed.
- **Permanent delete is off** unless `STICKIES_CORE_ALLOW_PURGE=1`. It is the
  one action here that cannot be walked back.
- **Frozen notes are refused by the server** with a 423, not merely hidden in
  the UI.
- **Database TLS is verified** when `DATABASE_CA_CERT` is set. Without it the
  connection is still encrypted, but the server is not authenticated.
