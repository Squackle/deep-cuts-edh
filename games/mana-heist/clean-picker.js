/* First-party site presentation only. The promoted Game Lab game runtime
   under ./src/ stays identical to its audited release. This script decorates
   already-rendered vault buttons and forwards picker changes through existing
   tested navigation controls. It does not touch game rules or local saves. */
import {CHAPTERS,GALAXIES,LEVELS} from "./src/levels.js";
const roman=["I","II","III","IV","V","VI","VII","VIII","IX","X"];
const $=id=>document.getElementById(id);
const setup=()=>{
 const select=$("worldSelect"),stages=$("chapterPicker");
 if(!select||!stages)return;
 const list=document.createDocumentFragment();
 for(let i=0;i<CHAPTERS.length;i++){
  const chapter=CHAPTERS[i],item=document.createElement("option");
  item.value=String(i);
  item.textContent="Galaxy "+roman[chapter.galaxy]+" · "+chapter.name+" ("+(chapter.world+1)+"/5)";
  list.append(item);
 }
 select.replaceChildren(list);
 const update=()=>{
  const match=$("worldNumber")?.textContent?.match(/GALAXY\s+([IVX]+)\s+·\s+WORLD\s+(\d+)/i);
  if(!match)return;
  const g=roman.indexOf(match[1].toUpperCase()),n=Number(match[2]);
  if(g<0||n<1||n>5)return;
  const world=g*5+n-1,galaxy=GALAXIES[g];
  select.value=String(world);
  const intro=document.querySelector(".heist-panel .campaign-top .muted");
  if(intro)intro.textContent="Ten galaxies. Five hundred open vaults.";
  $("worldSubtitle").textContent=CHAPTERS[world].subtitle+" · Ten stages";
  $("currentGalaxyLabel").textContent="GALAXY "+roman[g];
  $("currentGalaxyName").textContent=galaxy.name;
  const cards=[...stages.querySelectorAll(".overworld-stage[data-level]")];
  const won=cards.filter(el=>el.classList.contains("finished")).length;
  $("worldProgress").textContent=won+" / "+cards.length;
  const done=Number(($("campaignTotal")?.textContent||"").match(/^\s*(\d+)/)?.[1]||0);
  $("vaultProgressBar").value=Math.min(500,Math.max(0,done));
  for(let i=0;i<cards.length;i++){
   const button=cards[i],level=LEVELS[Number(button.dataset.level)];
   if(!level)continue;
   if(!button.querySelector(".stage-scene")){
    const art=document.createElement("span");
    art.className="stage-scene scene-"+i;
    art.setAttribute("aria-hidden","true");
    button.prepend(art);
   }
   const code=button.querySelector(".stage-code");
   if(code)code.textContent=String(i+1).padStart(2,"0");
   const badge=document.createElement("span");
   const rank=level.rank<=2?"easy":level.rank===3?"medium":"hard";
   badge.className="level-difficulty rank-"+rank;
   badge.textContent=rank.toUpperCase();
   const oldBadge=button.querySelector(".level-difficulty");
   if(oldBadge)oldBadge.replaceWith(badge);
   else button.querySelector(".stage-detail")?.before(badge);
   const details=button.querySelector(".stage-detail");
   if(details)details.textContent=button.classList.contains("finished")?"REPLAY →":"PLAY →";
   button.querySelector(".vault-ratings")?.classList.add("visually-hidden");
  }
 };
 // The game replaces the stage buttons on any world change. Observing only the
 // direct child list avoids recursion when decorating button descendants.
 new MutationObserver(update).observe(stages,{childList:true});
 select.addEventListener("change",()=>{
  const world=Number(select.value);
  if(!Number.isInteger(world)||world<0||world>=CHAPTERS.length)return;
  const galaxy=Math.floor(world/5);
  // Use the original game controllers, not a competing copy of world state.
  document.querySelector('#galaxyPicker [data-galaxy="'+galaxy+'"]')?.click();
  document.querySelector('#worldPips [data-world="'+world+'"]')?.click();
 });
 update();
};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setup,{once:true});
else setup();
