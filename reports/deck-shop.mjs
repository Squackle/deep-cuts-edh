/* Shared, zero-inventory Rescue Report storefront.
 * Renders on any report that already includes guide.js and rescue-data.
 * No payment processing, scripts from affiliates, analytics, or user records.
 * Deck approval and verified affiliate deep links are intentionally opt-in.
 */
export const TIERS=Object.freeze([
 {id:'budget',label:'Budget',description:'Affordable cards that preserve the commander’s main plan.'},
 {id:'standard',label:'Standard',description:'More consistent mana, interaction, and synergistic upgrades.'},
 {id:'no-limit',label:'No Limit',description:'Premium gameplay upgrades, without paying extra merely for special printings.'}
]);
const BASICS=new Set(['plains','island','swamp','mountain','forest','wastes',
 'snow-covered plains','snow-covered island','snow-covered swamp',
 'snow-covered mountain','snow-covered forest']);
const APPROVED_HOSTS=new Set(['partner.tcgplayer.com','tcgplayer.pxf.io']);
const make=(tag,cls,content)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(content!==undefined)el.textContent=content;
 return el;
};
/* Structural check ONLY. An editor must independently check color identity,
 * bans, Oracle names, land legality, gameplay, availability and deck quality.
 */
export function validCompleteDeck(tier,commanders){
 if(!tier||tier.reviewed!==true||!Array.isArray(tier.cards)||!Array.isArray(commanders)||!commanders.length)return false;
 let total=0;
 const entries=new Map();
 for(const line of tier.cards){
  if(typeof line!=='string')return false;
  const match=/^\s*(\d{1,3})\s+(\S.*?)\s*$/.exec(line);
  if(!match)return false;
  const qty=Number(match[1]),name=match[2].trim().toLowerCase();
  if(qty<1||qty>100||!name||entries.has(name))return false;
  if(qty>1&&!BASICS.has(name))return false;
  total+=qty;entries.set(name,qty);
 }
 if(total!==100)return false;
 const uniqueCommanders=new Set(commanders.map(c=>String(c).trim().toLowerCase()));
 return uniqueCommanders.size===commanders.length &&
  [...uniqueCommanders].every(c=>entries.get(c)===1);
}
export function approvedAffiliateUrl(raw){
 if(typeof raw!=='string'||!raw||raw.length>2048)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!APPROVED_HOSTS.has(url.hostname.toLowerCase()))return null;
  return url.href;
 }catch{return null;}
}
export function checkoutReady(config,tier,commanders){
 return config?.affiliate?.active===true &&
  tier?.checkoutUrlReviewed===true &&
  validCompleteDeck(tier,commanders) &&
  !!approvedAffiliateUrl(tier.checkoutUrl);
}
export async function loadShopConfig(){
 try{
  const response=await fetch(new URL('./deck-shop-config.json',import.meta.url),{credentials:'omit'});
  if(!response.ok)return {};
  const data=await response.json();
  return data?.schemaVersion===1&&typeof data.cases==='object'?data:{};
 }catch{return {};}
}
function sourceLink(target){
 const link=make('a','report-shop-source','View starter core ↗');
 link.href='#guideCoreRows';
 link.addEventListener('click',()=>{
  const rows=document.getElementById('guideCoreRows');
  const details=rows?.closest('details');
  if(details)details.open=true;
 });
 target.append(link);
}
function fullList(target,tier,commanders){
 const details=make('details','report-shop-decklist');
 const summary=make('summary',null,'View complete 100-card decklist');
 const pre=make('pre',null,tier.cards.join('\n'));
 const copy=make('button','report-shop-copy','Copy decklist');
 copy.type='button';
 const status=make('span','report-shop-copy-status','');
 status.setAttribute('role','status');
 copy.addEventListener('click',async()=>{
  try{
   await navigator.clipboard.writeText(tier.cards.join('\n'));
   status.textContent='Copied';
  }catch{status.textContent='Copy unavailable; select the list above.';}
 });
 details.append(summary,pre,copy,status);
 target.append(details);
}
function renderTier(body,config,caseConfig,tierId,commanders,hasStarter){
 body.replaceChildren();
 const meta=TIERS.find(t=>t.id===tierId);
 const tier=caseConfig?.[tierId]||{};
 const valid=validCompleteDeck(tier,commanders);
 const ready=checkoutReady(config,tier,commanders);
 const price=make('div','report-shop-price');
 const label=make('span',null,Number.isFinite(tier.targetUsd)&&tier.targetUsd>0?
  'Editorial target · not a quote':'Price estimate');
 const amount=make('strong',null,Number.isFinite(tier.targetUsd)&&tier.targetUsd>0?
  '$'+Math.round(tier.targetUsd)+' target':'To be confirmed');
 price.append(label,amount);
 const copy=make('p','report-shop-description',valid?
  meta.description:'Complete '+meta.label.toLowerCase()+' deck in preparation. '+meta.description);
 const action=ready?make('a','report-shop-buy','Buy on TCGplayer ↗'):
  make('button','report-shop-buy is-disabled','Buy on TCGplayer ↗');
 if(ready){
  action.href=approvedAffiliateUrl(tier.checkoutUrl);
  action.target='_blank';
  action.rel='sponsored noopener noreferrer';
  action.setAttribute('aria-label','Open reviewed '+meta.label+' Commander deck at TCGplayer (new tab)');
 }else{
  action.type='button';
  action.disabled=true;
  action.title='Available after an approved affiliate link and a reviewed, complete 100-card decklist';
 }
 const line=make('p','report-shop-status',ready?
  'Card availability, condition, shipping and final total are confirmed at checkout.':
  valid?'Shopping link pending affiliate approval and verification.':
  'Checkout unavailable until this tier has a reviewed 100-card deck.');
 body.append(price,copy,action,line);
 if(valid)fullList(body,tier,commanders);
 else if(hasStarter)sourceLink(body);
}
/* Called only by the shared guide script; works for current and future
 * reports without editing their static HTML one-by-one.
 */
export async function mountDeckShop(data){
 const sidebar=document.querySelector('.report-side');
 if(!sidebar||!Array.isArray(data?.commanders)||!data.commanders.length||
    sidebar.querySelector('.report-shop'))return;
 const rawSlug=location.pathname.split('/').pop()?.replace(/\.html$/,'')||'';
 if(!/^[a-z0-9-]{1,100}$/.test(rawSlug))return;
 const config=await loadShopConfig();
 const caseConfig=config.cases?.[rawSlug]||{};
 // A quiet editorial case file never displays a fake or disabled checkout.
 // Show buying controls only after a particular tier has a reviewed list,
 // a manually verified affiliate destination, and explicit global approval.
 const readyTiers=TIERS.filter(t=>checkoutReady(config,caseConfig[t.id],data.commanders));
 if(!readyTiers.length)return;
 const root=make('details','report-shop');
 root.setAttribute('aria-label','Optional deck purchasing and build tiers');
 const header=make('summary','report-shop-header','OPTIONAL · BUY A DECK ↗');
 const inner=make('div','report-shop-details-body');
 const tabs=make('div','report-shop-tabs');
 tabs.setAttribute('role','group');
 tabs.setAttribute('aria-label','Choose build tier');
 const body=make('div','report-shop-body');
 body.setAttribute('aria-live','polite');
 for(const t of TIERS){
  const btn=make('button','report-shop-tab',t.label);
  btn.type='button';
  btn.setAttribute('aria-pressed',String(t.id==='budget'));
  btn.addEventListener('click',()=>{
   for(const other of tabs.children){
    other.setAttribute('aria-pressed',String(other===btn));
   }
   renderTier(body,config,caseConfig,t.id,data.commanders,!!data.core?.length);
  });
  tabs.append(btn);
 }
 const disclosure=make('p','report-shop-disclosure',
  'Affiliate disclosure: if purchasing links become available, Deep Cuts EDH may earn a commission on qualifying purchases at no extra cost to you. Decklists stay free.');
 inner.append(tabs,body,disclosure);
 root.append(header,inner);
 sidebar.append(root);
 renderTier(body,config,caseConfig,readyTiers[0].id,data.commanders,!!data.core?.length);
 for(const btn of tabs.children)btn.setAttribute('aria-pressed',String(btn.textContent===readyTiers[0].label));
}
