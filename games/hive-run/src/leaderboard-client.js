import {chicagoDay,dailySeed} from "./modes.js";
import {API_URL} from "./integration.js";
import {RULES_VERSION} from "./engine.js";
const SAFE_SEED=()=>Math.floor(Math.random()*4294967295)||1;
/* Match the site-wide header: older temporary Field Network recovery-key
 * logins must be verified too, not merely remembered-device cookies.
 * Never send an invalid/stale Bearer that would shadow a valid cookie.
 */
const PROFILE_KEY="dc-profile-key";
const PROFILE_PATTERN=/^dcprofile1_[a-f0-9]{32}_[a-f0-9]{64}$/;
let verifiedKey="";
let rejectedKey="";
function savedProfileKey(){
 try{
  const key=sessionStorage.getItem(PROFILE_KEY)||localStorage.getItem(PROFILE_KEY)||"";
  return PROFILE_PATTERN.test(key)?key:"";
 }catch{return ""}
}
async function leaderboardAuthHeaders(){
 const key=savedProfileKey();
 if(!key)return {};
 if(key===verifiedKey)return {Authorization:"Bearer "+key};
 if(key===rejectedKey)return {};
 try{
  const check=await fetch("/api/community?action=me",{
   method:"GET",credentials:"same-origin",cache:"no-store",
   headers:{Accept:"application/json",Authorization:"Bearer "+key}
  });
  if(!check.ok){
   // The shared header retries the cookie on an invalid saved key.
   if(check.status===401)rejectedKey=key;
   return {};
  }
  verifiedKey=key;rejectedKey="";
  return {Authorization:"Bearer "+key};
 }catch{return {}}
}

export class LeaderboardClient{
 constructor(endpoint=API_URL){this.endpoint=endpoint;this.session=null;this.events=[];this.error="";}
 async request(body){
  const headers=await leaderboardAuthHeaders();
  const res=await fetch(this.endpoint,{method:"POST",headers:{"Content-Type":"application/json",...headers},credentials:"same-origin",cache:"no-store",body:JSON.stringify(body)});
  const json=await res.json();
  if(!res.ok)throw Error(json?.error||"Leaderboard request failed.");
  return json;
 }
 async start(mode="hunt",challenge="arcade"){
  this.session=null;this.events=[];this.error="";
  try{
   const data=await this.request({action:"start",mode,challenge});
   if(data.rulesVersion!==RULES_VERSION)throw Error("Leaderboard rules version mismatch.");
   this.session={token:data.token,seed:data.seed};
   return {seed:data.seed,ranked:true,day:data.day};
  }catch(error){this.error=String(error.message||error);return {seed:challenge==="daily"?dailySeed(chicagoDay(),mode):SAFE_SEED(),day:challenge==="daily"?chicagoDay():"",ranked:false}}
 }
 action(tick,kind,value){
  if(!this.session)return;
  if(this.events.length>=14000)return;
  this.events.push([tick,kind,value]);
 }
 async submit(run,alias){
  if(!this.session)throw Error("This is a practice run. Only server-seeded runs can be ranked.");
  const session=this.session;

  const result=await this.request({action:"submit",token:session.token,events:this.events,alias,
   summary:{score:run.score,kills:run.kills,evolutionsChosen:run.evolutionsChosen,ticks:run.runTicks}});
  this.session=null;return result;
 }
 async load(mode="hunt",challenge="arcade"){
  const headers=await leaderboardAuthHeaders();
  const r=await fetch(this.endpoint+"?"+new URLSearchParams({mode,challenge}),{cache:"no-store",credentials:"same-origin",headers});
  const data=await r.json();if(!r.ok)throw Error(data.error||"Unable to fetch leaderboard.");
  return data;
 }
}
