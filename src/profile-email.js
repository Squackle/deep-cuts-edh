// Server-only encrypted email association and one-time recovery verification.
// Domain-separated derivation from an existing encrypted Cloudflare secret.
import {hex,rnd,hash} from "./community-core.js";
const encoder=new TextEncoder(),decoder=new TextDecoder();
export function normalizeEmail(value){
 if(typeof value!=="string")return "";
 const s=value.trim().toLowerCase();
 return s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&!/\p{C}/u.test(s)?s:"";
}
// Only a deployment-created Apps Script endpoint is accepted as a sender destination.
function googleMailerUrl(env){
 const value=typeof env.GOOGLE_MAILER_URL==="string"?env.GOOGLE_MAILER_URL:"";
 try{
  const url=new URL(value);
  return url.protocol==="https:"&&url.hostname==="script.google.com"&&
    /^\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url.pathname)&&
    !url.search&&!url.hash?url.href:null;
 }catch{return null}
}
export function emailReady(env){
 return Boolean(env.DB&&env.KOFI_EMAIL_HASH_SECRET&&(
  (googleMailerUrl(env)&&/^[0-9a-f]{64}$/.test(env.GOOGLE_MAILER_SECRET||""))||
  (env.RESEND_API_KEY&&env.PROFILE_EMAIL_FROM)
 ));
}
export async function emailHash(email,env){
 const key=await crypto.subtle.importKey("raw",encoder.encode(env.KOFI_EMAIL_HASH_SECRET),"HMAC",false,["sign"]);
 const sig=await crypto.subtle.sign("HMAC",key,encoder.encode("deep-cuts-profile-email-index:v1:"+email));
 return hex(new Uint8Array(sig));
}
async function encryptionKey(env){
 const keyBits=await crypto.subtle.digest("SHA-256",encoder.encode("deep-cuts-profile-email-encryption:v1:"+env.KOFI_EMAIL_HASH_SECRET));
 return crypto.subtle.importKey("raw",keyBits,"AES-GCM",false,["encrypt","decrypt"]);
}
const base64=b=>btoa(String.fromCharCode(...b));
const bytes=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
export async function encryptEmail(email,env){
 const nonce=crypto.getRandomValues(new Uint8Array(12));
 const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv:nonce,additionalData:encoder.encode("community-profile-email:v1")},await encryptionKey(env),encoder.encode(email));
 return base64(nonce)+"."+base64(new Uint8Array(ct));
}
export async function decryptEmail(data,env){
 const parts=String(data||"").split(".");
 if(parts.length!==2)throw Error("Malformed encrypted address");
 const iv=bytes(parts[0]),ct=bytes(parts[1]);
 if(iv.length!==12||ct.length>512)throw Error("Malformed encrypted address");
 const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv,additionalData:encoder.encode("community-profile-email:v1")},await encryptionKey(env),ct);
 return decoder.decode(pt);
}
export function hideEmail(email){
 const [user,domain]=email.split("@");
 return (user.length<=2?user[0]+"*":user.slice(0,2)+"***")+"@"+domain;
}
export function newCode(){
 // Rejection sampling avoids modulo bias across 100 million 8-digit values.
 const x=new Uint32Array(1),max=4200000000;
 do{crypto.getRandomValues(x)}while(x[0]>=max);
 return String(x[0]%100000000).padStart(8,"0");
}
export async function codeHash(challengeId,code,env){
 return hash("community-email-otp:v1:"+env.KOFI_EMAIL_HASH_SECRET+":"+challengeId+":"+code);
}
export function verifyHash(a,b){
 if(!/^[a-f0-9]{64}$/.test(String(a||""))||!/^[a-f0-9]{64}$/.test(String(b||"")))return false;
 let diff=0;for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
async function deliverViaGoogle(env,email,code,requestId,purpose){
 const url=googleMailerUrl(env);
 if(!url||!/^[a-f0-9]{64}$/.test(env.GOOGLE_MAILER_SECRET||""))
  throw Error("The Google mailer has not been configured.");
 // Canonical signed request: secret stays in an encrypted Cloudflare variable and a
 // Google Apps Script property. Never send it to the client or in the request URL.
 const ts=Date.now();
 const canonical=["v1",String(ts),requestId,purpose,email,code].join("\n");
 const secret=await crypto.subtle.importKey("raw",encoder.encode(env.GOOGLE_MAILER_SECRET),"HMAC",false,["sign"]);
 const signature=hex(new Uint8Array(await crypto.subtle.sign("HMAC",secret,encoder.encode(canonical))));
 const body=JSON.stringify({version:1,ts,id:requestId,purpose,email,code,signature});
 let res=await fetch(url,{method:"POST",
  headers:{"Content-Type":"text/plain;charset=utf-8"},body,redirect:"manual"});
 // ContentService returns a redirect to script.googleusercontent.com.
 // Only follow that exact destination and do not forward POST/body/signature.
 if([301,302,303,307,308].includes(res.status)){
  const location=res.headers.get("Location");
  if(!location)throw Error("Google mailer did not return a response location.");
  const next=new URL(location);
  if(next.protocol!=="https:"||next.hostname!=="script.googleusercontent.com")
   throw Error("Google mailer returned an untrusted redirect.");
  res=await fetch(next.href,{method:"GET",redirect:"manual"});
 }
 if(!res.ok){console.error("Google mailer transport failure",res.status);throw Error("Google mail delivery failed.");}
 let output;try{
  const raw=await res.text();
  if(raw.length>1200)throw Error("Unexpected response size.");
  output=JSON.parse(raw);
 }catch{throw Error("Google mailer did not return a valid response.")}
 if(output?.ok!==true||output?.version!==1||output?.id!==requestId||
    !["sent","already-sent"].includes(output?.status)){
  // Fail closed: Google must acknowledge this exact request ID.
  console.error("Google mailer did not confirm the request",String(output?.status||"invalid"));
  throw Error("Google mailer did not confirm email delivery.");
 }
}
async function deliverViaResend(env,email,code,requestId,purpose){
 const action=purpose==="verify"?"verify your profile email":"recover your profile access";
 const subject="Deep Cuts EDH — Your verification code";
 const message="Use this 8-digit code to "+action+": "+code+"\n\nThe code expires in 15 minutes and can be used only once.\n\nIf you did not request it, ignore this message. Never share the code with anyone.\n\nDeep Cuts EDH";
 const res=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"deep-cuts-profile-"+requestId},
  body:JSON.stringify({from:env.PROFILE_EMAIL_FROM,to:[email],subject,text:message})
 });
 if(!res.ok){console.error("Profile recovery email provider rejected a delivery",res.status);throw Error("Unable to deliver verification email.")}
}
export async function deliverCode(env,email,code,requestId,purpose){
 if(!/^[a-f0-9]{32}$/.test(requestId)||!["verify","recover"].includes(purpose)||
    !/^\d{8}$/.test(code)||normalizeEmail(email)!==email)
  throw Error("Invalid recovery email request.");
 if(googleMailerUrl(env)&&/^[0-9a-f]{64}$/.test(env.GOOGLE_MAILER_SECRET||""))
  return deliverViaGoogle(env,email,code,requestId,purpose);
 if(env.RESEND_API_KEY&&env.PROFILE_EMAIL_FROM)
  return deliverViaResend(env,email,code,requestId,purpose);
 throw Error("No transactional mail service configured.");
}
