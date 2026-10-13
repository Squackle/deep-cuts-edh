import {$,state,el,clear,msg,badge,button,link,card,empty,api,write,attempt,showComments,setTab} from "./community.js";
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
 n.append(el("h3",r.deck.title),el("p",r.deck.commander+" · @"+r.deck.handle+" · version "+r.deck.version));
 const raw=r.deck.content,pre=el("pre","COMMANDER\n"+raw.commanders.map(s=>"1 "+s).join("\n")+"\n\nMAINBOARD\n"+raw.cards.map(c=>c.qty+" "+c.name).join("\n"),"cm-decklist");n.append(pre);
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
async function loadChallenge(){
 const x=await attempt(()=>api("challenge"));if(!x)return;
 const box=$("challengeInfo");clear(box);
 if(!x.challenge){box.append(el("p","No challenge scheduled yet."));return}
 const ch=x.challenge,open=new Date(ch.closes_at.replace(" ","T")+"Z").getTime()>=Date.now();
 box.append(el("h3",ch.title),el("p","Featured commander: "+ch.commander),el("p",open?"Submissions close "+ch.closes_at+" UTC":"Challenge closed "+ch.closes_at+" UTC","cm-note"));
 $("enterChallenge").disabled=!open;const select=$("challengeDeck");clear(select);
 const def=el("option","Select one of your public decks");def.value="";select.append(def);
 await loadMyDecks();
 for(const d of state.myDecks.filter(d=>d.commander.toLowerCase().includes(ch.commander.toLowerCase()))){
  const o=el("option",d.title);o.value=d.id;select.append(o);
 }
 const out=$("challengeEntries");clear(out);
 if(!x.entries.length)empty(out,"No entrants yet. Can you make the first rescue?");
 for(const entry of x.entries){
  const n=card(entry.title,entry.commander,"@"+entry.handle+" · "+entry.votes+" votes");
  n.append(button("SEE BUILD ↗",()=>openDeck(entry.deck_id),true));
  if(open)n.append(button("VOTE FOR THIS BUILD",async()=>{const r=await attempt(()=>write({action:"vote",deck_id:entry.deck_id}),"Vote saved.");if(r)loadChallenge()}));
  out.append(n);
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
 $("enterChallenge").addEventListener("click",async()=>{const id=$("challengeDeck").value;if(!id)return msg("Select an eligible published deck.",true);
  const r=await attempt(()=>write({action:"challenge_entry",deck_id:id}),"Challenge entry submitted.");if(r)loadChallenge();
 });
 $("checkLab").addEventListener("click",loadLab);
 $("playtestForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;
  const d={action:"playtest",commander:f.elements.commander.value,opponent:f.elements.opponent.value,result:f.elements.result.value,turns:Number(f.elements.turns.value),note:f.elements.note.value};
  const r=await attempt(()=>write(d),"Game report filed. Results remain self-reported.");if(r){$("labCommander").value=d.commander;f.reset();loadLab()}
 });
 $("scanGems").addEventListener("click",scanGems);
}
