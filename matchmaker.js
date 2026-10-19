import {IDEAS,THEMES,COLORS,selectIdeas} from "./matchmaker-core.js";
const $=id=>document.getElementById(id);
const node=(tag,txt,cls)=>{const el=document.createElement(tag);if(txt!==undefined)el.textContent=String(txt);if(cls)el.className=cls;return el};
const prep=()=>({theme:$("mmTheme").value,color:$("mmColor").value,max:$("mmBudget").value});
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let cardsPromise=null,busy=false,lastSeed=0,lastPreferences={theme:"any",color:"any",max:"any"};
function status(text,failed=false){const box=$("mmStatus");box.textContent=text;box.dataset.error=failed?"true":"false"}
function cardArt(url){
 try{const u=new URL(url);if(u.protocol==="https:"&&(u.hostname==="cards.scryfall.io"||u.hostname.endsWith(".scryfall.io")))return u.href}catch{}
 return "";
}
function outbound(href){
 try{const u=new URL(href);if(u.protocol==="https:"&&u.hostname==="scryfall.com")return u.href}catch{}
 return null;
}
async function fetchVerifiedCards(){
 if(!cardsPromise)cardsPromise=(async()=>{
  const r=await fetch("/api/tool-cards",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({names:IDEAS.map(x=>x.name)}),credentials:"same-origin",cache:"no-store"});
  const body=await r.json().catch(()=>null);
  if(!r.ok||!Array.isArray(body?.cards))throw Error(body?.error||"Card verification is temporarily unavailable. Try again shortly.");
  return body.cards;
 })().catch(error=>{cardsPromise=null;throw error});
 return cardsPromise;
}
function profileLink(name){
 const a=node("a","RESEARCH THIS COMMANDER ↗","mm-link");
 a.href="/deep-cut-finder?commander="+encodeURIComponent(name);
 return a;
}
function resultCard(pick,index){
 const {card}=pick;
 const item=node("article",undefined,"mm-card");
 const art=node("div",undefined,"mm-card-art");
 const img=cardArt(card.image);
 if(img){const picture=node("img");picture.src=img;picture.alt=card.name+" card illustration";picture.loading="lazy";picture.decoding="async";art.append(picture)}
 else art.append(node("span","CARD ART UNAVAILABLE","mm-no-art"));
 const info=node("div",undefined,"mm-card-info");
 const line=node("div",undefined,"mm-card-meta");
 line.append(node("span",String(index+1).padStart(2,"0")+" / COMMANDER LEAD"));
 line.append(node("span",(card.color_identity?.length?card.color_identity.join(" · "):"COLORLESS")+" IDENTITY"));
 const title=node("h3",card.name);
 const theme=node("p",pick.playstyle,"mm-card-theme");
 const why=node("p",pick.why,"mm-card-why");
 const footer=node("div",undefined,"mm-card-tags");
 footer.append(node("span",THEMES[pick.theme]||pick.theme));
 if(card.prices?.usd!=null&&Number.isFinite(Number(card.prices.usd)))footer.append(node("span","Card from $"+Number(card.prices.usd).toFixed(2)+"*"));
 info.append(line,title,theme,why,footer);
 const buttons=node("div",undefined,"mm-card-links");
 buttons.append(profileLink(card.name));
 const scryfall=outbound(card.scryfall_uri);
 if(scryfall){const a=node("a","CHECK CARD ↗","mm-link mm-muted");a.href=scryfall;a.target="_blank";a.rel="noopener noreferrer";buttons.append(a)}
 info.append(buttons);item.append(art,info);return item;
}
function resultURL(prefs,seed){
 const url=new URL("/matchmaker",location.origin);
 for(const [key,value] of Object.entries(prefs))if(value!=="any")url.searchParams.set(key,value);
 url.searchParams.set("seed",String(seed>>>0));
 return url.href;
}
async function find(prefs,seed){
 if(busy)return;
 busy=true;
 $("mmMatch").disabled=$("mmSurprise").disabled=$("mmShuffle").disabled=true;
 $("mmResultActions").hidden=true;$("mmResults").replaceChildren();
 status("Checking the archive against current Commander card data…");
 try{
  const cards=await fetchVerifiedCards();
  const picks=selectIdeas(cards,prefs,seed,5);
  if(!picks.length){
   status("No verified Commanders matched these filters. Try any colors, a higher commander-card price, or another strategy.",true);
   return;
  }
  const frag=document.createDocumentFragment();
  for(let i=0;i<picks.length;i++)frag.append(resultCard(picks[i],i));
  $("mmResults").append(frag);
  $("mmResultActions").hidden=false;
  lastSeed=seed;lastPreferences={...prefs};
  status(picks.length+" verified Commander "+(picks.length===1?"idea":"ideas")+" from the Deep Cuts archive. "+(picks.length<5?"Widen your filters to see more.":"Pick one and open its research file."));
  history.replaceState(null,"",new URL(resultURL(prefs,seed)).pathname+new URL(resultURL(prefs,seed)).search);
 }catch(error){status(error?.message||"Sorry, card verification is unavailable.",true)}
 finally{busy=false;$("mmMatch").disabled=$("mmSurprise").disabled=$("mmShuffle").disabled=false}
}
$("mmForm").addEventListener("submit",event=>{event.preventDefault();find(prep(),freshSeed())});
$("mmSurprise").addEventListener("click",()=>{for(const id of ["mmTheme","mmColor","mmBudget"])$(id).value="any";find(prep(),freshSeed())});
$("mmShuffle").addEventListener("click",()=>find(prep(),freshSeed()));
$("mmReset").addEventListener("click",()=>{for(const id of ["mmTheme","mmColor","mmBudget"])$(id).value="any";history.replaceState(null,"","/matchmaker");status("Ready to discover something new.");$("mmResults").replaceChildren();$("mmResultActions").hidden=true});
$("mmCopy").addEventListener("click",async()=>{
 const link=resultURL(lastPreferences,lastSeed);
 try{await navigator.clipboard.writeText(link);status("Discovery link copied. Share it with another brewer.")}catch{
  const input=node("input");input.value=link;input.readOnly=true;
  const original=$("mmStatus");original.replaceChildren(node("span","Copy this link: "),input);input.select();
 }
});
const initial=new URLSearchParams(location.search);
const theme=initial.get("theme"),color=initial.get("color"),max=initial.get("max"),seed=initial.get("seed");
if(theme&&Object.hasOwn(THEMES,theme))$("mmTheme").value=theme;
if(color&&Object.hasOwn(COLORS,color))$("mmColor").value=color;
if(["5","15"].includes(max))$("mmBudget").value=max;
if(seed&&/^\d{1,10}$/.test(seed)&&Number(seed)<=4294967295)find(prep(),Number(seed));
