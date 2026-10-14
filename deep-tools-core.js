/* Shared deterministic Commander inventory and discovery logic. No API calls or side effects. */
export const key=name=>String(name||"").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g,"");
export const COLORS=["W","U","B","R","G"];
export const CASES={
 "commandermustard":{theme:"Soldier attack triggers and go-wide combat",cards:[
  ["Captain of the Watch","Soldier lord and additional Soldier bodies turn Mustard's team-wide haste and trample into immediate pressure."],
  ["Raise the Alarm","Two Soldiers at instant speed become additional attackers once Mustard is available."],
  ["Mobilization","Repeatable Soldier production keeps Mustard supplied with bodies."],
  ["Daru Warchief","Reduces Soldier costs and strengthens the regiment's combat damage."],
  ["Myrel, Shield of Argive","Creates Soldiers while attacking, adding to the board that Mustard empowers."]]},
 "chainerdementiamaster":{theme:"Repeatable graveyard threats and enter-the-battlefield value",cards:[
  ["Gray Merchant of Asphodel","Reanimating Gray Merchant repeats its life-drain enter-the-battlefield ability."],
  ["Shriekmaw","A repeatable creature removal target for Chainer's graveyard reanimation."],
  ["Fleshbag Marauder","Reanimate to force another round of sacrifice effects."],
  ["Kokusho, the Evening Star","Death triggers reward the recurring sacrifice and reanimation plan."],
  ["Sepulchral Primordial","A major reanimation target that creates further value on entering."]]},
 "alenakessigtrapper":{theme:"Power-based mana and expensive creature payoffs",cards:[
  ["Rishkar's Expertise","Turns high-power creatures into large card draws, aligned with Alena's mana bursts."],
  ["Return of the Wildspeaker","Power-based card draw rewards large creatures after Alena produces mana."],
  ["Great Oak Guardian","Untapping Alena can enable another mana activation if other conditions allow."]]}
};
export function parseCollection(raw){
 if(typeof raw!=="string"||raw.length>260000)throw Error("Import must be under 260 KB.");
 let cells=[],rows=[],buf="",quoted=false;
 for(let i=0;i<raw.length;i++){const ch=raw[i];
  if(ch==='"'){if(quoted&&raw[i+1]==='"'){buf+='"';i++}else quoted=!quoted}
  else if(ch===","&&!quoted){cells.push(buf);buf=""}
  else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&raw[i+1]==="\n")i++;cells.push(buf);if(cells.some(v=>v.trim()))rows.push(cells);cells=[];buf=""}
  else buf+=ch;
 }
 if(quoted)throw Error("CSV contains an unclosed quote.");
 cells.push(buf);if(cells.some(v=>v.trim()))rows.push(cells);
 if(!rows.length)throw Error("Add card names or choose a CSV file.");
 const norm=x=>String(x||"").toLowerCase().replace(/[^a-z]/g,"");
 const headers=rows[0].map(norm),nameIndex=headers.findIndex(v=>["name","card","cardname","cardtitle"].includes(v)),qtyIndex=headers.findIndex(v=>["quantity","qty","count","owned","amount"].includes(v)),header=nameIndex>=0&&qtyIndex>=0;
 const counts=new Map(),invalid=[];
 for(let i=header?1:0;i<rows.length;i++){
  const row=rows[i];let name="",qty=1;
  if(header){name=(row[nameIndex]||"").trim();qty=Number(row[qtyIndex]);}
  else if(row.length>=2&&/^\d+$/.test(row[0].trim())){qty=Number(row[0]);name=row[1].trim()}
  else if(row.length>=2&&/^\d+$/.test(row[1].trim())){qty=Number(row[1]);name=row[0].trim()}
  else{const line=row.join(",").trim(),m=/^(\d+)\s*[xX]?\s+(.+)$/.exec(line);name=m?m[2].trim():line;qty=m?Number(m[1]):1}
  name=name.replace(/\s+\([a-z0-9]{2,6}\)\s+\d+[a-z]?$/i,"").trim();
  if(!name||name.length>130||name.length<2||!Number.isInteger(qty)||qty<1||qty>999||/[\x00-\x1f]/.test(name)){invalid.push("Row "+(i+1)+": invalid name or quantity");continue}
  const k=key(name);if(!k){invalid.push("Row "+(i+1)+": invalid card name");continue}
  const prev=counts.get(k),sum=(prev?.quantity||0)+qty;
  if(sum>999){invalid.push("Row "+(i+1)+": more than 999 copies of "+name);continue}
  counts.set(k,{name,quantity:sum});
  if(counts.size>2500)throw Error("Collection limit is 2,500 distinct card names.");
 }
 if(!counts.size)throw Error("No valid card entries found.");
 return {cards:[...counts.values()],invalid};
}
export function roleOf(card){
 const t=String(card.type_line||"").toLowerCase(),o=String(card.oracle_text||"").toLowerCase();
 if(t.includes("land"))return "land";
 if(/destroy target|exile target|deals? \d+ damage to|counter target spell|sacrifice a creature/.test(o))return "interaction";
 if(/add \{[wubrgc]\}|add (?:one|two|three|an amount of) mana|search your library for (?:a|up to .*?) (?:basic )?land|mana of any color/.test(o))return "ramp";
 if(/draw (?:a|two|three|x|cards)|draw cards|look at the top .* put .* into your hand/.test(o))return "draw";
 if(/create .*token|creature token|whenever .* attacks|double strike|trample|\+1\/\+1/.test(o))return "payoff";
 return "utility";
}
export function validCommander(card){
 const t=String(card?.type_line||"");
 const o=String(card?.oracle_text||card?.card_faces?.map(x=>x.oracle_text).join(" ")||"");
 return !!card&&card.legalities?.commander==="legal"&&(/Legendary Creature/i.test(t)||/can be your commander/i.test(o));
}
export function allowed(card,commander){
 const identity=commander?.color_identity||[],colors=card?.color_identity||[];
 return card?.legalities?.commander==="legal"&&colors.every(c=>identity.includes(c));
}
export function copyLimit(card){
 const t=String(card.type_line||"");
 const oracle=String(card.oracle_text||"");
 if(/\bBasic Land\b/i.test(t)||/a deck can have any number of cards named/i.test(oracle))return 999;
 const upto=oracle.match(/a deck can have up to (\w+) cards named/i);
 if(upto){const n={seven:7,nine:9}[upto[1].toLowerCase()];if(n)return n}
 return 1;
}
export function draftFromOwned(commander,owned,lookups,pinned=[]){
 if(!validCommander(commander))throw Error("Select a Commander-legal legendary creature or eligible planeswalker.");
 const details=new Map(lookups.map(x=>[key(x.name),x]));
 const skip={illegal:[],outsideIdentity:[],unknown:[],notOwned:[]},pool=[];
 for(const row of owned){const k=key(row.name),card=details.get(k),qty=Number(row.quantity);
  if(k===key(commander.name))continue;
  if(!card){skip.unknown.push(row.name);continue}
  if(card.legalities?.commander!=="legal"){skip.illegal.push(row.name);continue}
  if(!allowed(card,commander)){skip.outsideIdentity.push(row.name);continue}
  const copies=Math.min(Number.isInteger(qty)?qty:0,copyLimit(card));
  if(copies>0)pool.push({name:card.name,qty:copies,role:roleOf(card),card});
 }
 const pin=new Set(pinned.map(key)),rank={interaction:5,draw:4,ramp:3,payoff:2,utility:1,land:0};
 pool.sort((a,b)=>Number(pin.has(key(b.name)))-Number(pin.has(key(a.name)))||Number(a.role==="land")-Number(b.role==="land")||rank[b.role]-rank[a.role]||Number(a.card.cmc||0)-Number(b.card.cmc||0)||a.name.localeCompare(b.name));
 const chosen=[],counts={land:0,interaction:0,draw:0,ramp:0,payoff:0,utility:0};
 function add(item,n){if(n<=0)return;const existing=chosen.find(c=>key(c.name)===key(item.name));if(existing)existing.qty+=n;else chosen.push({name:item.name,qty:n,role:item.role});counts[item.role]+=n;item.qty-=n}
 let remaining=99;
 for(const x of pool)if(pin.has(key(x.name))){const use=Math.min(remaining,x.qty,x.role==="land"?40-counts.land:x.qty);add(x,use);remaining-=use}
 for(const x of pool)if(x.role!=="land"&&remaining>0){const use=Math.min(x.qty,remaining);add(x,use);remaining-=use}
 for(const x of pool)if(x.role==="land"&&remaining>0){const use=Math.min(x.qty,remaining);add(x,use);remaining-=use}
 const count=100-remaining,complete=remaining===0;
 return {commander:commander.name,commanders:[commander.name],cards:chosen,cardCount:count,missingSlots:remaining,complete,counts,skip,
  warnings:[...(!complete?["Incomplete: "+remaining+" additional legal, owned card copies are needed."]:[]),...(counts.land<32?["Land count is low ("+counts.land+"); review mana consistency."]:[]),...(counts.land>40?["Land count is high ("+counts.land+"); review the mana curve."]:[]),...(skip.unknown.length?["Unchecked names were excluded."]:[])],
  eligible:pool.length};
}
export function synergySignal(commander){
 const o=String(commander.oracle_text||commander.card_faces?.map(x=>x.oracle_text).join(" ")||"").toLowerCase();
 if(/soldier/.test(o))return {term:"Soldier",query:'t:soldier',explanation:"Shares the Soldier creature type named in this commander's text."};
 if(/graveyard|reanimat|return target creature/.test(o))return {term:"graveyard",query:'o:"graveyard"',explanation:"References the graveyard; inspect how it interacts with this commander's ability."};
 if(/artifact/.test(o))return {term:"artifact",query:'t:artifact',explanation:"Uses the artifact type named in the commander's text."};
 if(/token/.test(o))return {term:"tokens",query:'o:"creature token"',explanation:"Creates or references creature tokens; check whether the timing helps this commander."};
 if(/counter/.test(o))return {term:"counters",query:'o:"+1/+1 counter"',explanation:"References counters; inspect whether they align with this commander's game plan."};
 if(/draw/.test(o))return {term:"card draw",query:'o:"draw a card"',explanation:"Contains a card-draw effect; consider how it supports the commander."};
 return {term:"utility",query:'o:"draw a card"',explanation:"General Commander utility candidate, not an established commander-specific synergy."};
}
