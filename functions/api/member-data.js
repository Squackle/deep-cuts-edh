import {reply,random,sha,originOK,authorize,json,tierPower} from "../../src/member-auth.js";
const own=(req)=>new URL(req.url).searchParams;
function validDeck(raw){
 if(!raw||!Array.isArray(raw.commanders)||!Array.isArray(raw.cards)||raw.commanders.length<1||raw.commanders.length>2||raw.cards.length>250)return null;
 const cards=raw.cards.map(x=>({name:String(x?.name||"").trim(),qty:Number(x?.qty)}));
 if(cards.some(x=>x.name.length<2||x.name.length>130||!Number.isInteger(x.qty)||x.qty<1||x.qty>250)||cards.reduce((n,c)=>n+c.qty,0)>250)return null;
 const commanders=raw.commanders.map(x=>String(x).trim());
 if(commanders.some(x=>x.length<2||x.length>130))return null;
 return {commanders,cards,targetBracket:Math.max(1,Math.min(5,Number(raw.targetBracket)||2))};
}
const editorial={
 newsletter:[{date:"October 2026",title:"The First Classified Memo",intro:"The strongest Commander deck doesn't always start with the strongest commander.",sections:[
 {title:"Case clue · Mustard",text:"Count Soldier bodies first, pump effects second. Attack triggers reward width more than individual size."},
 {title:"Case clue · Alena & Gilanra",text:"A newly entered high-power creature is a mana investment, not merely a threat. Don't forget haste for Alena."},
 {title:"Case clue · Chainer",text:"Build sacrifice outlets into the reanimation package. Your reanimated Nightmare creatures disappear if Chainer leaves."}]}],
 alternates:[
 {commander:"Commander Mustard",name:"Budget Barracks",angle:"Make low-cost Soldiers and tokens the engine; favor Raise the Alarm, Ballyrush Banneret, Resolute Reinforcements and Call the Coppercoats over expensive lords.",focus:"Budget-focused starter package; market prices unverified.",cards:["Ballyrush Banneret","Resolute Reinforcements","Raise the Alarm","Captain's Call","Call the Coppercoats","Deploy to the Front","Valiant Veteran","Swords to Plowshares","Boros Charm","Shared Animosity"]},
 {commander:"Commander Mustard",name:"Damage Without Blocks",angle:"Use Warleader's Call, Impact Tremors and shared attack-ping triggers so Soldiers contribute before combat damage.",focus:"Aggressive ten-card package, not a complete 100-card deck.",cards:["Warleader's Call","Impact Tremors","Shared Animosity","Myrel, Shield of Argive","Siege Veteran","Captain of the Watch","Call the Coppercoats","Grand Crescendo","Herald's Horn","Ballyrush Banneret"]},
 {commander:"Alena, Kessig Trapper + Gilanra, Caller of Wirewood",name:"Power on Entry",angle:"Use Lupine Prototype, Phyrexian Soulgorger and Hunted Troll as burst-mana starters. Prioritize early protection and untaps for Alena.",focus:"Power-to-mana ten-card core; no market-price estimate.",cards:["Lupine Prototype","Phyrexian Soulgorger","Hunted Troll","Thousand-Year Elixir","Rhythm of the Wild","Elemental Bond","Garruk's Uprising","Rishkar's Expertise","Kessig Wolf Run","Titan of Industry"]},
 {commander:"Chainer, Dementia Master",name:"Sacrifice Evidence",angle:"Lean into instant-speed sacrifice outlets to preserve value before Chainer leaves and to control your graveyard recursion.",focus:"Ten-card sacrifice research core; verify individual prices.",cards:["Viscera Seer","Ashnod's Altar","Altar of Dementia","Fleshbag Marauder","Plaguecrafter","Grave Pact","Dictate of Erebos","Pitiless Plunderer","Syr Konrad, the Grim","Reanimate"]},
 {commander:"Ekthi, Contaminator Priest",name:"Equipment Hatchery",angle:"Try Colossus Hammer, Skullclamp, and Bloodforged Battle-Axe to turn living weapon into efficient material and card draw.",focus:"Pre-release Equipment package; verify Ekthi's legality before play.",cards:["Colossus Hammer","Skullclamp","Bloodforged Battle-Axe","Sram, Senior Edificer","Puresteel Paladin","Ardenn, Intrepid Archaeologist","Leonin Shikari","Brass Squire","Loran's Escape","Sword of the Animist"]}
 ],
 early:[{title:"Research preview · Celestial Kirin",text:"A working case hypothesis: Celestial Kirin turns Spirit and Arcane spells into destruction tied to the cast spell’s mana value. A deck built around matching values could control specific board states while preserving its own engines. This is an unpublished research note, not a dated report or a tested 100-card list."}],
};
const categories={showcase:"informant",question:"detective",consultation:"chief",editorial:"chief",credit:"chief"};
export async function onRequestGet({request,env}){
 const action=own(request).get("action")||"overview";
 const tier=["versions","watches","questions"].includes(action)?"detective":"informant";
 const a=await authorize(request,env,tier);if(a.error)return a.error;
 const member=a.account.id;
 try{
  if(action==="overview"){
   const requests=await env.DB.prepare("SELECT id,category,status,staff_reply,created_at FROM member_requests WHERE member_id=? ORDER BY created_at DESC LIMIT 20").bind(member).all();
   return reply({ok:true,tier:a.account.tier,requests:requests.results||[],newsletter:editorial.newsletter,alternates:editorial.alternates,early:editorial.early});
  }
  if(action==="versions"){
   const rows=await env.DB.prepare("SELECT id,title,created_at,content FROM member_versions WHERE member_id=? ORDER BY created_at DESC LIMIT 40").bind(member).all();
   return reply({ok:true,versions:(rows.results||[]).map(r=>({id:r.id,title:r.title,created_at:r.created_at,deck:JSON.parse(r.content)}))});
  }
  if(action==="watches"){
   const rows=await env.DB.prepare("SELECT name,created_at,last_seen FROM member_watches WHERE member_id=? ORDER BY created_at DESC LIMIT 25").bind(member).all();
   return reply({ok:true,watches:rows.results||[],notice:"Watchlist tracking is on-demand. Automatic push notifications aren't configured yet."});
  }
  if(action==="showcase"){
   const rows=await env.DB.prepare("SELECT content,created_at FROM member_requests WHERE category='showcase' AND status='approved' ORDER BY created_at DESC LIMIT 20").all();
   return reply({ok:true,showcase:(rows.results||[]).map(r=>({content:String(r.content).slice(0,1000),createdAt:r.created_at}))});
  }
  return reply({error:"Unknown collection."},400);
 }catch(e){console.error("Premium data read",e);return reply({error:"Couldn't retrieve premium data."},503)}
}
export async function onRequestPost({request,env}){
 if(!originOK(request))return reply({error:"Origin rejected."},403);
 let d;try{d=await json(request,37000)}catch{return reply({error:"Request is invalid or too large."},400)}
 const action=String(d.action||"");
 const minTier=["version","watch","unwatch","scan"].includes(action)?"detective":categories[action==="request"?String(d.category||""):""]||"informant";
 const a=await authorize(request,env,minTier);if(a.error)return a.error;
 const member=a.account.id;
 try{
  if(action==="version"){
   const deck=validDeck(d.deck);if(!deck)return reply({error:"Enter a valid Commander deck first."},400);
   const title=String(d.title||deck.commanders.join(" + ")).trim().slice(0,80)||"Untitled deck";
   const id=random(16);
   await env.DB.prepare("INSERT INTO member_versions(id,member_id,title,content) VALUES(?,?,?,?)").bind(id,member,title,JSON.stringify(deck)).run();
   await env.DB.prepare("DELETE FROM member_versions WHERE member_id=? AND id NOT IN (SELECT id FROM member_versions WHERE member_id=? ORDER BY created_at DESC, rowid DESC LIMIT 40)").bind(member,member).run();
   return reply({ok:true,id},201);
  }
  if(action==="watch"){
   const name=String(d.name||"").trim();
   if(name.length<3||name.length>125)return reply({error:"Enter a Commander or card name (3–125 characters)."},400);
   const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM member_watches WHERE member_id=?").bind(member).first();
   if(Number(count?.n||0)>=25)return reply({error:"Watchlist limit: 25 cards or commanders."},429);
   await env.DB.prepare("INSERT OR IGNORE INTO member_watches(member_id,name) VALUES(?,?)").bind(member,name).run();
   return reply({ok:true});
  }
  if(action==="unwatch"){
   const name=String(d.name||"").trim();
   await env.DB.prepare("DELETE FROM member_watches WHERE member_id=? AND name=?").bind(member,name).run();
   return reply({ok:true});
  }
  if(action==="scan"){
   // On-demand check only; no claims of automatic push notifications.
   const now=Math.floor(Date.now()/1000);
   const gate=await env.DB.prepare("UPDATE member_accounts SET last_scan=? WHERE id=? AND last_scan<=? RETURNING last_scan").bind(now,member,now-7200).first();
   if(!gate)return reply({error:"You can check watched cards once every two hours."},429);
   const rows=await env.DB.prepare("SELECT name,last_seen FROM member_watches WHERE member_id=? ORDER BY CASE WHEN json_valid(last_seen) THEN COALESCE(CAST(json_extract(last_seen,'$.checked') AS INTEGER),0) ELSE 0 END ASC,created_at ASC LIMIT 8").bind(member).all();
   const findings=[];let checked=0;
   for(const w of rows.results||[]){
    try{
     const response=await fetch("https://api.scryfall.com/cards/named?exact="+encodeURIComponent(w.name),{headers:{"Accept":"application/json","User-Agent":"DeepCutsEDH/1.5 (+https://deep-cuts-edh.pages.dev)"},signal:AbortSignal.timeout(6500)});
     if(!response.ok){findings.push({name:w.name,note:"No exact Scryfall match."});continue}
     const card=await response.json();
     const usd=Number(card.prices?.usd||0),oracle=String(card.oracle_text||card.card_faces?.map(f=>f.oracle_text).join(" ")||"");
     const next={usd,oracleHash:await sha(oracle),checked:now};
     let old=null;try{old=JSON.parse(w.last_seen)}catch{}
     if(old){
      const delta=usd-Number(old.usd||0),threshold=Math.max(.25,Number(old.usd||0)*.1);
      if(usd>0&&Number(old.usd||0)>0&&Math.abs(delta)>=threshold)findings.push({name:w.name,note:"Tracked USD card estimate changed from $"+Number(old.usd).toFixed(2)+" to $"+usd.toFixed(2)+". Prices depend on printing."});
      if(old.oracleHash&&next.oracleHash!==old.oracleHash)findings.push({name:w.name,note:"Current oracle text differs from the last check; review the official card."});
     }
     await env.DB.prepare("UPDATE member_watches SET last_seen=? WHERE member_id=? AND name=?").bind(JSON.stringify(next),member,w.name).run();
     checked++;
    }catch(e){console.error("Watch lookup failed",String(e));findings.push({name:w.name,note:"Couldn't check this card right now."})}
   }
   return reply({ok:true,checked,findings,notice:"On-demand Scryfall snapshot comparison only (up to eight cards per check). No automatic notifications or guaranteed market prices."});
  }
  if(action==="request"){
   const category=String(d.category||"");
   if(!categories[category])return reply({error:"Unknown request category."},400);
   if(tierPower[a.account.tier]<tierPower[categories[category]])return reply({error:"This request needs a higher membership tier."},403);
   const content=String(d.content||"").trim();
   if(content.length<20||content.length>1600)return reply({error:"Request must be 20–1600 characters."},400);
   const interval=category==="consultation"?7776000:2592000;
   const cap=category==="consultation"?1:category==="editorial"?1:2;
   const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM member_requests WHERE member_id=? AND category=? AND created_at>unixepoch()-?").bind(member,category,interval).first();
   if(Number(row?.n||0)>=cap)return reply({error:"You've reached this request type's current submission allowance."},429);
   const id=random(16);
   await env.DB.prepare("INSERT INTO member_requests(id,member_id,category,content) VALUES(?,?,?,?)").bind(id,member,category,content).run();
   return reply({ok:true,id,message:"Submitted for editorial review; publication or personal response is not automatic."},201);
  }
  return reply({error:"Unknown action."},400);
 }catch(e){console.error("Premium data write",e);return reply({error:"Unable to save premium information."},503)}
}
