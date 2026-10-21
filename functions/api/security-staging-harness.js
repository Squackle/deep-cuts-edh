/* STAGING-ONLY acceptance harness. Never promote this file to production main.
   Owner Cloudflare Access protects the whole staging hostname, including this route.
   Guard: environment marker + exact hostname + Cloudflare Access JWT forwarded by edge.
   All database writes are synthetic and cleaned even after a failed check. */
import {send,fail,hash,rnd} from "../../src/community-core.js";
import {onRequestGet as recoveryGet,onRequestPost as recoveryPost} from "./profile-recovery.js";
import {onRequestPost as profileDevice} from "./profile-device.js";
import {onRequestPost as communityPost} from "./community.js";
import {onRequestPost as arcanePost} from "./arcane-games.js";
import {onRequestPost as kofiPost} from "./kofi-webhook.js";
import {emailHash,encryptEmail,codeHash} from "../../src/profile-email.js";
import {buildArcanePuzzle,chicagoDate,cipherLetters} from "../../src/arcane-game-data.js";

const ALLOWED_TEST_HOSTS=new Set([
 "deepcuts-edh-security-staging.pages.dev",
 "security-isolated-test-lane-20261020.deepcuts-edh-security-staging.pages.dev"
]);
function stageOK(request,env){
 let url;try{url=new URL(request.url)}catch{return false}
 return env.SECURITY_STAGING==="true"&&url.protocol==="https:"&&ALLOWED_TEST_HOSTS.has(url.hostname)&&!url.port&&
  !!env.DB&&!!env.TURNSTILE_SECRET&&!!env.KOFI_VERIFICATION_TOKEN&&
  !!env.KOFI_EMAIL_HASH_SECRET&&!!request.headers.get("Cf-Access-Jwt-Assertion");
}
function makeRequest(base,path,method="GET",payload=null,authKey="",cookie=""){
 const headers={Origin:base,"CF-Connecting-IP":"192.0.2.81"};
 if(authKey)headers.Authorization="Bearer "+authKey;
 if(cookie)headers.Cookie=cookie;
 if(payload!==null)headers["Content-Type"]="application/json";
 return new Request(base+path,{method,headers,
  body:payload!==null?JSON.stringify(payload):undefined});
}
const note=(checks,name,passed)=>{checks.push({name,passed:!!passed});if(!passed)throw Error("Verification failed: "+name)};
const payload=async result=>{try{return await result.json()}catch{return {}}};
async function removeFixtures(db,f){
 const cleanup=[
  ["DELETE FROM community_deck_versions WHERE deck_id=?",[f.deck]],
  ["DELETE FROM community_decks WHERE id=? AND owner_id=?",[f.deck,f.a]],
  ["DELETE FROM community_device_sessions WHERE profile_id IN (?,?)",[f.a,f.b]],
  ["DELETE FROM community_email_challenges WHERE profile_id IN (?,?)",[f.a,f.b]],
  ["DELETE FROM community_profile_emails WHERE profile_id IN (?,?)",[f.a,f.b]],
  ["DELETE FROM community_pending_recovery_contacts WHERE profile_id IN (?,?)",[f.a,f.b]],
  ["DELETE FROM daily_arcane_badges WHERE profile_id IN (?,?)",[f.a,f.b]],
  ["DELETE FROM daily_arcane_runs WHERE profile_id IN (?,?)",[f.a,f.b]],
  ["DELETE FROM field_collection WHERE profile_id IN (?,?)",[f.a,f.b]],
  ["DELETE FROM community_limits WHERE subject IN (?,?,?)",[f.a,f.b,f.limitHash]],
  ["DELETE FROM community_profiles WHERE id IN (?,?)",[f.a,f.b]]
 ];
 if(f.kofiId){
  const result=await db.prepare("SELECT email_hash FROM kofi_payment_events WHERE message_id=?").bind(f.kofiId).first();
  const digest=result?.email_hash;
  cleanup.unshift(["DELETE FROM kofi_payment_events WHERE message_id=?",[f.kofiId]]);
  cleanup.unshift(["DELETE FROM kofi_adfree_payments WHERE message_id=?",[f.kofiId]]);
  if(digest){
   cleanup.unshift(["DELETE FROM kofi_renewals WHERE email_hash=?",[digest]]);
   cleanup.unshift(["DELETE FROM kofi_adfree_renewals WHERE email_hash=?",[digest]]);
  }
 }
 for(const [sql,args] of cleanup)await db.prepare(sql).bind(...args).run();
 return true;
}
export async function onRequestPost({request,env}){
 if(!stageOK(request,env))return fail("Not found.",404);
 const BASE=new URL(request.url).origin;
 if(request.headers.get("Origin")!==BASE)return fail("Origin rejected.",403);
 let data;try{data=await request.json()}catch{return fail("Malformed test request.",400)}
 if(data?.action!=="run-synthetic-security-suite")return fail("Unknown operation.",404);
 const f={a:rnd(),b:rnd(),deck:rnd(),kofiId:"staging-security-"+rnd(12),
  limitHash:await hash("community:v1:"+env.TURNSTILE_SECRET+":192.0.2.81")};
 const aKey="dcprofile1_"+f.a+"_"+rnd(32),bKey="dcprofile1_"+f.b+"_"+rnd(32);
 const checks=[];let problem="",cleanupOK=false;
 try{
  if(aKey===bKey)throw Error("Fixture identifier collision");
  const deck={commanders:["Chainer, Dementia Master"],cards:[{name:"Sol Ring",qty:1}]};
  const deckSql=JSON.stringify(deck);
  await env.DB.batch([
   env.DB.prepare("INSERT INTO community_profiles(id,handle,key_hash) VALUES(?,?,?)").bind(f.a,"StageSecA"+f.a.slice(0,8),await hash(aKey)),
   env.DB.prepare("INSERT INTO community_profiles(id,handle,key_hash) VALUES(?,?,?)").bind(f.b,"StageSecB"+f.b.slice(0,8),await hash(bKey)),
   env.DB.prepare("INSERT INTO community_decks(id,owner_id,title,commander,content) VALUES(?,?,?,?,?)").bind(f.deck,f.a,"Synthetic-only security fixture","Chainer, Dementia Master",deckSql),
   env.DB.prepare("INSERT INTO community_pending_recovery_contacts(profile_id,email_hash,email_cipher,email_mask,source) VALUES(?,?,?,?,?)")
    // This schema accepts only connected_gmail_oauth, including on synthetic staging records.
    .bind(f.b,await hash("staging-pending-contact:"+f.b),"synthetic-only-not-an-email","s***@example.invalid","connected_gmail_oauth")
  ]);
  const aRecovery=await recoveryGet({request:makeRequest(BASE,"/api/profile-recovery?profile_id="+f.b,"GET",null,aKey),env});
  const aResult=await payload(aRecovery);
  note(checks,"Cross-profile recovery query cannot reveal B's pending contact",
   aRecovery.status===200&&aResult.pending===false&&aResult.pendingMaskedEmail===null);
  const bRecovery=await recoveryGet({request:makeRequest(BASE,"/api/profile-recovery?profile_id="+f.a,"GET",null,bKey),env});
  const bResult=await payload(bRecovery);
  note(checks,"B can see only B's own pending recovery setting",
   bRecovery.status===200&&bResult.pending===true&&bResult.pendingMaskedEmail==="s***@example.invalid");

  const forbidden=await communityPost({request:makeRequest(BASE,"/api/community","POST",
   {action:"version",id:f.deck,deck,owner_id:f.a},bKey),env});
  const dbVersion=await env.DB.prepare("SELECT version FROM community_decks WHERE id=?").bind(f.deck).first();
  note(checks,"Cross-account deck version POST denied before write",forbidden.status===403&&dbVersion?.version===1);
  const allowed=await communityPost({request:makeRequest(BASE,"/api/community","POST",
   {action:"version",id:f.deck,deck,note:"synthetic staged review"},aKey),env});
  const updated=await env.DB.prepare("SELECT version FROM community_decks WHERE id=?").bind(f.deck).first();
  note(checks,"Owner-only deck version POST succeeds",allowed.status===200&&updated?.version===2);

  const remembered=await profileDevice({request:makeRequest(BASE,"/api/profile-device","POST",{action:"remember"},aKey),env});
  const cookie=(remembered.headers.get("Set-Cookie")||"").split(";")[0];
  const viaCookie=await recoveryGet({request:makeRequest(BASE,"/api/profile-recovery","GET",null,"",cookie),env});
  note(checks,"Bearer enrollment issues a working HttpOnly remembered-device cookie",
   remembered.status===200&&cookie.startsWith("__Host-dc_device=dcdevice1_")&&viaCookie.status===200);
  const forgot=await profileDevice({request:makeRequest(BASE,"/api/profile-device","POST",{action:"forget"},"",cookie),env});
  const afterForget=await recoveryGet({request:makeRequest(BASE,"/api/profile-recovery","GET",null,"",cookie),env});
  note(checks,"Forget revokes remembered-device authorization",forgot.status===200&&afterForget.status===401);
  const bareCookie=await profileDevice({request:makeRequest(BASE,"/api/profile-device","POST",{action:"remember"},"",cookie),env});
  note(checks,"Cookie alone cannot silently enroll another device",bareCookie.status===401);

  const rememberedAgain=await profileDevice({request:makeRequest(BASE,"/api/profile-device","POST",{action:"remember"},aKey),env});
  const oldCookie=(rememberedAgain.headers.get("Set-Cookie")||"").split(";")[0];
  note(checks,"Second device enrollment for recovery invalidation",rememberedAgain.status===200);
  const email="fixture-"+f.a+"@example.invalid",challengeId=rnd(),code="12345678",now=Math.floor(Date.now()/1000);
  await env.DB.batch([
   env.DB.prepare("INSERT INTO community_profile_emails(profile_id,email_hash,email_cipher,verified_at) VALUES(?,?,?,?)")
    .bind(f.a,await emailHash(email,env),await encryptEmail(email,env),now),
   env.DB.prepare("INSERT INTO community_email_challenges(id,profile_id,purpose,email_hash,code_hash,expires_at) VALUES(?,?,?,?,?,?)")
    .bind(challengeId,f.a,"recover",await emailHash(email,env),await codeHash(challengeId,code,env),now+900)
  ]);
  const recoverReq=()=>makeRequest(BASE,"/api/profile-recovery","POST",{action:"finish_recovery",email,requestId:challengeId,code,profile_id:f.b});
  const recovered=await recoveryPost({request:recoverReq(),env});
  const rotated=await payload(recovered),newKey=rotated.key;
  const oldAccess=await recoveryGet({request:makeRequest(BASE,"/api/profile-recovery","GET",null,aKey),env});
  const newAccess=await recoveryGet({request:makeRequest(BASE,"/api/profile-recovery","GET",null,newKey),env});
  const lostCookie=await recoveryGet({request:makeRequest(BASE,"/api/profile-recovery","GET",null,"",oldCookie),env});
  note(checks,"Verified synthetic recovery rotates A's key, not B's, and revokes old key/devices",
   recovered.status===200&&typeof newKey==="string"&&newKey.startsWith("dcprofile1_"+f.a+"_")&&
   oldAccess.status===401&&newAccess.status===200&&lostCookie.status===401);
  const replay=await recoveryPost({request:recoverReq(),env});
  note(checks,"One-time recovery code replay is refused",replay.status===400);
  const bStill=await recoveryGet({request:makeRequest(BASE,"/api/profile-recovery","GET",null,bKey),env});
  note(checks,"Recovery operation did not invalidate unrelated profile B",bStill.status===200);

  const puzzle=buildArcanePuzzle("cipher",chicagoDate());
  const answer=cipherLetters(puzzle.word),guess=(answer==="Z".repeat(answer.length)?"X":"Z").repeat(answer.length);
  const game=await arcanePost({request:makeRequest(BASE,"/api/arcane-games","POST",{
   game:"cipher",mode:"daily",day:chicagoDate(),seed:0,action:"guess",guess,
   profile_id:f.b,score:999999,won:true,history:[answer],badges:["cipher_perfect"]
  },newKey),env});
  const played=await payload(game);
  const saved=await env.DB.prepare("SELECT profile_id,score,won,progress FROM daily_arcane_runs WHERE profile_id=? AND game='cipher' AND day=?")
   .bind(f.a,chicagoDate()).first();
  const wrongAccount=await env.DB.prepare("SELECT COUNT(*) AS n FROM daily_arcane_runs WHERE profile_id=?").bind(f.b).first();
  note(checks,"Daily-game POST ignores forged score, badge, opponent identity and winning history",
   game.status===200&&played.score===0&&played.won===false&&saved?.score===0&&saved?.won===0&&
   JSON.stringify(JSON.parse(saved?.progress||"[]"))===JSON.stringify([guess])&&wrongAccount?.n===0);

  const kofiEvent={
   verification_token:env.KOFI_VERIFICATION_TOKEN,
   type:"Subscription",is_subscription_payment:true,tier_name:"The Informant",
   amount:"5.00",currency:"USD",is_refunded:false,
   email:"fixture-"+f.a+"@example.invalid",message_id:f.kofiId,
   timestamp:new Date().toISOString()
  };
  const callKofi=async d=>{
   const body=new URLSearchParams({data:JSON.stringify(d)});
   const req=new Request(BASE+"/api/kofi-webhook",{method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString()});
   return kofiPost({request:req,env});
  };
  const firstPay=await callKofi(kofiEvent);
  const firstData=await payload(firstPay);
  const secondPay=await callKofi({...kofiEvent,amount:"25.00",tier_name:"The Chief Investigator"});
  const secondData=await payload(secondPay);
  const spoof=await callKofi({...kofiEvent,verification_token:"not-a-real-token",message_id:f.kofiId+"-spoof"});
  const refund=await callKofi({...kofiEvent,message_id:f.kofiId+"-refund",is_refunded:true});
  const dbPayments=await env.DB.prepare("SELECT COUNT(*) AS n FROM kofi_payment_events WHERE message_id=?").bind(f.kofiId).first();
  note(checks,"Synthetic Ko-fi webhook accepts one event, blocks replay/forgery/refund",
   firstPay.status===200&&firstData.recorded===true&&secondPay.status===200&&
   secondData.duplicate===true&&spoof.status===403&&refund.status===200&&dbPayments?.n===1);
 }catch(e){problem=String(e?.message||"Unexpected test failure").slice(0,180)}
 finally{try{cleanupOK=await removeFixtures(env.DB,f)}catch(e){cleanupOK=false;problem=(problem+"; fixture cleanup failed").slice(0,180)}}
 return send({ok:!problem&&cleanupOK,checks,cleanupOK,
   ...(problem?{error:problem}:{}),notice:"Synthetic staging-only test; no real players or payment provider."},
   !problem&&cleanupOK?200:500);
}
export function onRequestGet(){return fail("Use owner-authorized staging test page.",405)}
