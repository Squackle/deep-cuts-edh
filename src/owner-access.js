// Independent owner authentication for member administration. Never returns the credential.
import {reply,sha,originOK} from "./member-auth.js";
import {quota} from "./community-core.js";
export const ownerFail=(status=403)=>reply({error:status===429?"Owner request rate limit reached.":"Owner authorization required."},status);
function constantTimeHex(a,b){
 if(typeof a!=="string"||typeof b!=="string"||a.length!==64||b.length!==64)return false;
 let diff=0;for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
export async function ownerAuth(request,env){
 if(!env.DB||!env.TURNSTILE_SECRET)return {error:reply({error:"Owner dashboard is unavailable."},503)};
 if(!originOK(request))return {error:ownerFail()};
 const allowed=await quota(env.DB,env,request,"owner-console",180);
 if(!allowed)return {error:ownerFail(429)};
 const match=/^Bearer (dcissuer1_[a-f0-9]{64})$/.exec(request.headers.get("Authorization")||"");
 if(!match)return {error:ownerFail()};
 const found=await env.DB.prepare("SELECT key_hash FROM member_issuer_credentials WHERE id=1").first();
 if(!found||!constantTimeHex(await sha(match[1]),found.key_hash))return {error:ownerFail()};
 return {ok:true};
}
