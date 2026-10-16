import {$,state,el,clear,msg,badge,button,link,card,empty,api,write,attempt,showComments,setTab,appendProfileMentions} from "./community.js";
import {normalizeDeckSourceUrl} from "./src/challenge-source-url.js";
function cardsFromInput(text){
 const rows=text.trim().split(/\r?\n/).filter(Boolean).map(line=>{const m=/^(\d+)\s+(.+)$/.exec(line.trim());return m?{qty:Number(m[1]),name:m[2].trim()}:null});
 if(!rows.length||rows.some(x=>!x||!x.name))throw Error("Use one quantity and card name per line (e.g. 1 Sol Ring).");
 return rows;
}
function collectDeck(form){
 return {commanders:form.elements.commanders.value.trim().split(/\r?\n/).map(x=>x.trim()).filter(Boolean),cards:cardsFromInput(form.elements.cards.value),targetBracket:2};
}
function fillForm(deck,title){
 const f=$("deckForm");f.elements.title.value=title||"Untitled field build";
 f.elements.commanders.value=deck.commanders.join("\n");
 f.elements.cards.value=deck.cards.map(c=>c.qty+" "+c.name).join("\n");
}
function exportDeckSnapshot(deck){
 const raw=deck.content;
 const lines=["COMMANDER",...raw.commanders.map(name=>"1 "+name),"","MAINBOARD",...raw.cards.map(c=>c.qty+" "+c.name)];
 const url=normalizeDeckSourceUrl(raw.sourceUrl);if(url)lines.push("","SOURCE "+url);
 const blob=new Blob([lines.join("\n")+"\n"],{type:"text/plain;charset=utf-8"});
 const objectUrl=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=objectUrl;a.download=(deck.title||"deep-cuts-deck").replace(/[^a-z0-9_-]+/gi,"-").slice(0,70)+".txt";
 document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
}
function importWorkshop(){
 try{
  const raw=localStorage.getItem("deepcuts-deck-v1");
  if(!raw)throw Error("No local Workshop deck found. Open the Workshop and save a deck first.");
  const d=JSON.parse(raw);
  if(!Array.isArray(d.commanders)||!Array.isArray(d.cards)||!d.cards.length)throw Error("The Workshop deck is empty. Add cards first.");
  fillForm(d,d.commanders[0]+" — Field Build");state.editing="";$("saveDeck").textContent="PUBLISH NEW DECK ↗";
  msg("Local Workshop list imported into the editor. Nothing was published yet.");$("deckForm").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(e){msg(e.message,true)}
}
async function loadMyDecks(){
 state.myDecks=[];if(!state.me)return;
 const r=await attempt(()=>api("profile",{handle:state.me.handle}));
 if(r)state.myDecks=r.decks;
}
export async function openDeck(id){
 const r=await attempt(()=>api("deck",{id}));if(!r)return;
 state.deck=r.deck;
 setTab("decks");history.replaceState(null,"",location.pathname+"?deck="+id);
 const section=$("deckDetail");section.hidden=false;
 const n=$("deckInfo");clear(n);
 n.append(el("h3",r.deck.title),appendProfileMentions(el("p"),r.deck.commander+" · @"+r.deck.handle+" · version "+r.deck.version));
 const raw=r.deck.content,pre=el("pre","COMMANDER\n"+raw.commanders.map(s=>"1 "+s).join("\n")+"\n\nMAINBOARD\n"+raw.cards.map(c=>c.qty+" "+c.name).join("\n"),"cm-decklist");n.append(pre);
 const source=normalizeDeckSourceUrl(raw.sourceUrl);
 if(source){const a=link("VIEW ORIGINAL DECK SOURCE ↗",source);a.target="_blank";a.rel="noopener noreferrer";n.append(a)}
 n.append(button("EXPORT DECK SNAPSHOT ↧",()=>exportDeckSnapshot(r.deck),true));
 if(state.me?.id===r.deck.owner_id){
  n.append(button("EDIT NEW VERSION",()=>{state.editing=r.deck.id;fillForm(raw,r.deck.title);$("saveDeck").textContent="SAVE NEW VERSION ↗";$("deckForm").elements.title.disabled=true;$("deckForm").scrollIntoView({block:"start",behavior:"smooth"})}));
  n.append(button("DELETE PUBLIC DECK",async()=>{if(!confirm("Permanently delete this public deck, its history and discussion?"))return;const x=await attempt(()=>write({action:"delete_deck",id:r.deck.id}));if(x){section.hidden=true;state.deck=null;loadGallery()}},true));
 }
 const ver=$("deckVersions");clear(ver);ver.append(el("h3","EVOLUTION HISTORY"));
 r.versions.forEach(v=>{
  const item=card("VERSION "+v.version,v.note||"No revision note",v.created_at);
  item.append(button("COMPARE TO CURRENT",async()=>{
   const past=await attempt(()=>api("version",{id:r.deck.id,version:v.version}));if(!past)return;
   const oldMap=new Map(past.deck.cards.map(c=>[c.name,c.qty]));
   const nowMap=new Map(r.deck.content.cards.map(c=>[c.name,c.qty]));
   const all=new Set([...oldMap.keys(),...nowMap.keys()]);const changes=[];
   all.forEach(name=>{const delta=(nowMap.get(name)||0)-(oldMap.get(name)||0);if(delta)changes.push((delta>0?"+":"")+delta+" "+name)});
   item.append(el("pre",changes.join("\n")||"No mainboard changes between these versions.","cm-decklist"));
  },true));ver.append(item);
 });
 await showComments($("deckComments"),"deck:"+r.deck.id);
 section.scrollIntoView({block:"start",behavior:"smooth"});
}
window.DeepCutsOpenDeck=openDeck;
async function loadGallery(){
 const x=await attempt(()=>api("decks"));if(!x)return;const dest=$("deckGallery");clear(dest);
 if(!x.decks.length)empty(dest,"No public decks yet. Publish the first field build.");
 for(const d of x.decks){
  const n=card(d.title,d.commander,"@"+d.handle+" · v"+d.version+" · "+d.comments+" comments");
  n.append(button("OPEN DECK / DECK DOCTOR ↗",()=>openDeck(d.id)));dest.append(n);
 }
 await loadMyDecks();
}
let selectedChallenge="";
let challengeRecord=null;
let currentEligibility=false;
function isEligible(ch,deck){
 if(ch.format==="open")return true;
 return deck.commander.trim().toLowerCase()===ch.commander.trim().toLowerCase();
}
function isPreviewCommander(name){return /nephilim epochal|ekthi, contaminator priest/i.test(name)}
function formatDeckName(deck){
 const preview=isPreviewCommander(deck.commander)?" · PRE-RELEASE / EXPERIMENTAL":"";
 return deck.title+" — "+deck.commander+preview;
}
function updateEligibility(){
 const picker=$("challengeDeck"),info=$("challengeEligibility"),id=picker.value;
 const deck=state.myDecks.find(x=>x.id===id),ch=challengeRecord;
 const now=new Date().toISOString().slice(0,19).replace("T"," ");
 const active=!!ch&&now>=ch.opens_at&&now<=ch.closes_at;
 currentEligibility=!!deck&&!!ch&&isEligible(ch,deck)&&active;
 $("enterChallenge").disabled=!currentEligibility;
 if(!state.me)info.textContent="Sign in with your Community profile to see your decks and submit an entry.";
 else if(!state.myDecks.length)info.textContent="You have no published community decks yet. Publish one in the Deck Gallery first; private vaults aren't public entries.";
 else if(!deck)info.textContent="All "+state.myDecks.length+" public decks are listed. Choose one to check whether it qualifies for this challenge.";
 else if(!active)info.textContent="This event is closed, but your deck remains in the gallery.";
 else if(!isEligible(ch,deck))info.textContent='"'+deck.title+'" is saved to your profile, but the Featured Case challenge requires exactly '+ch.commander+' as the sole commander. Choose Open Build for other commanders.';
 else if(isPreviewCommander(deck.commander))info.textContent='"'+deck.title+'" is eligible for this experimental Open Case showcase. IMPORTANT: '+deck.commander+' is a pre-release preview, NOT currently Commander-legal; entry is for discussion and future brewing only.';
 else info.textContent='"'+deck.title+'" qualifies. Choose ENTER CHALLENGE to submit it (nothing is entered automatically).';
 info.className="cm-challenge-notice"+(currentEligibility?" cm-eligible":deck?" cm-ineligible":"");
}
async function loadChallenge(){
 const list=await attempt(()=>api("challenges"));if(!list)return;
 const picker=$("challengeSelect");
 const prev=selectedChallenge||new URL(location.href).searchParams.get("challenge")||"open-001";
 clear(picker);
 const activeList=list.challenges||[];
 if(!activeList.length){$("challengeInfo").textContent="No challenges are scheduled.";return}
 for(const ch of activeList){
  const o=el("option",ch.title+" ("+(ch.format==="open"?"open format":"featured commander")+")");
  o.value=ch.id;picker.append(o);
 }
 selectedChallenge=activeList.some(x=>x.id===prev)?prev:activeList[0].id;
 picker.value=selectedChallenge;
 await loadChallengeDetail();
}
async function loadChallengeDetail(){
 const x=await attempt(()=>api("challenge",{id:selectedChallenge}));if(!x)return;
 challengeRecord=x.challenge;
 const box=$("challengeInfo");clear(box);
 if(!x.challenge){box.append(el("p","No challenge scheduled."));return}
 const ch=x.challenge,now=new Date().toISOString().slice(0,19).replace("T"," ");
 const open=now>=ch.opens_at&&now<=ch.closes_at;
 box.append(el("h3",ch.title),el("p",ch.format==="open"?"OPEN BUILD: Any published Commander deck may enter, including clearly labeled experimental builds.":"FEATURED CASE: Only decks whose sole commander is "+ch.commander+" may enter. The featured case follows the homepage rescue report."));
 box.append(el("p",(open?"Entries and votes close ":"Challenge closed ")+ch.closes_at+" UTC","cm-note"));
 if(ch.format==="open")box.append(el("p","This is a community creativity showcase, not a tournament or Commander-legality certification.","cm-note"));
 const select=$("challengeDeck"),previous=select.value;clear(select);
 const defaultOption=el("option","Select a published deck");defaultOption.value="";select.append(defaultOption);
 await loadMyDecks();
 for(const deck of state.myDecks){
  const ok=isEligible(ch,deck);const option=el("option",formatDeckName(deck)+(ok?"":" · NOT ELIGIBLE FOR THIS EVENT"));
  option.value=deck.id;select.append(option);
 }
 select.value=state.myDecks.some(d=>d.id===previous)?previous:"";
 updateEligibility();
 const entries=$("challengeEntries");clear(entries);
 if(!x.entries.length)empty(entries,"No entrants yet. You could be the first.");
 const topVotes=Number(x.entries[0]?.votes||0);
 const topVoted=!open&&now>ch.closes_at&&topVotes>0&&x.entries.filter(e=>Number(e.votes)===topVotes).length===1?x.entries[0].deck_id:null;
 for(const entry of x.entries){
  const preview=isPreviewCommander(entry.commander);
  const n=card(entry.title,entry.commander+(preview?" · PRE-RELEASE: showcase entry, not Commander-legal":""),
   "@"+entry.handle+" · "+entry.votes+" community votes");
  if(topVoted===entry.deck_id){n.classList.add("cm-challenge-winner");n.prepend(el("span","🏆 MOST-VOTED BUILD","cm-top-vote-label"))}
  n.append(button("SEE BUILD ↗",()=>openDeck(entry.deck_id),true));
  if(open)n.append(button("VOTE FOR THIS BUILD",async()=>{
   const r=await attempt(()=>write({action:"vote",challenge_id:ch.id,deck_id:entry.deck_id}),"Vote saved for this challenge.");
   if(r)loadChallengeDetail();
  }));
  entries.append(n);
 }
}

async function loadLab(){
 const commander=$("labCommander").value.trim();if(commander.length<3){msg("Enter a commander.",true);return}
 const x=await attempt(()=>api("tests",{commander}));if(!x)return;
 const out=$("labResults");clear(out);out.append(el("h3","FIELD EVIDENCE · "+commander));
 const s=x.summary||{games:0,wins:0,losses:0};
 const total=Number(s.games||0);
 out.append(badge(total+" reported game"+(total===1?"":"s")),badge("Wins: "+Number(s.wins||0)),badge("Losses: "+Number(s.losses||0)));
 if(total>=10)out.append(el("p","Observed submitted-game win rate: "+Math.round(100*Number(s.wins||0)/total)+"% (self-reported; selection bias likely)."));
 else out.append(el("p","Insufficient sample to display a win-rate estimate. At least 10 submitted games required.","cm-note"));
 if(x.matches?.length){
  out.append(el("h3","OPPOSING STRATEGIES"));for(const m of x.matches)out.append(card(m.opponent,Number(m.wins||0)+" wins in "+m.games+" logged games","Self-reported matchup"));
 }
 if(x.logs?.length){out.append(el("h3","RECENT FIELD REPORTS"));
  x.logs.forEach(v=>out.append(card("@"+v.handle+" · "+v.result+" in "+v.turns+" turns",v.note||"No additional notes",v.opponent+" · "+v.created_at)))}
}
async function scanGems(){
 const dest=$("gemResults");empty(dest,"Searching Scryfall for less commonly played cards…");
 const term=$("gemTheme").value;
 const query='f:commander game:paper -type:basic oracle:"'+term+'"';
 try{
  const url="https://api.scryfall.com/cards/search?q="+encodeURIComponent(query)+"&order=edhrec&dir=desc&unique=cards";
  const r=await fetch(url);
  if(!r.ok)throw Error("No results returned. Try a different mechanic.");
  const data=await r.json();clear(dest);
  const seen=(data.data||[]).slice(0,8);
  if(!seen.length)return empty(dest,"No matching cards.");
  for(const c of seen){const n=card(c.name,c.type_line||"","Scryfall exploratory result");
   n.append(link("VIEW CARD ON SCRYFALL ↗",c.scryfall_uri));dest.append(n)}
  msg("Scanner results are leads for manual review, not proof of synergy or low play rate.");
 }catch(e){empty(dest,"Card search unavailable: "+e.message)}
}
export async function refreshFeatures(tab){
 if(tab==="decks")loadGallery();
 if(tab==="challenge")loadChallenge();
 if(tab==="lab")loadLab();
}
export function setupFeatures(){
 $("fromWorkshop").addEventListener("click",importWorkshop);
 $("resetDeckEditor").addEventListener("click",()=>{
  state.editing="";const f=$("deckForm");f.reset();f.elements.title.disabled=false;$("saveDeck").textContent="PUBLISH NEW DECK ↗";msg("Ready for a new deck.");
 });
 $("deckForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget;
  try{
   const deck=collectDeck(f);
   const req=state.editing?{action:"version",id:state.editing,deck,note:f.elements.note.value}:{action:"publish_deck",title:f.elements.title.value,deck};
   const res=await attempt(()=>write(req),state.editing?"New deck version saved.":"Deck published to the gallery.");
   if(!res)return;
   const id=state.editing||res.id;state.editing="";f.elements.title.disabled=false;$("saveDeck").textContent="PUBLISH NEW DECK ↗";
   await loadGallery();await openDeck(id);
  }catch(err){msg(err.message,true)}
 });
 $("reloadDecks").addEventListener("click",loadGallery);
 $("deckCommentForm").addEventListener("submit",async e=>{e.preventDefault();if(!state.deck)return;const f=e.currentTarget;
  const r=await attempt(()=>write({action:"comment",topic:"deck:"+state.deck.id,kind:"doctor",body:f.elements.body.value}),"Deck Doctor recommendation submitted.");
  if(r){f.reset();showComments($("deckComments"),"deck:"+state.deck.id)}
 });
 $("challengeSubmitForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(!state.me)return msg("Sign in at My Profile before entering a challenge.",true);
  if(!challengeRecord)return msg("Choose an active Rescue Challenge first.",true);
  const f=e.currentTarget;let deck;
  try{deck=collectDeck(f)}catch(err){return msg(err.message,true)}
  const req={action:"challenge_submit",challenge_id:selectedChallenge,title:f.elements.title.value.trim(),deck,sourceUrl:f.elements.sourceUrl.value.trim()};
  const res=await attempt(()=>write(req),"Public deck snapshot saved and entered into the Rescue Challenge.");
  if(res){f.reset();await loadChallengeDetail();$("challengeDeck").value=res.id;updateEligibility()}
 });
 $("challengeSelect").addEventListener("change",e=>{selectedChallenge=e.target.value;loadChallengeDetail()});
 $("challengeDeck").addEventListener("change",updateEligibility);
 $("enterChallenge").addEventListener("click",async()=>{
  const id=$("challengeDeck").value;
  if(!currentEligibility)return msg("Choose a deck eligible for the selected challenge.",true);
  const r=await attempt(()=>write({action:"challenge_entry",challenge_id:selectedChallenge,deck_id:id}),"Entry submitted to "+challengeRecord.title+".");
  if(r)loadChallengeDetail();
 });
 $("checkLab").addEventListener("click",loadLab);
 $("playtestForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;
  const d={action:"playtest",commander:f.elements.commander.value,opponent:f.elements.opponent.value,result:f.elements.result.value,turns:Number(f.elements.turns.value),note:f.elements.note.value};
  const r=await attempt(()=>write(d),"Game report filed. Results remain self-reported.");if(r){$("labCommander").value=d.commander;f.reset();loadLab()}
 });
 $("scanGems").addEventListener("click",scanGems);
}
