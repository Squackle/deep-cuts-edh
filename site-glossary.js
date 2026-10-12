/* Deep Cuts sitewide reading aids. Does not modify decklists or editable fields. */
(() => {
 "use strict";
 const cards=new Map(),aliases=new Map();
 const glossary=window.DEEP_CUTS_GLOSSARY||{};
 const keywords=new Map(Object.entries(glossary).map(([k,v])=>[k.toLowerCase(),v]));
 for(const item of window.DEEP_CUTS_CARD_NAMES||[]){
  if(typeof item==="string"&&item.length>=4&&item.length<=150)cards.set(item.toLowerCase(),item);
 }
 for(const [alias,target] of Object.entries(window.DEEP_CUTS_CARD_ALIASES||{})){
  if(cards.has(target.toLowerCase()))aliases.set(alias.toLowerCase(),target);
 }
 if(Array.isArray(window.CHAINER_CORE))for(const item of window.CHAINER_CORE){
  if(typeof item?.[1]==="string")cards.set(item[1].toLowerCase(),item[1]);
 }
 const embedded=document.getElementById("rescue-data");
 if(embedded){
  try{
   const data=JSON.parse(embedded.textContent);
   for(const row of data.core||[])if(typeof row?.[1]==="string")cards.set(row[1].toLowerCase(),row[1]);
   for(const name of data.commanders||[])cards.set(name.toLowerCase(),name);
  }catch{}
 }
 const EXCLUDED="a,button,textarea,input,select,option,script,style,noscript,pre,code,svg,[contenteditable],[data-no-guide],.dc-keyword,.dc-card-link,#dc-rule-tooltip,.deck-row,.deck-input,.deck-queue,.report-core-table,.report-core,.studio-preview,#coreRows,#guideCoreRows,#deckRows,#deckInput,#collectionInput,#missingCards,#generatorPreview";
 let matcher=null,needsRebuild=true,scheduled=false;
 const queue=new Set();
 const escapeRegex=s=>Array.from(s).map(c=>"\\^$*+?.()|[]{}".includes(c)?"\\"+c:c).join("");
 const urlFor=name=>"https://scryfall.com/search?q="+encodeURIComponent('!"'+name+'"')+"&unique=cards";
 function pattern(){
  if(!needsRebuild)return matcher;
  const parts=[...new Set([...cards.values(),...aliases.keys(),...keywords.keys()])];
  parts.sort((a,b)=>b.length-a.length||a.localeCompare(b));
  matcher=parts.length?new RegExp(parts.map(escapeRegex).join("|"),"giu"):null;
  needsRebuild=false;
  return matcher;
 }
 const adjacent=(s,i)=>(i>=0&&i<s.length&&/[\p{L}\p{N}]/u.test(s[i]));
 function skipped(node){
  return !node?.parentElement||!node.nodeValue?.trim()||
   node.nodeValue.length>4500||Boolean(node.parentElement.closest(EXCLUDED))||
   Boolean(node.parentElement.closest("[hidden],[aria-hidden='true']"));
 }
 function cardLink(label,name){
  const a=document.createElement("a");a.className="dc-card-link";
  a.href=urlFor(name);a.textContent=label;a.target="_blank";a.rel="noopener noreferrer";
  a.title="Find "+name+" on Scryfall";a.dataset.dcCard=name;return a;
 }
 function termLink(label,meaning){
  const span=document.createElement("span");span.className="dc-keyword";span.tabIndex=0;
  span.setAttribute("role","button");span.setAttribute("aria-label",label+": "+meaning);
  span.dataset.dcDef=meaning;span.textContent=label;return span;
 }
 function decorate(node){
  if(skipped(node))return;
  const re=pattern(),str=node.nodeValue;if(!re)return;
  re.lastIndex=0;let last=0,found=false,m;
  const frag=document.createDocumentFragment();
  while((m=re.exec(str))!==null){
   const start=m.index,end=start+m[0].length;
   if(adjacent(str,start-1)||adjacent(str,end))continue;
   const term=m[0].toLowerCase(),card=cards.get(term)||aliases.get(term),meaning=keywords.get(term);
   if(!card&&!meaning)continue;
   if(start>last)frag.append(document.createTextNode(str.slice(last,start)));
   frag.append(card?cardLink(m[0],card):termLink(m[0],meaning));
   found=true;last=end;
  }
  if(!found)return;
  if(last<str.length)frag.append(document.createTextNode(str.slice(last)));
  node.replaceWith(frag);
 }
 function scan(root){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){decorate(root);return}
  if(root.nodeType!==Node.ELEMENT_NODE||root.matches(EXCLUDED))return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),targets=[];
  while(walker.nextNode())if(!skipped(walker.currentNode))targets.push(walker.currentNode);
  for(const text of targets)if(text.isConnected)decorate(text);
 }
 function schedule(node){
  if(node)queue.add(node);
  if(scheduled)return;scheduled=true;
  window.setTimeout(()=>{
   scheduled=false;
   for(const root of [...queue])if(root.isConnected)scan(root);
   queue.clear();
  },80);
 }
 window.DeepCutsGuide={
  registerCardNames(names){
   let changed=false;
   for(const item of names||[]){
    const name=typeof item==="string"?item:item?.name;
    if(typeof name!=="string"||name.length<4||name.length>150)continue;
    if(!cards.has(name.toLowerCase())){cards.set(name.toLowerCase(),name);changed=true}
   }
   if(changed){needsRebuild=true;schedule(document.body)}
  },
  scryfallUrl:urlFor,
  refresh:root=>schedule(root||document.body)
 };
 function start(){
  scan(document.body);
  const observer=new MutationObserver(records=>{
   for(const r of records){
    if(r.type==="attributes"&&r.attributeName==="hidden"&&!r.target.hidden){
     schedule(r.target);continue;
    }
    for(const node of r.addedNodes||[]){
     if(node.nodeType===Node.ELEMENT_NODE||node.nodeType===Node.TEXT_NODE)schedule(node);
    }
   }
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden"]});
  const tip=document.createElement("div");tip.id="dc-rule-tooltip";tip.setAttribute("role","tooltip");
  tip.hidden=true;document.body.append(tip);
  let active=null,pinned=false;
  function close(){
   if(active){active.classList.remove("dc-open");active.removeAttribute("aria-describedby")}
   active=null;pinned=false;tip.hidden=true;
  }
  function open(el,stick=false){
   if(!el?.classList?.contains("dc-keyword"))return;
   if(active&&active!==el)close();
   active=el;pinned=stick;
   tip.textContent=el.dataset.dcDef||"";
   tip.hidden=false;el.classList.add("dc-open");el.setAttribute("aria-describedby","dc-rule-tooltip");
   const rect=el.getBoundingClientRect(),width=Math.min(320,window.innerWidth-24);
   tip.style.width=width+"px";
   const height=tip.getBoundingClientRect().height;
   const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.left));
   const top=rect.bottom+height+12>window.innerHeight&&rect.top-height-12>8?rect.top-height-12:Math.min(rect.bottom+9,window.innerHeight-height-8);
   tip.style.left=left+"px";tip.style.top=Math.max(8,top)+"px";
  }
  const cardUrlCache=new Map();
  let lastCardLookup=0,requestQueue=Promise.resolve();
  async function resolveCard(anchor){
   if(!anchor||!anchor.dataset.dcCard)return;
   const name=anchor.dataset.dcCard;
   if(!cardUrlCache.has(name)){
    const request=requestQueue.then(async()=>{
     const wait=Math.max(0,160-(Date.now()-lastCardLookup));
     if(wait)await new Promise(done=>window.setTimeout(done,wait));
     lastCardLookup=Date.now();
     const res=await fetch("https://api.scryfall.com/cards/named?exact="+encodeURIComponent(name),{headers:{"Accept":"application/json"}});
     if(!res.ok)return null;
     const card=await res.json(),url=card?.scryfall_uri;
     if(typeof url!=="string")return null;
     const parsed=new URL(url);
     return parsed.protocol==="https:"&&parsed.hostname==="scryfall.com"?url:null;
    }).catch(()=>null);
    requestQueue=request.then(()=>undefined);
    cardUrlCache.set(name,request);
    if(cardUrlCache.size>80)cardUrlCache.delete(cardUrlCache.keys().next().value);
   }
   const uri=await cardUrlCache.get(name);
   if(uri){for(const a of document.querySelectorAll("a.dc-card-link"))if(a.dataset.dcCard===name)a.href=uri}
  }
  document.addEventListener("pointerover",e=>{const a=e.target.closest?.("a.dc-card-link");if(a)resolveCard(a)},true);
  document.addEventListener("focusin",e=>{const a=e.target.closest?.("a.dc-card-link");if(a)resolveCard(a)},true);
  document.addEventListener("pointerover",e=>{const el=e.target.closest?.(".dc-keyword");if(el&&!pinned)open(el)},true);
  document.addEventListener("pointerout",e=>{if(active&&!pinned&&e.target===active)close()},true);
  document.addEventListener("focusin",e=>{const el=e.target.closest?.(".dc-keyword");if(el)open(el)},true);
  document.addEventListener("focusout",e=>{if(active&&active===e.target&&!pinned)close()},true);
  document.addEventListener("click",e=>{const el=e.target.closest?.(".dc-keyword");if(el){if(pinned&&el===active)close();else open(el,true)}else if(pinned)close()},true);
  document.addEventListener("keydown",e=>{
   if(e.key==="Escape"&&active)close();
   else if((e.key==="Enter"||e.key===" ")&&e.target.classList?.contains("dc-keyword")){
    e.preventDefault();if(pinned&&active===e.target)close();else open(e.target,true);
   }
  },true);
  window.addEventListener("scroll",()=>{if(active&&!pinned)close()},{passive:true});
  window.addEventListener("resize",close);
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();