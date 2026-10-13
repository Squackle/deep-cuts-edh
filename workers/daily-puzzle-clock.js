/* Cloudflare Worker Cron Trigger — prepares daily puzzles on schedule.
 * Runs twice daily at 05:15 and 06:15 UTC, covering 00:15 Central during
 * daylight-saving or standard time respectively.
 * The Pages Functions create and freeze the puzzle snapshots in D1.
 */
const BASE="https://deep-cuts-edh.pages.dev";
const routes=[
 "/api/daily-games?action=state&game=cold",
 "/api/daily-games?action=state&game=ladder"
];
async function prepare(){
 const outcomes=[];
 for(const path of routes){
  const url=BASE+path;
  const response=await fetch(url,{
   method:"GET",headers:{"Accept":"application/json","Cache-Control":"no-cache"},
   redirect:"error"
  });
  if(!response.ok)throw Error("Daily puzzle prewarm failed: "+response.status+" "+path);
  const result=await response.json();
  if(!result.day||!result.game||!result.snapshot)throw Error("Puzzle snapshot response incomplete: "+path);
  outcomes.push({game:result.game,day:result.day,sourceDate:result.snapshot,ready:true});
 }
 console.log("Deep Cuts daily puzzles ready",JSON.stringify(outcomes));
 return outcomes;
}
addEventListener("scheduled",event=>{event.waitUntil(prepare())});
addEventListener("fetch",event=>{
 event.respondWith(new Response("Deep Cuts EDH puzzle clock: scheduled prewarm only.",{
  status:200,headers:{"Content-Type":"text/plain;charset=utf-8","Cache-Control":"no-store"}
 }));
});
