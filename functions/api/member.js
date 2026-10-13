import {reply,random,sha,originOK,authorize,json,sync,H} from "../../src/member-auth.js";
const goodKey=s=>/^dcmember1_[0-9a-f]{32}_[0-9a-f]{64}$/.test(s);
const simple=s=>String(s||"").trim().slice(0,36).replace(/[<>]/g,"");
export async function onRequestGet({request,env}){
 const check=await authorize(request,env);
 if(check.error)return check.error;
 const rows=await env.DB.prepare("SELECT id,label,created_at FROM member_devices WHERE member_id=? AND revoked_at IS NULL ORDER BY created_at").bind(check.account.id).all();
 return reply({ok:true,tier:check.account.tier,active:true,deviceId:check.deviceId,devices:rows.results||[],limit:2,canReplaceAt:Number(check.account.last_replacement||0)+2592000,benefits:["dossier","alternate-builds","early-access","showcase","newsletter","themes","history","probability","collection","watches","question","consultation","editorial","recognition"]});
}
export async function onRequestPost({request,env}){
 if(!originOK(request))return reply({error:"Origin not allowed."},403);
 if(!env.DB)return reply({error:"Membership storage isn't configured."},503);
 let d;try{d=await json(request,2500)}catch{return reply({error:"Invalid request."},400)}
 const action=String(d.action||"");
 if(action==="claim")return reply({error:"Direct Stripe enrollment is retired. Ko-fi member-key issuance is not configured yet."},410);
 if(env.KOFI_MEMBER_ACCESS_READY!=="true")return reply({error:"Ko-fi membership key operations are not enabled yet."},503);
 if(action==="activate"){
  const key=String(d.key||"");if(!goodKey(key))return reply({error:"Invalid membership key format."},400);
  const id=key.split("_")[1],digest=await sha(key);
  let member=await env.DB.prepare("SELECT * FROM member_accounts WHERE id=? AND key_hash=?").bind(id,digest).first();
  if(!member)return reply({error:"Membership key not recognized."},401);
  try{member=await sync(member,env)}catch{return reply({error:"Could not verify membership status."},503)}
  if(member.status!=="active")return reply({error:"Membership is not active."},403);
  const deviceId=random(16),token="dcdevice1_"+random(32),label=simple(d.label)||"My device";
  const r=await env.DB.prepare("INSERT INTO member_devices(id,member_id,token_hash,label) SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM member_devices WHERE member_id=? AND revoked_at IS NULL)<2").bind(deviceId,id,await sha(token),label,id).run();
  if((r.meta?.changes||0)!==1)return reply({error:"Both device slots are occupied. Remove a device from an already activated device before adding another."},409);
  // HttpOnly device cookie keeps the 256-bit credential out of browser JavaScript.
  return new Response(JSON.stringify({ok:true,tier:member.tier,deviceId,message:"Device activated. Keep your original member key safe."}),{
   status:201,headers:{...H,"Set-Cookie":"dc_member_device="+token+"; Path=/api; Secure; HttpOnly; SameSite=Strict; Max-Age=31536000"}
  });
 }
 if(action==="recover"){
  // Recovery uses the original high-entropy member key, not a password or email.
  const key=String(d.key||"");
  if(!goodKey(key))return reply({error:"Enter your original membership key."},400);
  const id=key.split("_")[1];
  let found=await env.DB.prepare("SELECT * FROM member_accounts WHERE id=? AND key_hash=?").bind(id,await sha(key)).first();
  if(!found)return reply({error:"Membership key not recognized."},401);
  try{found=await sync(found,env)}catch{return reply({error:"Could not confirm the subscription."},503)}
  if(found.status!=="active")return reply({error:"Your subscription isn't active."},403);
  const now=Math.floor(Date.now()/1000);
  if(Number(found.last_replacement||0)>now-2592000)return reply({error:"A device has already been replaced within 30 days. Contact support for a lost-device exception."},429);
  const row=await env.DB.prepare("SELECT id FROM member_devices WHERE member_id=? AND revoked_at IS NULL ORDER BY created_at ASC LIMIT 1").bind(id).first();
  if(!row)return reply({error:"No existing device to replace. Use Activate instead."},400);
  const token="dcdevice1_"+random(32),deviceId=random(16),label=simple(d.label)||"Replacement device";
  // D1 batch executes these statements as a single transaction.
  try{
   await env.DB.batch([
    env.DB.prepare("UPDATE member_devices SET revoked_at=? WHERE id=? AND member_id=? AND revoked_at IS NULL").bind(now,row.id,id),
    env.DB.prepare("INSERT INTO member_devices(id,member_id,token_hash,label) VALUES(?,?,?,?)").bind(deviceId,id,await sha(token),label),
    env.DB.prepare("UPDATE member_accounts SET last_replacement=? WHERE id=?").bind(now,id)
   ]);
  }catch{return reply({error:"Could not replace the device right now."},503)}
  return new Response(JSON.stringify({ok:true,tier:found.tier,deviceId,replaced:row.id}),{status:201,headers:{...H,"Set-Cookie":"dc_member_device="+token+"; Path=/api; Secure; HttpOnly; SameSite=Strict; Max-Age=31536000"}});
 }
 if(action==="revoke"){
  const chk=await authorize(request,env);if(chk.error)return chk.error;
  const deviceId=String(d.deviceId||"");
  if(!/^[0-9a-f]{32}$/.test(deviceId))return reply({error:"Invalid device."},400);
  const now=Math.floor(Date.now()/1000);
  if(Number(chk.account.last_replacement||0)>now-2592000)return reply({error:"A device was already replaced in the last 30 days. Contact the site owner for legitimate device loss."},429);
  const result=await env.DB.prepare("UPDATE member_devices SET revoked_at=? WHERE id=? AND member_id=? AND revoked_at IS NULL").bind(now,deviceId,chk.account.id).run();
  if((result.meta?.changes||0)!==1)return reply({error:"Active device not found."},404);
  await env.DB.prepare("UPDATE member_accounts SET last_replacement=? WHERE id=?").bind(now,chk.account.id).run();
  if(deviceId===chk.deviceId)return new Response(JSON.stringify({ok:true,removed:deviceId,ownDeviceRevoked:true}),{headers:{...H,"Set-Cookie":"dc_member_device=; Path=/api; Secure; HttpOnly; SameSite=Strict; Max-Age=0"}});
  return reply({ok:true,removed:deviceId,ownDeviceRevoked:false});
 }
 return reply({error:"Unknown member action."},400);
}
