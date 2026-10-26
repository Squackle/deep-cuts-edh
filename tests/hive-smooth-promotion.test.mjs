import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {smoothBody,motionPhase} from "../games/hive-run/src/render-motion.js";
import {createCachedBackdrop} from "../games/hive-run/src/level-background.js";
import {newRun,start,step,RULES_VERSION} from "../games/hive-run/src/engine.js";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("lab-based visual motion is common to both Brood Trail and Predator Hunt",()=>{
 const main=read("../games/hive-run/src/main.js");
 const html=read("../games/hive-run/index.html");
 assert.equal(RULES_VERSION,"hive-1.5.4","Preserve production ranked score rules version");
 assert.match(html,/src="\.\/src\/main\.js"/);
 assert.match(main,/import \{smoothBody,motionPhase\} from "\.\/render-motion\.js"/);
 assert.match(main,/const body=run\.status==="running"\?smoothBody\(state\.visualBefore,run\.body/);
 assert.match(main,/paintBackdrop\(context,canvas,arenaBackground,COLS,ROWS,CELLS,run\.biome\)/);
 assert.match(main,/drawConnectedSpine\(body\)/);
 assert.match(main,/drawPlayerLocator\(context,body\[0\],run\.direction/);
 assert.match(main,/drawPlayerLocator\(context,body\[0\],run\.turnQueue/);
 assert.match(main,/const part=body\[i\],next=run\.body\[i\+1\]/);
 assert.match(main,/state\.visualBefore=state\.run\.moves>movesBefore\?bodyBefore:null/);
 assert.match(main,/state\.visualBefore=null/);
 // The shared draw loop is not inside either mode's conditional block.
 const frame=main.slice(main.indexOf("function draw(){"),main.indexOf("function loop(time)"));
 assert.match(frame,/smoothBody/);
 assert.match(frame,/drawCreaturePiece\(part,kind,id,heading\)/);
 assert.doesNotMatch(frame,/if\(run\.mode==="classic"\).*smoothBody/);
 assert.doesNotMatch(frame,/if\(run\.mode==="hunt"\).*smoothBody/);
 const server=read("../src/hive-server/leaderboard.js");
 assert.match(server,/from "\.\.\/\.\.\/games\/hive-run\/src\/engine\.js"/);
 assert.doesNotMatch(server,/render-motion|createCachedBackdrop/,"Server replay remains engine-only");
});
test("smooth motion is mathematically correct, including one-segment orb growth",()=>{
 const before=[{x:6,y:5},{x:5,y:5},{x:4,y:5}],after=[{x:7,y:5},{x:6,y:5},{x:5,y:5},{x:4,y:5}];
 assert.deepEqual(smoothBody(before,after,0),[...before,{x:4,y:5}]);
 assert.deepEqual(smoothBody(before,after,.5),[{x:6.5,y:5},{x:5.5,y:5},{x:4.5,y:5},{x:4,y:5}]);
 assert.equal(smoothBody(before,after,1),after);
 assert.equal(smoothBody(before,after,.5,{enabled:false}),after);
 assert.deepEqual(before,[{x:6,y:5},{x:5,y:5},{x:4,y:5}]);
 assert.equal(motionPhase(60,120),.5);
});
test("safety snaps for teleports, shrinking and bulk growth",()=>{
 const base=[{x:3,y:2},{x:2,y:2}],jump=[{x:12,y:2},{x:2,y:2}];
 assert.equal(smoothBody(base,jump,.5),jump);
 assert.equal(smoothBody(base,[{x:3,y:2}],.5).length,1);
 const twoNew=[{x:4,y:2},{x:3,y:2},{x:2,y:2},{x:1,y:2}];
 assert.equal(smoothBody(base,twoNew,.5),twoNew);
 const wrongTail=[{x:4,y:2},{x:3,y:2},{x:0,y:2}];
 assert.equal(smoothBody(base,wrongTail,.5),wrongTail);
});
test("the same presentation sampler cannot alter either mode's authoritative replay",()=>{
 for(const mode of ["classic","hunt"]){
  const play=newRun({seed:12314,cols:18,rows:22,mode});
  const verify=newRun({seed:12314,cols:18,rows:22,mode});
  start(play);start(verify);
  let sampled=0;
  for(let i=0;i<20;i++){
   const previous=play.body.map(p=>({...p}));
   step(play);
   step(verify);
   smoothBody(previous,play.body,0.4);
   sampled++;
   assert.deepEqual({
    mode:play.mode,body:play.body,score:play.score,moves:play.moves,runTicks:play.runTicks,
    status:play.status,food:play.food,events:play.events,growthDebt:play.growthDebt,
    enemies:play.enemies
   },{
    mode:verify.mode,body:verify.body,score:verify.score,moves:verify.moves,runTicks:verify.runTicks,
    status:verify.status,food:verify.food,events:verify.events,growthDebt:verify.growthDebt,
    enemies:verify.enemies
   },mode+" authoritative state differs after rendering");
   if(play.status!=="running")break;
  }
  assert.ok(sampled>=1,"Engine must make at least one sample in "+mode);
 }
});
test("orb pickup and delayed next-tick growth no longer causes a full-body snap",()=>{
 const run=newRun({seed:10,mode:"classic"});
 run.body=[{x:8,y:10},{x:7,y:10},{x:6,y:10}];
 run.direction="right";run.turnQueue=[];run.food={x:9,y:10};start(run);
 const initialLength=run.body.length;
 step(run);
 assert.equal(run.body.length,initialLength);
 assert.equal(run.growthDebt,1);
 const previous=run.body.map(p=>({...p}));
 step(run);
 assert.equal(run.body.length,initialLength+1);
 const rendered=smoothBody(previous,run.body,.5);
 assert.equal(rendered.length,run.body.length);
 assert.equal(rendered[0].x,previous[0].x+.5);
 assert.deepEqual(rendered.at(-1),previous.at(-1));
 assert.deepEqual(run.body.at(-1),previous.at(-1));
});
function graphics(){
 const calls={rect:0,img:0};
 const ctx={save(){},restore(){},fillRect(){calls.rect++},drawImage(){calls.img++},
  createLinearGradient(){return {addColorStop(){}}},set fillStyle(_value){}};
 return {ctx,calls};
}
test("static background is cached across redraws, invalidated on biome changes",()=>{
 const off=graphics(),dest=graphics(),surface={width:360,height:440,getContext(){return off.ctx}};
 const paint=createCachedBackdrop(()=>surface),canvas={width:360,height:440},image={complete:false,naturalWidth:0};
 paint(dest.ctx,canvas,image,18,22,20,1);
 const rects=off.calls.rect;assert.ok(rects>400);
 paint(dest.ctx,canvas,image,18,22,20,1);assert.equal(off.calls.rect,rects);
 assert.equal(dest.calls.img,2);
 paint(dest.ctx,canvas,image,18,22,20,2);assert.ok(off.calls.rect>rects);
});
