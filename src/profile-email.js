// Server-only encrypted email association and one-time recovery verification.
// Domain-separated derivation from an existing encrypted Cloudflare secret.
import {hex,rnd,hash} from "./community-core.js";
const encoder=new TextEncoder(),decoder=new TextDecoder();
export function normalizeEmail(value){
 if(typeof value!=="string")return "";
 const s=value.trim().toLowerCase();
 return s.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&!/\p{C}/u.test(s)?s:"";
}
export function emailReady(env){
 return Boolean(env.DB&&env.KOFI_EMAIL_HASH_SECRET&&env.RESEND_API_KEY&&env.PROFILE_EMAIL_FROM);
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
export async function deliverCode(env,email,code,requestId,purpose){
 const action=purpose==="verify"?"verify your profile email":"recover your profile access";
 const subject="Deep Cuts EDH — Your verification code";
 const message="Use this 8-digit code to "+action+": "+code+"\n\nThe code expires in 15 minutes and can be used only once.\n\nIf you did not request it, ignore this message. Never share the code with anyone.\n\nDeep Cuts EDH";
 const res=await fetch("https://api.resend.com/emails",{
  method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"deep-cuts-profile-"+requestId},
  body:JSON.stringify({from:env.PROFILE_EMAIL_FROM,to:[email],subject,text:message})
 });
 if(!res.ok){console.error("Profile recovery email provider rejected a delivery",res.status);throw Error("Unable to deliver verification email.")}
}
