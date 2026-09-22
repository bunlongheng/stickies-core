import pg from 'pg'; import fs from 'fs';
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const p=new pg.Pool({connectionString:env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
const r=(await p.query(`select is_public, locked, lock_password_hash from stickies where id=$1`,['a2378154-8868-4716-b64f-a24fd435beb7'])).rows[0];
console.log('  is_public :', r.is_public);
console.log('  locked    :', r.locked);
const h=r.lock_password_hash||'';
console.log('  hash shape:', h.split('$').map(x=>x.length).join(' $ ')+'  (expect 32 $ 64)');
await p.end();
