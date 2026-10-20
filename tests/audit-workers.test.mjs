import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {hash} from '../src/community-core.js';
import {emailHash,encryptEmail,codeHash} from '../src/profile-email.js';
import {chicagoDate,buildArcanePuzzle,cipherLetters} from '../src/arcane-game-data.js';
const root=new URL('../',import.meta.url);
const profileId='a'.repeat(32),key='dcprofile1_'+profileId+'_'+'b'.repeat(64);
const deck={commanders:['Commander Mustard'],cards:[{name:'Plains',qty:35}],targetBracket:2};

test('Cloudflare workerd + isolated D1: persistence, sessions, recovery and daily scoring',{timeout:60000},async t=>{
 const bundle=await build({entryPoints:[new URL('tests/helpers/audit-worker.js',root).pathname],bundle:true,write:false,format:'esm',platform:'browser'});
 const env={TURNSTILE_SECRET:'synthetic-turnstile',KOFI_EMAIL_HASH_SECRET:'synthetic-email-key',RESEND_API_KEY:'synthetic-no-mail',PROFILE_EMAIL_FROM:'audit@example.invalid'};
 const mf=new Miniflare({modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-07-01',d1Databases:['DB'],bindings:env,
  outboundService:()=>{throw Error('External services are blocked in this test')}});
 t.after(()=>mf.dispose());
 const db=await mf.getD1Database('DB');
 for(const name of ['community','community-v2','community-avatar-focus','community-bio-emoji','portrait-and-device-sessions','premium','member-and-email-recovery','community-email-pending','email-owner-recovery-grants','arcane-daily-games-2026-10']){
  const sql=readFileSync(new URL('db/'+name+'.sql',root),'utf8');
  // D1 exec accepts one SQL statement per line; retain trigger BEGIN..END.
  const statements=sql.replace(/^\s*--.*$/gm,'').match(/\s*CREATE TRIGGER[\s\S]*?END;|\s*[^;]+;/gi)||[];
  for(const statement of statements)await db.exec(statement.replace(/\s+/g,' ').trim());
 }
 await db.prepare('INSERT INTO community_profiles(id,handle,key_hash) VALUES(?,?,?)').bind(profileId,'AuditProfile',await hash(key)).run();
 const req=(path,data,headers={})=>mf.dispatchFetch('https://audit.invalid'+path,{
  ...(data?{method:'POST',body:JSON.stringify(data)}:{}),
  headers:{Origin:'https://audit.invalid','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',Authorization:'Bearer '+key,...headers}
 });
 let published;
 await t.test('publish/update SQL and rollback of a failed version insertion',async()=>{
  const created=await req('/api/community',{action:'publish_deck',title:'Local audit deck',deck});assert.equal(created.status,201);
  published=(await created.json()).id;
  const update={action:'version',id:published,deck:{...deck,cards:[{name:'Plains',qty:36}]},note:'Version two'};
  assert.equal((await req('/api/community',update)).status,200);
  await db.exec("CREATE TRIGGER audit_fail_history BEFORE INSERT ON community_deck_versions WHEN NEW.version=3 BEGIN SELECT RAISE(ABORT,'synthetic history failure'); END;");
  assert.equal((await req('/api/community',{...update,deck})).status,503);
  const saved=await db.prepare('SELECT version,content FROM community_decks WHERE id=?').bind(published).first();
  assert.equal(saved.version,2);assert.equal(JSON.parse(saved.content).cards[0].qty,36);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM community_deck_versions WHERE deck_id=?').bind(published).first()).n,2);
 });
 let cookie;
 await t.test('remember, cookie session, invalid bearer and cross-origin rejection',async()=>{
  const remembered=await req('/api/profile-device',{action:'remember'});assert.equal(remembered.status,200);
  cookie=remembered.headers.get('Set-Cookie');assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
  cookie=cookie.split(';')[0];
  const session=await req('/api/community?action=session',null,{Authorization:'',Cookie:cookie});
  assert.equal((await session.json()).profile.id,profileId);
  const invalid=await req('/api/community?action=me',null,{Authorization:'Bearer invalid',Cookie:cookie});assert.equal(invalid.status,401);
  assert.equal((await req('/api/profile-device',{action:'forget'},{Origin:'https://untrusted.invalid',Cookie:cookie})).status,403);
 });
 await t.test('one-use recovery rotates the key and invalidates remembered devices',async()=>{
  const email='local@example.invalid',id='c'.repeat(32),code='12345678',now=Math.floor(Date.now()/1000),digest=await emailHash(email,env);
  await db.prepare('INSERT INTO community_profile_emails(profile_id,email_hash,email_cipher,verified_at) VALUES(?,?,?,?)').bind(profileId,digest,await encryptEmail(email,env),now).run();
  await db.prepare("INSERT INTO community_email_challenges(id,profile_id,purpose,email_hash,code_hash,expires_at) VALUES(?,?,'recover',?,?,?)").bind(id,profileId,digest,await codeHash(id,code,env),now+900).run();
  const body={action:'finish_recovery',email,requestId:id,code};
  assert.equal((await req('/api/profile-recovery',{...body,code:'00000000'})).status,400);
  const recovered=await req('/api/profile-recovery',body);assert.equal(recovered.status,200);
  const fresh=(await recovered.json()).key;assert.notEqual(fresh,key);
  assert.equal((await req('/api/profile-recovery',body)).status,400);
  assert.equal((await req('/api/community?action=me')).status,401);
  assert.equal((await req('/api/community?action=me',null,{Authorization:'',Cookie:cookie})).status,401);
  assert.equal((await req('/api/community?action=me',null,{Authorization:'Bearer '+fresh})).status,200);
  await db.prepare('UPDATE community_profiles SET key_hash=? WHERE id=?').bind(await hash(key),profileId).run();
 });
 await t.test('daily puzzles freeze in D1 and replayed wins cannot add scores or badges',async()=>{
  const state=await req('/api/arcane-games?game=cipher');assert.equal(state.status,200);
  const day=chicagoDate(),puzzle=buildArcanePuzzle('cipher',day),guess=cipherLetters(puzzle.word);
  const snapshot=await db.prepare("SELECT payload FROM daily_arcane_puzzles WHERE game='cipher' AND day=?").bind(day).first();
  assert.ok(snapshot);
  const win=await req('/api/arcane-games',{action:'guess',game:'cipher',day,guess});
  assert.equal(win.status,200,await win.clone().text());assert.equal((await win.json()).won,true);
  const before=await db.prepare('SELECT COUNT(*) AS n FROM daily_arcane_badges').first();
  await req('/api/arcane-games',{action:'guess',game:'cipher',day,guess});
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM daily_arcane_badges').first()).n,before.n);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM daily_arcane_runs').first()).n,1);
 });
});
