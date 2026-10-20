/* One restrained, progressive-disclosure premade-deck section for every Rescue
 * Report. All decklists remain free. No external affiliate scripts or writes. */
export const TIERS=Object.freeze([
 {id:'budget',label:'Budget',intro:'Affordable, focused on the commander’s core plan.'},
 {id:'standard',label:'Standard',intro:'Better consistency, interaction and stronger engines.'},
 {id:'noLimit',label:'No Limit',intro:'High-end optimization, with no price ceiling.'}
]);
const BASIC_LANDS=new Set(['plains','island','swamp','mountain','forest','wastes',
 'snow-covered plains','snow-covered island','snow-covered swamp',
 'snow-covered mountain','snow-covered forest']);
const APPROVED_HOSTS=new Set(['partner.tcgplayer.com','tcgplayer.pxf.io']);
const make=(tag,className,text)=>{
 const e=document.createElement(tag);
 if(className)e.className=className;
 if(text!==undefined)e.textContent=text;
 return e;
};
export function parseCard(line){
 if(typeof line!=='string')return null;
 const m=/^\s*(\d{1,3})\s+(\S.*?)\s*$/.exec(line);
 if(!m)return null;
 const qty=Number(m[1]),name=m[2].trim();
 return qty>0&&qty<=100&&name?{qty,name}:null;
}
export function readGroups(tier){
 if(tier?.groups&&typeof tier.groups==='object'&&!Array.isArray(tier.groups))
  return Object.entries(tier.groups).filter(([role,lines])=>role.length>0&&Array.isArray(lines));
 return Array.isArray(tier?.cards)?[['Decklist',tier.cards]]:[];
}
export function deckReport(tier,commanders){
 const groups=readGroups(tier),seen=new Set();
 let total=0;let invalid=false;let nonbasicDuplicates=0;
 if(!Array.isArray(commanders)||!commanders.length||!groups.length)return {valid:false,total:0,groups};
 const names=new Map();
 for(const [,lines] of groups){
  for(const line of lines){
   const c=parseCard(line);
   if(!c){invalid=true;continue}
   const name=c.name.toLowerCase();
   if(seen.has(name)){invalid=true;nonbasicDuplicates++;continue}
   seen.add(name);
   names.set(name,c.qty);
   if(c.qty>1&&!BASIC_LANDS.has(name))invalid=true;
   total+=c.qty;
  }
 }
 const uniqueCmd=new Set(commanders.map(s=>String(s).trim().toLowerCase()));
 const allCmd=uniqueCmd.size===commanders.length&&[...uniqueCmd].every(c=>names.get(c)===1);
 return {valid:!invalid&&total===100&&allCmd,total,groups};
}
/* 'reviewed' is the owner's independent legality/quality approval.
 * 100 syntactically structured cards alone never enables checkout. */
export function validCompleteDeck(tier,commanders){
 return tier?.reviewed===true && deckReport(tier,commanders).valid;
}
export function approvedAffiliateUrl(raw){
 if(typeof raw!=='string'||!raw||raw.length>2048)return null;
 try{
  const u=new URL(raw);
  return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&APPROVED_HOSTS.has(u.hostname.toLowerCase())?u.href:null;
 }catch{return null}
}
export function checkoutReady(config,tier,commanders){
 return config?.affiliate?.active===true&&tier?.checkoutUrlReviewed===true&&
  validCompleteDeck(tier,commanders)&&!!approvedAffiliateUrl(tier.checkoutUrl);
}
export async function loadShopConfig(){
 try{
  const r=await fetch(new URL('./deck-shop-config.json',import.meta.url),{credentials:'omit'});
  if(!r.ok)return {};
  const x=await r.json();
  return x?.schemaVersion===1&&x.cases&&typeof x.cases==='object'?x:{};
 }catch{return {}}
}
function listText(groups){
 return groups.flatMap(([,lines])=>lines).join('\n');
}
function starterLink(parent){
 const link=make('a','report-decks-starter','Explore the current starter-card package ↗');
 link.href='#guideCoreRows';
 link.addEventListener('click',()=>{
  const t=document.getElementById('guideCoreRows')?.closest('details');
  if(t)t.open=true;
 });
 parent.append(link);
}
function showTierContents(panel,tier,config,commanders,hasStarter,preview,label){
 panel.replaceChildren();
 const report=deckReport(tier,commanders);
 const note=make('p','report-decks-editorial',report.valid?
  (tier.reviewed===true?'Editorial decklist · 100 cards':'100-card working build · prices, legality and playtesting not yet independently verified'):
  'This '+label+' decklist is being prepared.');
 panel.append(note);
 if(preview)panel.append(make('p','report-decks-preview',
  'Preview case: please confirm the commander’s release and legality before purchasing.'));
 if(report.valid){
  const grid=make('div','report-decks-categories');
  for(const [role,lines] of report.groups){
   const section=make('section','report-decks-category');
   const count=lines.reduce((sum,line)=>sum+(parseCard(line)?.qty||0),0);
   const heading=make('h4',null,role+' · '+count);
   const list=make('ul');
   for(const line of lines){
    const card=parseCard(line);
    if(!card)continue;
    const li=make('li');
    const a=make('a',null,card.qty+' '+card.name);
    a.href='https://scryfall.com/search?q='+encodeURIComponent('!"'+card.name+'"');
    a.target='_blank';
    a.rel='noopener noreferrer';
    li.append(a);
    list.append(li);
   }
   section.append(heading,list);
   grid.append(section);
  }
  panel.append(grid);
  const actions=make('div','report-decks-actions');
  const copy=make('button','report-decks-copy','Copy 100-card list');
  copy.type='button';
  const status=make('span','report-decks-feedback','');
  status.setAttribute('role','status');
  copy.addEventListener('click',async()=>{
   try{
    await navigator.clipboard.writeText(listText(report.groups));
    status.textContent='Decklist copied';
   }catch{status.textContent='Copy unavailable; select the cards above.';}
  });
  actions.append(copy,status);
  panel.append(actions);
 }else if(hasStarter)starterLink(panel);
 if(checkoutReady(config,tier,commanders)){
  const buy=make('a','report-decks-affiliate','Get cards at TCGplayer ↗');
  buy.href=approvedAffiliateUrl(tier.checkoutUrl);
  buy.target='_blank';
  buy.rel='sponsored noopener noreferrer';
  panel.append(buy);
  panel.append(make('p','report-decks-disclaimer','Retailer sets actual prices, availability and shipping.'));
 }else{
  panel.append(make('p','report-decks-disclaimer',
   'TCGplayer purchasing will be added after approved affiliate links and deck verification.'));
 }
}
export async function mountDeckShop(data){
 const article=document.querySelector('.report-content');
 if(!article||!Array.isArray(data?.commanders)||!data.commanders.length||
  document.getElementById('reportPremadeDecks'))return;
 const slug=location.pathname.split('/').pop()?.replace(/\.html$/,'')||'';
 if(!/^[a-z0-9-]{1,100}$/.test(slug))return;
 const config=await loadShopConfig();
 const caseData=config.cases?.[slug]||{};
 const root=make('details','report-decks');
 root.id='reportPremadeDecks';
 const summary=make('summary','report-decks-summary','SEE DEEPCUTS PREMADE DECKLISTS');
 const intro=make('p','report-decks-intro',
  'Browse free builds by budget. Each deck opens only when you select it.');
 const tierContainer=make('div','report-decks-tier-container');
 const folds=[];
 for(const t of TIERS){
  const deck=caseData[t.id]||{};
  const info=deckReport(deck,data.commanders);
  const fold=make('details','report-decks-tier');
  const header=make('summary','report-decks-tier-summary');
  header.append(make('span',null,t.label));
  header.append(make('small',null,info.valid?'100 cards':'In preparation'));
  const body=make('div','report-decks-tier-body');
  fold.append(header,body);
  fold.addEventListener('toggle',()=>{
   if(!fold.open)return;
   for(const other of folds)if(other!==fold)other.open=false;
   showTierContents(body,deck,config,data.commanders,!!data.core?.length,!!(data.preview||caseData.preview),t.label);
  });
  folds.push(fold);
  tierContainer.append(fold);
 }
 const fine=make('p','report-decks-fineprint',
  'Decklists are free. If affiliate links become available, qualifying purchases may earn Deep Cuts EDH a commission at no additional cost.');
 root.append(summary,intro,tierContainer,fine);
 const anchor=article.querySelector('.report-core-warning')||article.querySelector('.report-core-fold');
 if(anchor)anchor.after(root);
 else{
  const verdict=[...article.querySelectorAll('h2')].find(x=>x.textContent.includes('Our verdict'));
  if(verdict)verdict.before(root);
  else article.append(root);
 }
 const aside=document.querySelector('.report-side');
 if(aside){
  const previous=aside.querySelector('.report-shop');
  if(previous)previous.remove();
  const link=make('a','report-decks-side-link','SEE PREMADE DECKLISTS ↗');
  link.href='#reportPremadeDecks';
  link.addEventListener('click',()=>{root.open=true});
  aside.append(link);
 }
}
