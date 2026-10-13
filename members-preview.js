// Public, client-only preview of planned tier tools. Does not call paid APIs, grant access or transmit decks.
import {readDeck} from "./shared.js";
const $=id=>document.getElementById(id);
const mk=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
const levels={
 informant:{name:"The Informant",cost:"$5/mo",intro:"Investigate your own deck and browse curated research.",benefits:["Printable personalized Deck Dossier (heuristic analysis)","Five ten-card alternate-build research packages","Early research notes and in-site classified memo","A themed Field Office and curated supporter showcase"]},
 detective:{name:"The Detective",cost:"$10/mo",intro:"Add evidence-based planning tools and long-term experiments.",benefits:["Everything in Informant","1,500-trial land-only probability model","Compare deck cards with a pasted collection list","40 stored member-version snapshots and comparisons","25-name on-demand card watchlist","Private research question intake (human response)"]},
 chief:{name:"The Chief Investigator",cost:"$25/mo",intro:"Collaborate with the editorial team through human-reviewed requests.",benefits:["Everything in Detective","Quarterly deck consultation REQUEST pathway (subject to scheduling)","Submit co-design ideas for future Rescue Reports","Optional opt-in editorial recognition after approval","Limited-capacity personal editorial collaboration"]}
};
let chosen="informant";
function render(){
 const target=$("previewResults");target.replaceChildren();
 const tier=levels[chosen];target.append(mk("h3",tier.name+" · "+tier.cost),mk("p",tier.intro));
 const list=mk("ul");tier.benefits.forEach(b=>list.append(mk("li",b)));target.append(list);
 target.append(mk("p","These are feature previews. Paid data and editorial requests stay locked until a Ko-fi payment and member identity have been verified.","member-fine"));
 $("previewDossier").hidden=chosen==="chief";$("previewOdds").hidden=chosen!=="detective";
 document.querySelectorAll("[data-preview-tier]").forEach(b=>{b.setAttribute("aria-pressed",String(b.dataset.previewTier===chosen))});
}
document.querySelectorAll("[data-preview-tier]").forEach(b=>b.addEventListener("click",()=>{chosen=b.dataset.previewTier;render()}));
$("previewDossier").addEventListener("click",()=>{
 const out=$("previewDemoOutput");out.replaceChildren();
 try{
  const d=readDeck();if(!d?.commanders?.length||!d?.cards?.length)throw Error("No Workshop deck saved in this browser. Start in the free Deck Workshop.");
  const num=d.cards.reduce((n,c)=>n+(Number(c.qty)||0),d.commanders.length);
  const knownLands=d.cards.filter(c=>/land/i.test(String(c.card?.type_line||""))||/^(plains|island|swamp|mountain|forest|wastes)$/i.test(c.name)).reduce((n,c)=>n+(Number(c.qty)||0),0);
  out.append(mk("h4","LOCAL SAMPLE DOSSIER"),mk("p","Commander(s): "+d.commanders.join(" & ")),mk("p",num+" total cards including commander(s); "+knownLands+" identifiable land cards."));
  out.append(mk("p","This is a private, rough demonstration, not the complete member-only rules/role analysis. Incomplete card metadata can undercount lands. No deck was uploaded."));
 }catch(e){out.append(mk("p",e.message))}
});
$("previewOdds").addEventListener("click",()=>{
 const output=$("previewDemoOutput");output.replaceChildren();
 // 500-trial sample for a hypothetical 99-card library containing 36 lands.
 let keep=0,land5=0;
 for(let n=0;n<500;n++){
  const deck=Array.from({length:99},(_,i)=>i<36?1:0);
  for(let i=98;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
  let lands=0;for(let i=0;i<7;i++)lands+=deck[i];
  if(lands>=2&&lands<=5)keep++;
  if(deck.slice(0,11).reduce((a,b)=>a+b,0)>=5)land5++;
 }
 output.append(mk("h4","PUBLIC SAMPLE · 500 SHUFFLES"),mk("p",Math.round(100*keep/500)+"% of hypothetical opening hands had 2–5 lands."),mk("p",Math.round(100*land5/500)+"% of 11-card samples contained at least five lands."));
 output.append(mk("p","Example: a 99-card library with 36 lands, no mulligans, ramp, color constraints or opponent interaction. This is not a live paid-feature run or win prediction."));
});
render();
