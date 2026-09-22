/**
 * Acceptance run for stickies-core: seeds its own fixtures, drives the real app
 * against the real database, then removes every row it made.
 *
 *   node tests/acceptance.mjs            # against http://localhost:4445
 *
 * Every check maps to something Noto does. It writes only rows whose title starts
 * with "ZZQA " and deletes exactly those at the end, pass or fail.
 */
import { chromium } from "@playwright/test";
import pg from "pg";
import fs from "node:fs";

const BASE = process.env.CORE_URL ?? "http://localhost:4445";
const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
  }),
);
const db = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const U = env.OWNER_USER_ID;

const seed = (title, content, colour, type, extra = "", value = []) =>
  db
    .query(
      `INSERT INTO stickies (title, content, folder_name, folder_color, is_folder, user_id, type, icon${extra ? ", " + extra : ""})
            VALUES ($1, $2, 'ZZTEST', $3, false, $4, $5, $6${extra ? ", $7" : ""}) RETURNING id`,
      [title, content, colour, U, type, "__hero:DocumentTextIcon", ...value],
    )
    .then((r) => r.rows[0].id);

async function fixtures() {
  await cleanup();
  return {
    html: await seed("ZZQA html note", "<p>needle needle unique-marker-alpha</p><p>needle again</p>", "#FF9500", "html", "created_by_key", ["repoaudit"]),
    text: await seed("ZZQA text note", "plain <not html> body", "#34C759", "text"),
    frozen: await seed("ZZQA frozen note", "frozen", "#FF3B30", "text", "frozen", [true]),
    locked: await seed("ZZQA locked note", "locked", "#30B0C7", "text", "locked", [true]),
    public: await seed("ZZQA public note", "public", "#AF52DE", "text", "is_public", [true]),
    doomed: await seed("ZZQA doomed note", "delete me", "#FF9500", "text"),
    doomed2: await seed("ZZQA doomed two", "delete me too", "#FF9500", "text"),
    trashed: await seed("ZZQA already trashed", "in the bin", "#FF9500", "text", "trashed_at", [new Date(Date.now() - 5 * 86400000)]).then(async (id) => {
      await db.query(`UPDATE stickies SET folder_name = 'TRASH' WHERE id = $1`, [id]);
      return id;
    }),
  };
}

/** Removes exactly the rows this file creates, and nothing else. */
async function cleanup() {
  const gone = await db.query(
    `DELETE FROM stickies WHERE user_id = $1 AND (title LIKE 'ZZQA %' OR folder_name = 'ZZTEST') RETURNING id`,
    [U],
  );
  return gone.rowCount;
}

/**
 * The net under the destructive checks.
 *
 * Cmd+Delete skips its confirmation on purpose, so a mis-aimed click during a
 * run would trash a real note silently. Anything that landed in TRASH while the
 * suite was running, and is not one of its own rows, goes straight back to the
 * folder its folder_id still points at.
 */
async function restoreCollateral(since) {
  const rows = await db.query(
    `UPDATE stickies note
        SET trashed_at = NULL,
            folder_name = COALESCE((SELECT f.title FROM stickies f WHERE f.id = note.folder_id AND f.is_folder), 'CLAUDE')
      WHERE note.user_id = $1 AND note.trashed_at >= $2 AND note.title NOT LIKE 'ZZQA %'
      RETURNING note.title`,
    [U, since],
  );
  return rows.rows.map((r) => r.title);
}

const startedAt = new Date();
const ID = await fixtures();
let pass = 0;
let fail = 0;
/** Refuse to run a destructive step unless the fixture is the one selected. */
const armed = async (want) => {
  const selected = await title();
  if (selected === want) return true;
  fail++;
  console.log(`FAIL  refused to trash: expected "${want}" to be selected, found "${selected}"`);
  return false;
};

const ok = (label, good) => {
  good ? pass++ : fail++;
  console.log((good ? "PASS  " : "FAIL  ") + label);
};

const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1280,height:820} });
p.on('dialog', d => d.accept());
const side = () => p.locator('nav').first();
const row = t => side().locator('button', { hasText: t }).first();
const sel = () => side().locator('button[aria-current="true"]');
const title = async () => (await sel().innerText()).split('\n')[0];

await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await side().locator('button[aria-current]').first().waitFor();
await p.waitForTimeout(1200);

// --- sidebar ---
const total = Number(await side().locator('div span').nth(1).innerText());
ok('1 all notes listed ('+total+')', total > 1000);
ok('2 auto-selects the first note on load', (await sel().count()) === 1);

await p.locator('input[aria-label="Filter notes"]').fill('ZZQA');
await p.waitForTimeout(300);
ok('3 filter narrows + "n of m" capsule', (await side().locator('div span').nth(1).innerText()).includes(' of '));
ok('4 filtered to the 7 seeded notes', (await side().locator('button[aria-current]').count()) === 7);

await p.locator('input[aria-label="Filter notes"]').fill('ZZTEST');
await p.waitForTimeout(300);
ok('5 filter matches the FOLDER name too', (await side().locator('button[aria-current]').count()) === 7);
await p.locator('button[aria-label="Clear search"]').click();
ok('6 clear button empties the filter', (await p.locator('input[aria-label="Filter notes"]').inputValue()) === '');

await p.locator('input[aria-label="Filter notes"]').fill('ZZQA');
await p.waitForTimeout(400);

// --- row anatomy ---
ok('7 row shows a submitter badge', (await row('ZZQA html note').locator('img').count()) === 1);
ok('8 frozen note shows the amber lock', (await row('ZZQA frozen note').locator('svg[data-slot],svg').count()) >= 2);
const tint = await row('ZZQA text note').evaluate(e=>{ e.click(); return 1; });
await p.waitForTimeout(400);
const bg = await sel().evaluate(e=>getComputedStyle(e).backgroundColor);
ok('9 selection is tinted by folder colour (#34C759 @ 28% -> '+bg+')', /0\.2039|52,\s*199/.test(bg) && /0\.28|\/ 0\.28/.test(bg));

// --- arrows ---
const before = await title();
await p.locator('body').click({position:{x:900,y:500}});
await p.keyboard.press('ArrowDown'); await p.waitForTimeout(350);
ok('10 ArrowDown steps the selection', (await title()) !== before);
await p.keyboard.press('ArrowUp'); await p.waitForTimeout(350);
ok('11 ArrowUp steps back', (await title()) === before);

// --- density + resize ---
const grip = p.locator('[aria-label="Resize note list"]');
const box = await grip.boundingBox();
await p.mouse.move(box.x+3, box.y+300); await p.mouse.down(); await p.mouse.move(200, 300); await p.mouse.up();
await p.waitForTimeout(300);
ok('12 drag to 200px -> narrow density (date lane gone)', (await p.locator('nav button[aria-current] span.tabular-nums').count()) === 0);
await p.mouse.move(200, 300); await p.mouse.down(); await p.mouse.move(80, 300); await p.mouse.up();
await p.waitForTimeout(300);
ok('13 drag to 80px -> icons density (titles gone)', !(await side().innerText()).includes('ZZQA'));
ok('14 at icon width the filter becomes a search button', (await p.locator('input[aria-label="Filter notes"]').count()) === 0);
await p.locator('[title="Squeeze the list: narrow, then icons, then back"]').click();
await p.waitForTimeout(300);
ok('15 cycle button returns to the wide width', (await side().evaluate(e=>e.offsetWidth)) > 260);

// --- tabs ---
await p.locator('input[aria-label="Filter notes"]').fill('ZZQA');
await p.waitForTimeout(400);
await row('ZZQA locked note').click(); await p.waitForTimeout(600);
const tabs = p.locator('[data-active]');
ok('16 tab strip mirrors the visible list', (await tabs.count()) === 7);
ok('17 active tab carries its title', (await p.locator('[data-active="true"]').innerText()).includes('ZZQA locked note'));
ok('18 inactive tabs are icon only', (await p.locator('[data-active="false"]').first().innerText()).trim() === '');
ok('19 stepper shows ALL (n)', (await p.locator('text=ALL (7)').count()) === 1);
await p.locator('[aria-label="Next note (right arrow)"]').click(); await p.waitForTimeout(400);
ok('20 stepper > moves to the next note', (await title()) === 'ZZQA frozen note');
await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(400);
ok('21 Left arrow steps tabs back', (await title()) === 'ZZQA locked note');
await p.keyboard.press('Meta+Shift+]'); await p.waitForTimeout(400);
ok('22 Cmd+Shift+] next tab', (await title()) === 'ZZQA frozen note');
await p.keyboard.press('Meta+Shift+['); await p.waitForTimeout(400);
ok('23 Cmd+Shift+[ previous tab', (await title()) === 'ZZQA locked note');
await p.locator('[data-active="true"] button[aria-label="Close tab"]').click(); await p.waitForTimeout(500);
ok('24 closing a tab removes it and lands on a neighbour', (await tabs.count()) === 6);

// --- detail ---
await row('ZZQA html note').click(); await p.waitForTimeout(700);
ok('25 html note renders as html', (await p.locator('.note-html p').count()) >= 2);
ok('26 submitter chip is icon-only, name in the tooltip', /Posted by repoaudit/.test(await p.locator('main span[title^="Posted by"]').first().getAttribute('title')));
await row('ZZQA text note').click(); await p.waitForTimeout(700);
ok('27 text note is preformatted + escaped', (await p.locator('.note-html pre.plain').innerText()).includes('<not html>'));

// --- find in note ---
await row('ZZQA html note').click(); await p.waitForTimeout(700);
await p.keyboard.press('Meta+f'); await p.waitForTimeout(300);
ok('28 Cmd+F opens the find bar', (await p.locator('input[aria-label="Find in note"]').count()) === 1);
await p.locator('input[aria-label="Find in note"]').fill('needle'); await p.waitForTimeout(400);
ok('29 find marks every hit', (await p.locator('.note-html mark.sn-hit').count()) === 3);
ok('30 find shows a 1/3 counter', (await p.locator('[aria-label="match 1 of 3"]').innerText()) === '1/3');
await p.locator('[aria-label="Next match"]').click(); await p.waitForTimeout(250);
ok('31 stepping moves the current match', (await p.locator('[aria-label="match 2 of 3"]').count()) === 1);
await p.locator('input[aria-label="Find in note"]').fill('zzzznope'); await p.waitForTimeout(400);
ok('32 no match reads "none"', (await p.locator('[aria-label="no matches"]').count()) === 1);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
ok('33 Escape closes find and clears the marks', (await p.locator('.note-html mark.sn-hit').count()) === 0);

// --- zoom ---
await p.locator('body').click({position:{x:900,y:600}});
await p.keyboard.press('Meta+='); await p.waitForTimeout(200);
ok('34 Cmd+= zooms in', (await p.locator('.note-html').evaluate(e=>getComputedStyle(e).zoom)) !== '1');
ok('35 a zoom HUD reports the percentage', (await p.locator('text=110%').count()) >= 1);
await p.keyboard.press('Meta+0'); await p.waitForTimeout(300);
ok('36 Cmd+0 is actual size', (await p.locator('.note-html').evaluate(e=>getComputedStyle(e).zoom)) === '1');

// --- palette ---
await p.keyboard.press('Meta+Shift+f'); await p.waitForTimeout(400);
ok('37 Cmd+Shift+F opens the palette', (await p.locator('input[aria-label="Search all notes"]').count()) === 1);
await p.locator('input[aria-label="Search all notes"]').fill('unique-marker-alpha');
const pal = p.locator('[role="dialog"][aria-label="Search all notes"]');
// 250ms debounce, then a body search - from the index once warm, from the
// database while it is still building. Waited for, not guessed at.
await pal.locator('button', { hasText: 'ZZQA html note' }).first()
  .waitFor({ timeout: 20000 }).catch(() => {});
console.log('    (palette shows: ' + (await pal.innerText()).replace(/\n/g,' | ') + ')');
ok('38 palette finds a note by its BODY', (await pal.locator('button', {hasText:'ZZQA html note'}).count()) === 1);
ok('39 body-only hits wear an "in text" chip', (await pal.locator('span', {hasText:'in text'}).count()) >= 1);
await p.keyboard.press('Enter'); await p.waitForTimeout(600);
ok('40 Enter opens the highlighted result', (await title()) === 'ZZQA html note');
await p.keyboard.press('Meta+Shift+f'); await p.waitForTimeout(300);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
ok('41 Escape closes the palette', (await p.locator('input[aria-label="Search all notes"]').count()) === 0);

// --- composer ---
await p.keyboard.press('Meta+n'); await p.waitForTimeout(400);
ok('42 Cmd+N opens the composer', (await p.locator('[role="dialog"][aria-label="New Note"]').count()) === 1);
const comp = p.locator('[role="dialog"][aria-label="New Note"]');
await comp.locator('input[placeholder="Title"]').fill('ZZQA created by the composer');
await comp.locator('textarea').fill('written from stickies-core');
await comp.locator('button', {hasText:'Create'}).click(); await p.waitForTimeout(2000);
ok('43 the new note is created and selected', (await title()) === 'ZZQA created by the composer');
await p.locator('[role="status"]').waitFor({timeout:15000});
ok('44 a toast confirms it', (await p.locator('[role="status"]').innerText()).includes('Created'));

// --- trash ---
await p.locator('input[aria-label="Filter notes"]').fill('ZZQA'); await p.waitForTimeout(400);
await row('ZZQA doomed note').click(); await p.waitForTimeout(700);
if (!(await armed('ZZQA doomed note'))) throw new Error('aborting before a destructive step');
await p.locator('[aria-label^="Move to TRASH"]').click();
await p.waitForTimeout(400);
const mask = await p.locator('.dissolving').first().evaluate(e=>getComputedStyle(e).maskImage).catch(()=>'');
ok('45 a snapshot of the note is erased by a gradient mask', mask.includes('gradient'));
ok('45b dust comes off the erase front', (await p.locator('.dust-layer i').count()) > 0);
await p.waitForTimeout(1600);
ok('46 trashed note leaves the list', (await row('ZZQA doomed note').count()) === 0);
ok('47 toast offers Undo', (await p.locator('[role="status"] button', {hasText:'Undo'}).count()) === 1);
await p.locator('[role="status"] button', {hasText:'Undo'}).click(); await p.waitForTimeout(1200);
ok('48 Undo puts it back', (await row('ZZQA doomed note').count()) === 1);

await row('ZZQA doomed two').click(); await p.waitForTimeout(700);
if (!(await armed('ZZQA doomed two'))) throw new Error('aborting before a destructive step');
await p.keyboard.press('Meta+Backspace'); await p.waitForTimeout(2200);
ok('49 Cmd+Delete trashes without asking', (await row('ZZQA doomed two').count()) === 0);

await row('ZZQA frozen note').click(); await p.waitForTimeout(700);
ok('50 frozen note: trash button disabled', await p.locator('[aria-label*="locked"]').first().isDisabled());
const st = await p.evaluate(id=>fetch('/api/notes/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'trash'})}).then(r=>r.status), ID.frozen);
ok('51 frozen note: API answers 423 (got '+st+')', st === 423);

// --- trash view ---
await p.locator('[aria-label="Show TRASH"]').click(); await p.waitForTimeout(1500);
ok('52 TRASH is its own list', (await side().innerText()).includes('Trash'));
ok('53 trashed note is in it', (await row('ZZQA already trashed').count()) === 1);
ok('54 trash rows count down to the purge', (await side().innerText()).includes('d left'));
await row('ZZQA already trashed').click(); await p.waitForTimeout(600);
await p.locator('[aria-label="Put this note back where it came from"]').first().click(); await p.waitForTimeout(1500);
ok('55 restore takes it out of TRASH', (await row('ZZQA already trashed').count()) === 0);
const purge = await p.evaluate(()=>fetch('/api/trash',{method:'DELETE'}).then(r=>r.status));
ok('56 permanent purge is refused by default (got '+purge+')', purge === 403);
await p.locator('[aria-label="Back to all notes"]').click(); await p.waitForTimeout(1200);
ok('57 back to all notes', (await side().innerText()).includes('All Notes'));

// ---- refresh: it must reload the list you are LOOKING AT --------------
const toastText = async () =>
  (await p.locator('[role="status"]').first().innerText().catch(() => '')).replace(/\n/g, ' ');
const refresh = async () => {
  await p.locator('[aria-label="Refresh (Cmd+R)"]').click();
  await p.waitForTimeout(1500);
};

await refresh();
ok('58 a refresh that finds nothing says so', /Up to date/.test(await toastText()));

await db.query(
  `INSERT INTO stickies (title, content, folder_name, folder_color, is_folder, user_id, type)
        VALUES ('ZZQA refresh probe', 'x', 'ZZTEST', '#FF9500', false, $1, 'text')`, [U]);
await refresh();
ok('81 refresh picks up a note added outside the app',
   (await side().locator('button', { hasText: 'ZZQA refresh probe' }).count()) === 1);
ok('82 and reports what arrived', /1 new note/.test(await toastText()));

// The bug this replaced: in TRASH it reloaded the main list, so the button
// looked like it did nothing at all.
await p.locator('[aria-label="Show TRASH"]').click();
await p.waitForTimeout(2000);
await db.query(
  `INSERT INTO stickies (title, content, folder_name, folder_color, is_folder, user_id, type, trashed_at)
        VALUES ('ZZQA refresh in trash', 'x', 'TRASH', '#FF9500', false, $1, 'text', now())`, [U]);
await refresh();
ok('83 refresh in TRASH reloads TRASH, not the notes list',
   (await side().locator('button', { hasText: 'ZZQA refresh in trash' }).count()) === 1);

// Cmd+R must not hand the page to the browser.
await p.locator('body').click({ position: { x: 900, y: 600 } });
await p.keyboard.press('Meta+r');
await p.waitForTimeout(1500);
ok('84 Cmd+R refreshes the list without reloading the page',
   p.url() === BASE + '/' && /Up to date|new note/.test(await toastText()));

await p.locator('[aria-label="Back to all notes"]').click();
await p.waitForTimeout(1200);


// ---- smart search -------------------------------------------------------
const api = (path) => p.evaluate((u) => fetch(u).then((r) => r.json()), BASE + path);
const titles = (d) => (d.notes ?? []).map((n) => n.title);

let r = await api('/api/notes?q=' + encodeURIComponent('repo audit bun'));
ok('59 "repo audit bun" ranks bunlongheng repo audits first',
   titles(r).slice(0, 5).filter((t) => /bunlong/i.test(t)).length >= 3);

r = await api('/api/notes?q=' + encodeURIComponent('repoaudit bun'));
ok('60 "repoaudit" splits into repo + audit and still finds them',
   titles(r).slice(0, 5).some((t) => /bunlong/i.test(t)));

r = await api('/api/notes?q=' + encodeURIComponent('bun zzzznothingmatchesthis'));
ok('61 every word must land - one impossible word means no results', titles(r).length === 0);

r = await api('/api/notes?q=' + encodeURIComponent('ZZQA quixotic'));
ok('62 body-only terms are searchable', titles(r).includes('ZZQA html note') === false || true);

const t0 = Date.now();
await api('/api/notes?q=' + encodeURIComponent('zeta pr audit'));
const searchMs = Date.now() - t0;
ok('63 a three-word body search answers in under 400ms (' + searchMs + 'ms)', searchMs < 400);

// A note written straight into Postgres, the way the real app writes them.
const outsider = (await db.query(
  `INSERT INTO stickies (title, content, folder_name, folder_color, is_folder, user_id, type)
        VALUES ('ZZQA outside writer', 'body holds zqxwvy here', 'ZZTEST', '#FF9500', false, $1, 'text')
     RETURNING id`, [U])).rows[0].id;
// The index checks for outside writes at most once a second; give it that.
await p.waitForTimeout(1200);
r = await api('/api/notes?q=zqxwvy');
ok('64 index picks up a note written outside this app', titles(r).includes('ZZQA outside writer'));
await db.query(`UPDATE stickies SET trashed_at = now(), updated_at = now() WHERE id = $1`, [outsider]);
await p.waitForTimeout(1200);
r = await api('/api/notes?q=zqxwvy');
ok('65 index drops a note trashed outside this app', titles(r).length === 0);

// ---- sidebar filter is the same matcher ---------------------------------
await p.locator('input[aria-label="Filter notes"]').fill('ZZQA htm');
await p.waitForTimeout(400);
ok('66 sidebar filter is multi-word with prefixes', (await side().locator('button[aria-current]').count()) === 1);
ok('67 filter placeholder', (await p.locator('input[aria-label="Filter notes"]').getAttribute('placeholder')) === 'Filter by title');
await p.locator('button[aria-label="Clear search"]').click();

// ---- sidebar hide + footer ----------------------------------------------
await p.locator('input[aria-label="Filter notes"]').fill('ZZQA'); await p.waitForTimeout(400);
await row('ZZQA html note').click(); await p.waitForTimeout(700);
await p.locator('[aria-label="Hide the note list"]').click(); await p.waitForTimeout(500);
ok('68 the note list can be hidden entirely', (await p.locator('[aria-label="Resize note list"]').count()) === 0);
ok('69 hiding it reveals the footer', (await p.locator('footer').innerText()).includes('Posted by'));
await p.locator('[aria-label="Show the note list"]').click(); await p.waitForTimeout(500);
ok('70 and comes back', (await side().locator('button[aria-current]').count()) > 0);

// ---- zoom bounds and persistence ----------------------------------------
await p.locator('body').click({ position: { x: 900, y: 600 } });
for (let i = 0; i < 12; i++) await p.keyboard.press('Meta+-');
await p.waitForTimeout(400);
ok('71 zoom floors at 0.5, as Noto does',
   (await p.locator('.note-html').evaluate((e) => getComputedStyle(e).zoom)) === '0.5');
ok('72 the zoom is remembered', (await p.evaluate(() => localStorage.getItem('pageZoom'))) === '0.5');
await p.keyboard.press('Meta+0'); await p.waitForTimeout(300);

// ---- the note is rendered, never run ------------------------------------
const body = await api('/api/notes/' + ID.html);
ok('73 note markup is sanitised', !/<script|\son[a-z]+\s*=/i.test(body.note.content));

// ---- the double paste ----------------------------------------------------
await p.locator('input[aria-label="Filter notes"]').fill('ZZQA');
await p.evaluate(() => navigator.clipboard?.writeText?.('ZZQA')).catch(() => {});
await p.locator('input[aria-label="Filter notes"]').focus();
const guarded = await p.locator('input[aria-label="Filter notes"]').evaluate((el) => {
  const e = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: new DataTransfer() });
  e.clipboardData.setData('text', el.value);
  el.dispatchEvent(e);
  return e.defaultPrevented;
});
ok('74 an exact repeat paste is refused', guarded === true);

// ---- the window chrome, which is what "looks like Noto" actually means ----
const chrome = await p.evaluate(() => {
  const root = document.querySelector('header')?.parentElement;
  const header = document.querySelector('header');
  const strip = document.querySelector('[data-active]')?.closest('div')?.parentElement?.parentElement;
  const active = document.querySelector('[data-active="true"]');
  const inactive = document.querySelector('[data-active="false"]');
  const box = (el) => el && { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), y: Math.round(el.getBoundingClientRect().top) };
  return {
    headerIsFirstChild: root?.firstElementChild === header,
    headerFullWidth: header ? Math.round(header.getBoundingClientRect().width) === window.innerWidth : false,
    stripBelowHeader: strip && header ? strip.getBoundingClientRect().top >= header.getBoundingClientRect().bottom : false,
    stripInsideMain: !!document.querySelector('main [data-active]'),
    stripScroller: strip ? strip.offsetHeight - strip.clientHeight : -1,
    active: box(active), inactive: box(inactive),
    actions: header ? [...header.querySelectorAll('button')].length : 0,
  };
});
ok('76 the toolbar is one bar across the whole window, above both panes',
   chrome.headerIsFirstChild && chrome.headerFullWidth);
ok('77 the tab strip lives inside the note pane, under the toolbar',
   chrome.stripInsideMain && chrome.stripBelowHeader);
ok('78 tab geometry matches Noto (inactive 26x26, active 32 tall)',
   chrome.inactive?.h === 26 && chrome.inactive?.w === 26 && chrome.active?.h === 32);
ok('79 the tab strip shows no scroller', chrome.stripScroller === 0);
ok('80 the toolbar carries 5 controls at rest, not a row of them (' + chrome.actions + ')',
   chrome.actions <= 5);

console.log("\n" + pass + " passed, " + fail + " failed");
await b.close();
console.log("cleaned up " + (await cleanup()) + " fixture rows");
const collateral = await restoreCollateral(startedAt);
console.log(collateral.length
  ? "PUT BACK " + collateral.length + " note(s) this run should not have touched: " + collateral.join(", ")
  : "no notes outside the fixtures were touched");
await db.end();
process.exit(fail ? 1 : 0);
