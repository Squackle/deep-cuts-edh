// Private, revocable, per-browser sign-in without storing recovery keys in localStorage.
import {send,fail,auth,body,originOK,rnd,hash,deviceToken,PROFILE_DEVICE_COOKIE} from "../../src/community-core.js";
const SECONDS=90*24*60*60;
function cookie(value,seconds){
 return PROFILE_DEVICE_COOKIE+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+seconds;
}
function response(data,value,seconds,status=200){
 const r=send(data,status);
 r.headers.set("Set-Cookie",cookie(value,seconds));
 return r;
}
export async function onRequestPost({request,env}){
 if(!env.DB)return fail("Remembered devices are unavailable.",503);
 // Only our own Field Network frontend may create/revoke device sessions.
 if(!request.headers.get("Origin")||!originOK(request))return fail("Origin rejected.",403);
 let data;try{data=await body(request)}catch{return fail("Invalid request.",400)}
 if(data?.action==="forget"){
  const token=deviceToken(request);
  if(token){
   await env.DB.prepare("DELETE FROM community_device_sessions WHERE token_hash=?").bind(await hash(token)).run();
  }
  return response({ok:true,remembered:false},"",0);
 }
 if(data?.action!=="remember")return fail("Unknown operation.",404);
 // A recovered or registered profile key must be presented to remember this device.
 // Existing cookies must NOT silently enroll another browser or issue new sessions.
 if(!/^Bearer dcprofile1_[a-f0-9]{32}_[a-f0-9]{64}$/.test(request.headers.get("Authorization")||""))
  return fail("A valid profile key is required to remember this device.",401);
 const a=await auth(request,env.DB);
 if(!a)return fail("Profile key is invalid. Please sign in again.",401);
 // Keep the allowed number of remembered browsers bounded per account.
 await env.DB.prepare("DELETE FROM community_device_sessions WHERE expires_at<=unixepoch()").run();
 const previous=deviceToken(request);
 if(previous){
  await env.DB.prepare("DELETE FROM community_device_sessions WHERE token_hash=?").bind(await hash(previous)).run();
 }
 const token="dcdevice1_"+rnd(32),digest=await hash(token),now=Math.floor(Date.now()/1000);
 await env.DB.prepare("INSERT INTO community_device_sessions(token_hash,profile_id,expires_at) VALUES(?,?,?)")
  .bind(digest,a.id,now+SECONDS).run();
 await env.DB.prepare("DELETE FROM community_device_sessions WHERE profile_id=? AND token_hash NOT IN (SELECT token_hash FROM community_device_sessions WHERE profile_id=? ORDER BY created_at DESC, rowid DESC LIMIT 10)")
  .bind(a.id,a.id).run();
 return response({ok:true,remembered:true,expiresAt:now+SECONDS},token,SECONDS);
}
