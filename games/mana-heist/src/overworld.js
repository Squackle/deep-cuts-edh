import {LEVELS,CHAPTERS,GALAXIES} from "./levels.js";
import {evaluateVault} from "./difficulty-metrics.js";
const $=id=>document.getElementById(id);
const roman=["I","II","III","IV","V","VI","VII","VIII","IX","X"];
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export function renderOverworld({world,bests,index,proofs,medal}){
 const chapter=CHAPTERS[world];
 if(!chapter)throw Error("Invalid campaign world "+world);
 const galaxy=GALAXIES[chapter.galaxy];
 const totalDone=LEVELS.filter(p=>bests[p.id]).length;
 const worldLevels=LEVELS.slice(chapter.range[0],chapter.range[1]+1);
 const completedWorld=worldLevels.filter(p=>bests[p.id]).length;

 $("worldNumber").textContent="GALAXY "+roman[chapter.galaxy]+" · WORLD "+(chapter.world+1)+" / 5";
 $("worldName").textContent=chapter.name;
 $("worldSubtitle").textContent=chapter.subtitle+" · Ten stages";
 $("previousWorld").disabled=world===0;
 $("nextWorld").disabled=world>=CHAPTERS.length-1;
 $("campaignTotal").textContent=totalDone+" / "+LEVELS.length+" CRACKED";
 $("vaultProgressBar").value=totalDone;
 $("currentGalaxyLabel").textContent="GALAXY "+roman[chapter.galaxy];
 $("currentGalaxyName").textContent=galaxy.name;
 $("worldProgress").textContent=completedWorld+" / "+worldLevels.length;

 const select=$("worldSelect");
 // Reuse the same native dropdown; allow keyboard access to all 50 worlds
 // without filling the page with 60 buttons.
 if(select.options.length!==CHAPTERS.length){
  const fragment=document.createDocumentFragment();
  for(let i=0;i<CHAPTERS.length;i++){
   const item=CHAPTERS[i];
   const option=document.createElement("option");
   option.value=String(i);
   option.textContent="Galaxy "+roman[item.galaxy]+" · "+item.name+" ("+(item.world+1)+"/5)";
   fragment.append(option);
  }
  select.replaceChildren(fragment);
 }
 select.value=String(world);

 // Keep the existing alternate navigation for accessibility and power users,
 // but present it inside a collapsed "Browse galaxies" section.
 const jump=document.querySelector(".vault-jump");
 if(jump){
  jump.replaceChildren();
  for(let i=0;i<GALAXIES.length;i++){
   const button=document.createElement("button");
   button.type="button";
   button.dataset.jumpGalaxy=String(i);
   button.textContent=roman[i]+" · "+GALAXIES[i].name;
   button.setAttribute("aria-label","Jump to Galaxy "+(i+1));
   jump.append(button);
  }
 }
 $("galaxyPicker").innerHTML=GALAXIES.map((g,i)=>{
  const active=i===chapter.galaxy;
  const cleared=LEVELS.slice(g.range[0],g.range[1]+1).filter(p=>bests[p.id]).length;
  return '<button type="button" class="galaxy-tab '+(active?"active":"")+'" data-galaxy="'+i+'" aria-pressed="'+active+'" aria-label="Galaxy '+(i+1)+': '+escapeHTML(g.name)+'">'+
   '<span class="galaxy-symbol">'+["✧","☾","◈","✦","✹","✺","✸","◇","⬡","✷"][i]+'</span>'+
   '<span><b>GALAXY '+roman[i]+'</b><small>'+escapeHTML(g.name)+'</small><em>'+cleared+' / 50</em></span></button>';
 }).join("");

 $("chapterPicker").innerHTML=worldLevels.map((p,off)=>{
  const i=chapter.range[0]+off,win=bests[p.id],rating=evaluateVault(p);
  const optimal=win?proofs.get(p.id):null;
  const stars=win&&optimal?medal(p,{turn:win.turn,spentLife:win.spentLife,actions:win.actions,stage:p.stages.length},optimal):0;
  const current=i===index&&!win;
  const displayCode=String(off+1).padStart(2,"0");
  const rank=p.rank<=2?"EASY":p.rank===3?"MEDIUM":"HARD";
  return '<button class="overworld-stage '+(win?"finished":current?"current":"")+'" type="button" data-level="'+i+'" aria-label="Galaxy '+(chapter.galaxy+1)+', world '+(chapter.world+1)+', level '+(off+1)+': '+escapeHTML(p.title)+'. Estimated '+rank.toLowerCase()+'. '+(win?"Replay":"Play")+'">'+
   '<span class="stage-scene scene-'+off+'" aria-hidden="true"></span>'+
   '<span class="stage-code">'+displayCode+'</span>'+
   '<strong>'+escapeHTML(p.title)+'</strong>'+
   '<span class="level-difficulty rank-'+rank.toLowerCase()+'">'+rank+'</span>'+
   '<span class="stage-detail">'+(win?"REPLAY":"PLAY")+' →</span>'+
   '<span class="visually-hidden">Estimated complexity '+rating.complexity+' of 100 and difficulty '+rating.difficulty+' of 100. '+(win?stars+" stars earned.":"")+'</span>'+
   '</button>';
 }).join("");

 $("worldPips").innerHTML=CHAPTERS.slice(chapter.galaxy*5,chapter.galaxy*5+5).map((act,n)=>{
  const i=chapter.galaxy*5+n,active=i===world;
  return '<button type="button" class="world-pip '+(active?"active":"")+'" data-world="'+i+'" aria-label="World '+(n+1)+'" aria-pressed="'+active+'">'+roman[n]+'</button>';
 }).join("");
 $("mapHint").textContent="All 500 vaults are open. Ratings are estimates, not recorded player success rates.";
}
