// Only render or store links to recognizable public deck-sharing routes.
// This is an attribution link; an external site's data is never fetched or trusted.
const hosts=new Map([
 ["moxfield.com",/^\/decks\/[^/]+/i],
 ["www.moxfield.com",/^\/decks\/[^/]+/i],
 ["archidekt.com",/^\/decks\/[^/]+/i],
 ["www.archidekt.com",/^\/decks\/[^/]+/i],
 ["deckstats.net",/^\/decks\/[^/]+/i],
 ["www.deckstats.net",/^\/decks\/[^/]+/i],
 ["mtggoldfish.com",/^\/deck\/[^/]+/i],
 ["www.mtggoldfish.com",/^\/deck\/[^/]+/i]
]);
export function normalizeDeckSourceUrl(value){
 if(value===undefined||value===null||value==="")return "";
 if(typeof value!=="string"||!value.trim()||value.length>500)return null;
 try{
  const u=new URL(value.trim());
  if(u.protocol!=="https:"||u.username||u.password||u.port||!hosts.get(u.hostname)?.test(u.pathname))return null;
  u.hash=""; // No executable fragment or client-side trackers in public links.
  return u.href;
 }catch{return null}
}
