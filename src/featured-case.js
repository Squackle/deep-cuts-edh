/* Current featured rescue. Updating the homepage case must update this record too;
   regression checks verify they agree. Never trust client-supplied challenge/commander names. */
export const CURRENT_CASE=Object.freeze({slug:"commander-mustard",commander:"Commander Mustard"});
export const normalizeCommander=name=>String(name||"").normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
export function featuredDeckEligible(deck){
 if(!deck||normalizeCommander(deck.commander)!==normalizeCommander(CURRENT_CASE.commander))return false;
 // A featured entry must lead with EXACTLY the featured commander, not merely mention
 // them among partners, in the title, or inside the deck's 99.
 if(deck.content!==undefined&&deck.content!==null){
  let content=deck.content;
  try{if(typeof content==="string")content=JSON.parse(content)}catch{return false}
  if(!Array.isArray(content?.commanders)||content.commanders.length!==1)return false;
  return normalizeCommander(content.commanders[0])===normalizeCommander(CURRENT_CASE.commander);
 }
 // Public deck lists returned to the client include only a canonical display
 // commander; authoritative server checks ALWAYS fetch the actual deck content.
 return true;
}
export const isOpenChallenge=challenge=>challenge?.format==="open";
export function publicChallenge(challenge){
 if(!challenge)return challenge;
 return isOpenChallenge(challenge)?challenge:{
  ...challenge,
  title:"Featured Case Challenge — "+CURRENT_CASE.commander,
  commander:CURRENT_CASE.commander
 };
}
