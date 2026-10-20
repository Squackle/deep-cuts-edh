/* Deep Cuts EDH standalone Cloudflare scheduled Worker.
 * Deployed separately from Pages: merging this file does NOT deploy the Worker.
 * Keep the two existing UTC schedules and all production D1 bindings unchanged.
 * Never perform database retention from this unbound prewarm-only Worker.
 */
const BASE="https://deep-cuts-edh.pages.dev";
const ROUTES=Object.freeze([
 {game:"cold",path:"/api/daily-games?action=state&game=cold"},
 {game:"ladder",path:"/api/daily-games?action=state&game=ladder"}
]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const BACKOFF=[350,900]; // Three bounded attempts, < 2 seconds intentional backoff.
function validSnapshot(value,game){
 return value&&value.game===game&&/^\d{4}-\d\d-\d\d$/.test(value.day||"")&&
  value.snapshot&&typeof value.snapshot==="object";
}
function statusError(response,game){
 const error=new Error("Puzzle prewarm "+game+" returned HTTP "+response.status);
 // Cloudflare endpoint returned a client error; retrying cannot fix it unless
 // the server is explicitly throttling us.
 error.retryable=response.status===408||response.status===429||response.status>=500;
 return error;
}
async function fetchOne(route,{fetcher,wait,base}){
 for(let attempt=0;attempt<3;attempt++){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  let failure;
  try{
   const response=await fetcher(base+route.path,{
    method:"GET",
    headers:{"Accept":"application/json","Cache-Control":"no-cache"},
    redirect:"error",signal:controller.signal
   });
   if(!response.ok)throw statusError(response,route.game);
   const data=await response.json();
   if(!validSnapshot(data,route.game)){
    const e=new Error("Puzzle prewarm "+route.game+" returned an invalid snapshot");
    e.retryable=true;throw e;
   }
   return {game:data.game,day:data.day,ready:true};
  }catch(error){failure=error}
  finally{clearTimeout(timeout)}
  if(failure.retryable===false||attempt===2)throw failure;
  await wait(BACKOFF[attempt]);
 }
}
async function alertFailure(env,failed,fetcher){
 if(!env?.ALERT_WEBHOOK_URL)return;
 try{
  // Optional owner-configured HTTPS webhook. No puzzles, tokens, personal data
  // or HTTP response bodies leave this Worker.
  const url=new URL(env.ALERT_WEBHOOK_URL);
  if(url.protocol!=="https:")throw Error("Alert URL must be HTTPS");
  await fetcher(url.toString(),{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({event:"daily-puzzle-prewarm-failed",
    games:failed.map(x=>x.game),at:new Date().toISOString()})
  });
 }catch(error){
  console.error("Daily puzzle alert delivery failed",error?.message||"unknown");
 }
}
export async function prepare({fetcher=fetch,wait=sleep,base=BASE,env}={}){
 const ready=[],failed=[];
 // One bad API must not prevent the other day's puzzle from being prepared.
 for(const route of ROUTES){
  try{ready.push(await fetchOne(route,{fetcher,wait,base}))}
  catch(error){
   console.error("Daily puzzle prewarm failed",route.game,error?.message||"unknown");
   failed.push({game:route.game});
  }
 }
 if(failed.length){
  await alertFailure(env,failed,fetcher);
  throw Error("Daily puzzle prewarm failed for "+failed.map(x=>x.game).join(", "));
 }
 console.log("Deep Cuts daily puzzles ready",JSON.stringify(ready));
 return ready;
}
export default {
 scheduled(_event,env,ctx){ctx.waitUntil(prepare({env}))},
 fetch(){
  return new Response("Deep Cuts EDH puzzle clock: scheduled prewarm only.",{
   status:200,headers:{"Content-Type":"text/plain;charset=utf-8","Cache-Control":"no-store"}
  });
 }
};
