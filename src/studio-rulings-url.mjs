// Keep externally supplied card URLs inside the intended Scryfall endpoints.
const API_ORIGIN="https://api.scryfall.com";
const CARD_ORIGIN="https://scryfall.com";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parsed(value,origin){
 if(typeof value!=="string"||value.length>2048||/[\s\\\u0000-\u001f\u007f]/u.test(value))return null;
 try{
  const u=new URL(value);
  return u.protocol==="https:"&&u.origin===origin&&!u.username&&!u.password&&!u.port?u:null;
 }catch{return null}
}
export function rulingsUrl(card){
 const id=card?.id;
 if(typeof id!=="string"||!uuid.test(id))throw Error("Unexpected rulings source.");
 const path="/cards/"+id.toLowerCase()+"/rulings";
 const canonical=API_ORIGIN+path;
 if(card.rulings_uri===undefined||card.rulings_uri===null||card.rulings_uri==="")return canonical;
 const u=parsed(card.rulings_uri,API_ORIGIN);
 if(!u||u.pathname.toLowerCase()!==path||u.search||u.hash)throw Error("Unexpected rulings source.");
 return canonical;
}
export function publicCardUrl(value){
 const u=parsed(value,CARD_ORIGIN);
 // Scryfall printing links contain set, collector number and optional slug.
 if(!u||!/^\/card\/[a-z0-9]+\/[a-zA-Z0-9%*._~-]+(?:\/[a-zA-Z0-9%._~-]+)?\/?$/.test(u.pathname))return CARD_ORIGIN;
 u.hash="";
 return u.href;
}
