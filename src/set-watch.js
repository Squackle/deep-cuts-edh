/* Shared pure rules for the Scryfall-powered Set Watch.
 * Announced sets are provided by Scryfall; unreleased ≠ Commander-legal.
 */
export const SET_TYPES=new Set(["expansion","core","masters","commander","draft_innovation","starter","funny"]);
export function isoDay(date){return new Date(date).toISOString().slice(0,10)}
export function validCode(code){return /^[a-z0-9]{2,6}$/.test(String(code||""))}
export function relevantSets(data,now=new Date()){
 const today=new Date(isoDay(now)+"T12:00:00Z").getTime(),day=86400000;
 const earliest=today-75*day,latest=today+570*day;
 return (Array.isArray(data)?data:[]).filter(s=>{
  if(!s||!validCode(s.code)||s.digital===true||!SET_TYPES.has(s.set_type))return false;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.released_at||""))return false;
  const time=Date.parse(s.released_at+"T12:00:00Z");
  return Number.isFinite(time)&&time>=earliest&&time<=latest;
 }).map(s=>({
  code:s.code,name:s.name,type:s.set_type,released_at:s.released_at,
  set_url:typeof s.scryfall_uri==="string"&&s.scryfall_uri.startsWith("https://scryfall.com/")?s.scryfall_uri:"https://scryfall.com/sets/"+s.code,
  cards_indexed:Math.max(0,Number(s.card_count)||0),
  upcoming:s.released_at>isoDay(now)
 })).sort((a,b)=>a.released_at.localeCompare(b.released_at)||a.name.localeCompare(b.name));
}
export function publicPreview(card,today=isoDay(new Date())){
 if(!card||!card.name||!validCode(card.set))return null;
 const face=Array.isArray(card.card_faces)?card.card_faces.find(x=>x.image_uris)||card.card_faces[0]:null;
 const img=card.image_uris?.normal||face?.image_uris?.normal||null;
 const art=card.image_uris?.art_crop||face?.image_uris?.art_crop||null;
 const image=typeof img==="string"&&img.startsWith("https://cards.scryfall.io/")?img:null;
 const art_image=typeof art==="string"&&art.startsWith("https://cards.scryfall.io/")?art:null;
 const preview=card.preview||{};
 const src=typeof preview.source_uri==="string"&&/^https:\/\//.test(preview.source_uri)?preview.source_uri:null;
 const release=String(card.released_at||"");
 const unReleased=release>today;
 return {
  id:String(card.id||""),name:String(card.name).slice(0,180),set:card.set,
  rarity:String(card.rarity||""),type:String(card.type_line||"").slice(0,250),
  mana:String(card.mana_cost||face?.mana_cost||"").slice(0,80),
  released_at:release,unreleased:unReleased,
  commander_legal:!unReleased&&card.legalities?.commander==="legal",
  commander_candidate:/Legendary (Creature|Planeswalker)/i.test(card.type_line||""),
  image,art_image,
  previewed_at:typeof preview.previewed_at==="string"?preview.previewed_at:null,
  preview_source:typeof preview.source==="string"?preview.source.slice(0,90):null,
  preview_source_uri:src,
  url:typeof card.scryfall_uri==="string"&&card.scryfall_uri.startsWith("https://scryfall.com/")?card.scryfall_uri:"https://scryfall.com/search?q="+encodeURIComponent("set:"+card.set+" "+card.name)
 };
}
