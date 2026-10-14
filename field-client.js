import {state,el,appendProfileMentions} from "./community.js";
export const $$=id=>document.getElementById(id);
export const norm=name=>String(name||"").toLowerCase().normalize("NFKC").replace(/[^a-z0-9]/g,"");
export const currency=value=>"$"+Number(value||0).toFixed(2);
export function dateLabel(seconds){try{return new Date(Number(seconds)*1000).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}catch{return "Date unknown"}}
export function text(tag,value,cls){return el(tag,String(value??""),cls)}
export function emptyNotice(host,message){host.replaceChildren(text("p",message,"cm-note"))}
export function mentionNode(value,tag="span"){const n=el(tag);appendProfileMentions(n,value);return n}
export function linkButton(title,href){
 const a=el("a",title,"cm-text-link");a.href=href;return a;
}
export function showFieldError(host,error){if(host)host.textContent=error?.message||"This Community tool is unavailable."}
export async function fieldGet(action,params={}){
 const url=new URL("/api/field-expansion",location.href);url.searchParams.set("action",action);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const headers={};if(state.key)headers.Authorization="Bearer "+state.key;
 const r=await fetch(url,{headers,cache:"no-store",credentials:"same-origin"});
 let d;try{d=await r.json()}catch{throw Error("The Community server did not return valid data.")}
 if(!r.ok)throw Error(d.error||"Request failed ("+r.status+").");
 return d;
}
export async function fieldPost(action,fields={}){
 const headers={"Content-Type":"application/json"};if(state.key)headers.Authorization="Bearer "+state.key;
 const r=await fetch("/api/field-expansion",{method:"POST",headers,cache:"no-store",credentials:"same-origin",body:JSON.stringify({action,...fields})});
 let d;try{d=await r.json()}catch{throw Error("The Community server did not return valid data.")}
 if(!r.ok)throw Error(d.error||"Request failed ("+r.status+").");
 return d;
}
export function requireProfile(){if(state.me)return true;throw Error("Sign in to your Community profile first.")}
