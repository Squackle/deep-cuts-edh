
export const KEY="deepcuts-deck-v1";
export const formats=["commander","standard","pioneer","modern","legacy","vintage","pauper","historic","brawl","timeless","alchemy"];
export const GAME_CHANGERS=new Set(
("Drannith Magistrate|Humility|Serra's Sanctum|Smothering Tithe|Enlightened Tutor|Teferi's Protection|Farewell|Consecrated Sphinx|Cyclonic Rift|Force of Will|Fierce Guardianship|Gifts Ungiven|Intuition|Mystical Tutor|Narset, Parter of Veils|Rhystic Study|Thassa's Oracle|Ad Nauseam|Bolas's Citadel|Braids, Cabal Minion|Demonic Tutor|Imperial Seal|Necropotence|Opposition Agent|Orcish Bowmasters|Tergrid, God of Fright|Vampiric Tutor|Gamble|Jeska's Will|Underworld Breach|Crop Rotation|Gaea's Cradle|Natural Order|Seedborn Muse|Survival of the Fittest|Worldly Tutor|Aura Shards|Coalition Victory|Grand Arbiter Augustin IV|Notion Thief|Ancient Tomb|Chrome Mox|Field of the Dead|Glacial Chasm|Grim Monolith|Lion's Eye Diamond|Mana Vault|Mishra's Workshop|Mox Diamond|Panoptic Mirror|The One Ring|The Tabernacle at Pendrell Vale").toLowerCase().split("|"));
export const manaLetters=["W","U","B","R","G"];
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function readDeck(){
 try{const d=JSON.parse(localStorage.getItem(KEY));return Array.isArray(d?.cards)?d:{cards:[],commanders:[],targetBracket:2}}catch{return {cards:[],commanders:[],targetBracket:2}}
}
export function saveDeck(deck){try{localStorage.setItem(KEY,JSON.stringify(deck));return true}catch{return false}}
export function normalizedName(s){return String(s||"").toLowerCase().normalize("NFKC").replace(/[^a-z0-9]/g,"")}
export function addCard(card,qty=1){
 const d=readDeck(),name=typeof card==="string"?card:card.name;
 if(!name)return false;
 const id=normalizedName(name),found=d.cards.find(c=>normalizedName(c.name)===id);
 if(found)found.qty+=qty;
 else d.cards.push({name,qty,card:typeof card==="object"?compactCard(card):null});
 return saveDeck(d);
}
export function compactCard(c){
 if(!c)return null;
 return {name:c.name,mana_cost:c.mana_cost||"",cmc:c.cmc||0,type_line:c.type_line||"",oracle_text:c.oracle_text||c.card_faces?.map(x=>x.oracle_text||"").join(" // ")||"",color_identity:c.color_identity||[],produced_mana:c.produced_mana||[],legalities:c.legalities||{},prices:{usd:c.prices?.usd||null},image:c.image_uris?.normal||c.card_faces?.[0]?.image_uris?.normal||"",scryfall_uri:c.scryfall_uri||"",keywords:c.keywords||[]};
}
export function cardImage(c){return c.image_uris?.normal||c.card_faces?.find(x=>x.image_uris?.normal)?.image_uris?.normal||""}
export function getStoredCard(name){return readDeck().cards.find(x=>normalizedName(x.name)===normalizedName(name))?.card}
export async function scryfall(url,options={}){
 const response=await fetch(url,{...options,headers:{"Accept":"application/json",...(options.headers||{})}});
 let json;
 try{json=await response.json()}catch{throw new Error("Could not read card data from Scryfall.")}
 if(!response.ok)throw new Error(json.details||json.message||"Scryfall request failed ("+response.status+")");
 return json;
}
export function parseLines(text){
 const counts=new Map(),invalid=[];
 let zone="cards",commanders=[];
 for(const raw of String(text||"").split(/\r?\n/)){
   const line=raw.trim();
   if(!line||line.startsWith("#")||line.startsWith("//"))continue;
   if(/^\[?\/?(commander|commanders)\]?:?$/i.test(line)){zone="commanders";continue}
   if(/^\[?\/?(deck|mainboard|main deck|cards)\]?:?$/i.test(line)){zone="cards";continue}
   if(/^\[?\/?(sideboard|maybeboard|considering)\]?:?$/i.test(line)){zone="ignore";continue}
   if(zone==="ignore")continue;
   const m=line.match(/^(?:(\d+)\s*[xX]?\s+)?(.+?)(?:\s+\([A-Za-z0-9]{2,6}\)\s+\d+[A-Za-z]?)?(?:\s+\*[^*]+\*)?$/);
   if(!m){invalid.push(line);continue}
   const qty=Math.min(250,Number(m[1]||1));
   let name=m[2].trim().replace(/\s+\([^)]*\)\s+\d+[A-Za-z]?$/,"").replace(/\s+\*[^*]+\*$/,"").trim();
   if(!name||qty<1){invalid.push(line);continue}
   if(zone==="commanders"){commanders.push(name);continue}
   const key=normalizedName(name);
   const existing=counts.get(key);
   if(existing)existing.qty+=qty;else counts.set(key,{name,qty,card:null})
 }
 return {cards:[...counts.values()],commanders,invalid};
}
export function toText(deck){return [...(deck.commanders?.length?["Commander",...deck.commanders.map(n=>"1 "+n),""]:[]),...deck.cards.map(c=>c.qty+" "+c.name)].join("\n")}
export const isBasic=(c)=>!!c&&/\bBasic Land\b/i.test(c.type_line||"");
export const isLand=(c)=>!!c&&/\bLand\b/i.test(c.type_line||"");
export function canRepeat(c){return isBasic(c)||/a deck can have any number of cards named/i.test(c?.oracle_text||"")||/a deck can have up to seven cards named/i.test(c?.oracle_text||"")}
export function legalStatus(c,format="commander"){return c?.legalities?.[format]||"unknown"}
