// Owner-only, read-on-demand Cloudflare usage. No per-visitor tracking writes.
// Do not log credentials or forward token/GraphQL errors to the browser.
const API="https://api.cloudflare.com/client/v4";
const COMMUNITY_ID="5f870895-4281-45d2-b331-45c8182e1079";
const HIVE_ID="47254394-3679-43f3-9ca3-9a14155d5a17";
export const FREE_REFERENCE=Object.freeze({workersRequestsDay:100000,d1RowsReadDay:5000000,d1RowsWrittenDay:100000,d1DatabaseBytes:500000000});
const boundedNumber=v=>Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v))):0;
const asDate=timestamp=>new Date(timestamp).toISOString().slice(0,10);
const days=(today,n)=>Array.from({length:n},(_,i)=>asDate(today-(n-1-i)*86400000));
const analyticsQuery=`query OwnerUsage($account: string!, $start: Time!, $end: Time!, $dateStart: Date!, $dateEnd: Date!) {
 viewer { accounts(filter: {accountTag:$account}) {
  workersInvocationsAdaptive(limit:10000,filter:{datetime_geq:$start,datetime_lt:$end}) {
   dimensions { datetime scriptName }
   sum {requests errors}
  }
  d1AnalyticsAdaptiveGroups(limit:500,filter:{date_geq:$dateStart,date_leq:$dateEnd}) {
   dimensions {date databaseId}
   sum {rowsRead rowsWritten readQueries writeQueries}
  }
 } }
}`;
export function summarizeCloudflareUsage(payload,now=Date.now()){
 if(!payload?.data?.viewer?.accounts?.length||payload.errors?.length)throw Error("Invalid analytics response");
 const account=payload.data.viewer.accounts[0],period=days(now,7);
 if(!Array.isArray(account.workersInvocationsAdaptive)||!Array.isArray(account.d1AnalyticsAdaptiveGroups))throw Error("Analytics datasets not available");
 const worker=Object.fromEntries(period.map(date=>[date,{date,requests:0,errors:0}]));
 for(const item of account.workersInvocationsAdaptive){
  const day=String(item.dimensions?.datetime||"").slice(0,10);
  if(worker[day]){worker[day].requests+=boundedNumber(item.sum?.requests);worker[day].errors+=boundedNumber(item.sum?.errors)}
 }
 const d1=Object.fromEntries(period.map(date=>[date,{date,rowsRead:0,rowsWritten:0,queriesRead:0,queriesWritten:0}]));
 const databases={community:{id:COMMUNITY_ID,label:"Community D1",rowsRead:0,rowsWritten:0,sizeBytes:null},hive:{id:HIVE_ID,label:"Hive Run D1",rowsRead:0,rowsWritten:0,sizeBytes:null}};
 for(const item of account.d1AnalyticsAdaptiveGroups){
  const day=String(item.dimensions?.date||"").slice(0,10),v=item.sum||{};
  if(d1[day]){
   d1[day].rowsRead+=boundedNumber(v.rowsRead);
   d1[day].rowsWritten+=boundedNumber(v.rowsWritten);
   d1[day].queriesRead+=boundedNumber(v.readQueries);
   d1[day].queriesWritten+=boundedNumber(v.writeQueries);
  }
  const record=Object.values(databases).find(db=>db.id===item.dimensions?.databaseId);
  if(record){record.rowsRead+=boundedNumber(v.rowsRead);record.rowsWritten+=boundedNumber(v.rowsWritten)}
 }
 const today=period.at(-1);
 return {state:"connected",range:{start:period[0],end:today,timezone:"UTC",sampled:true},
  workers:{scope:"Entire Cloudflare account — not only DeepCutsEDH",today:worker[today],daily:Object.values(worker),mayBeIncomplete:account.workersInvocationsAdaptive.length>=10000},
  d1:{scope:"Entire Cloudflare account across all D1 databases",today:d1[today],daily:Object.values(d1),databases,mayBeIncomplete:account.d1AnalyticsAdaptiveGroups.length>=500},
  note:"Cloudflare sampled analytics; today's UTC counts may be delayed and are not unique visitors."};
}
async function cfRequest(url,options){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(6500)});
 if(!response.ok)throw Error("Cloudflare metrics request unavailable");
 return response.json();
}
async function databaseSize(account,token,id){
 try{
  const json=await cfRequest(API+"/accounts/"+account+"/d1/database/"+id,{
   headers:{"Authorization":"Bearer "+token,"Accept":"application/json"}
  });
  return json?.success===true&&Number.isFinite(Number(json?.result?.file_size))?Number(json.result.file_size):null;
 }catch{return null}
}
export async function readOwnerCapacity(env,{now=Date.now()}={}){
 const freeReference={planVerified:false,label:"Free-plan reference only (not your confirmed billing tier)",...FREE_REFERENCE};
 const configured=typeof env.CLOUDFLARE_ACCOUNT_ID==="string"&&/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID)&&
  typeof env.CLOUDFLARE_ANALYTICS_TOKEN==="string"&&env.CLOUDFLARE_ANALYTICS_TOKEN.length>=20;
 const base={freeReference,configuration:{connected:configured,needs:["CLOUDFLARE_ACCOUNT_ID","CLOUDFLARE_ANALYTICS_TOKEN"],
  message:configured?"Using a private server-side read-only Cloudflare token.":"Add the two secret production bindings to enable account usage; no traffic tracking is injected into visitors' browsers."}};
 if(!configured)return {...base,state:"not_configured",workers:null,d1:null};
 const account=env.CLOUDFLARE_ACCOUNT_ID,token=env.CLOUDFLARE_ANALYTICS_TOKEN;
 const t=new Date(now),from=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()-6));
 const vars={account,start:from.toISOString(),end:new Date(now+60000).toISOString(),dateStart:asDate(from),dateEnd:asDate(t)};
 try{
  const payload=await cfRequest(API+"/graphql",{method:"POST",headers:{"Authorization":"Bearer "+token,"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({query:analyticsQuery,variables:vars})});
  const data=summarizeCloudflareUsage(payload,now);
  const [community,hive]=await Promise.all([databaseSize(account,token,COMMUNITY_ID),databaseSize(account,token,HIVE_ID)]);
  data.d1.databases.community.sizeBytes=community;
  data.d1.databases.hive.sizeBytes=hive;
  return {...base,...data,configuration:{...base.configuration,message:"Account-level analytics enabled. DB file sizes require additional D1 Read permission; missing figures remain unavailable."}};
 }catch{
  return {...base,state:"unavailable",workers:null,d1:null,configuration:{...base.configuration,message:"Cloudflare analytics could not be read. Check the token's Account Analytics Read permission and account ID; no usage is estimated."}};
 }
}
