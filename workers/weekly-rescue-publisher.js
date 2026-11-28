/* Deep Cuts EDH autonomous weekly Rescue Report research.
 * Cron 15:00/16:00 UTC on Fridays; Chicago local-hour guard yields 10:00 every season.
 * No access to production identity, billing, game data or their database.
 * Sources: Scryfall public card records; originality is editorial, never a measured EDHREC deck percentage.
 */
export const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const SOURCE='https://api.scryfall.com';
const headers={'User-Agent':'DeepCutsEDH-WeeklyRescue/1.0 (+https://deep-cuts-edh.pages.dev/rescues)','Accept':'application/json'};
const publicHeaders={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=180','Access-Control-Allow-Origin':'https://deep-cuts-edh.pages.dev','X-Content-Type-Options':'nosniff'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:publicHeaders});
const chicago=(d=new Date())=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));
const dateKey=p=>`${p.year}-${p.month}-${p.day}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fail=msg=>{throw Error(msg)};
const clean=(x,max=1500)=>typeof x==='string'?x.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max):'';
// Workers AI can return parsed JSON in .response or textual choices.
export const jsonFromModel=x=>{
 const value=typeof x==='string'?x:(x?.response??x?.choices?.[0]?.message?.content??'');
 if(value&&typeof value==='object'&&!Array.isArray(value))return value;
 if(typeof value!=='string')fail('AI supplied unsupported JSON response');
 const start=value.indexOf('{'),end=value.lastIndexOf('}');
 if(start<0||end<start)fail('AI supplied no JSON');
 const parsed=JSON.parse(value.slice(start,end+1));
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))fail('AI supplied invalid JSON object');
 return parsed;
};
// Card art comes from the image CDN URL included with the verified Scryfall
// record. Never make an image request to the rate-limited /cards/named API.
export const verifiedCardImageUrl=card=>{
 const value=card?.image_uris?.normal||card?.card_faces?.find(face=>face.image_uris?.normal)?.image_uris?.normal;
 if(typeof value!=='string')return null;
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='cards.scryfall.io'&&/^\/normal\/(?:front|back)\/[a-f0-9]\/[a-f0-9]\/[a-f0-9-]{36}\.jpg$/.test(u.pathname)?u.href:null}
 catch{return null}
};
const scryfallLink=url=>{try{const u=new URL(String(url||''));u.searchParams.delete('utm_source');return u.href}catch{return null}};
const eligible=x=>x&&x.lang==='en'&&x.legalities?.commander==='legal'&&x.games?.includes('paper')&&Array.isArray(x.color_identity)&&x.color_identity.length<=5&&!!(x.oracle_text||x.card_faces?.[0]?.oracle_text);
const cardMini=x=>({name:x.name,oracle:clean(x.oracle_text||x.card_faces?.map(f=>f.oracle_text).join(' // ')||'',1100),type:clean(x.type_line,120),colors:x.color_identity,rank:Number.isInteger(x.edhrec_rank)?x.edhrec_rank:null,scryfall:scryfallLink(x.scryfall_uri),price:Number.isFinite(Number(x.prices?.usd))?Number(x.prices.usd):null,imageUrl:verifiedCardImageUrl(x)});
const numericHash=s=>{let n=2166136261;for(const c of s){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
const pickPages=date=>{const week=Math.floor(Date.parse(date+'T00:00:00Z')/604800000);return week%4===0?[3,4,5]:week%4===1?[5,7,9]:week%4===2?[2,6,10]:[4,8,10]};
async function fromScryfall(url){const response=await fetch(url,{headers,signal:AbortSignal.timeout(16000)});if(!response.ok)fail('Scryfall request failed '+response.status);return response.json()}
async function candidates(date){const results=[];const pages=pickPages(date);for(let i=0;i<pages.length;i++){
 const query=new URL(SOURCE+'/cards/search');query.searchParams.set('q','is:commander legal:commander game:paper');query.searchParams.set('order','edhrec');query.searchParams.set('dir','asc');query.searchParams.set('unique','cards');query.searchParams.set('page',String(pages[i]));
 const data=await fromScryfall(query);const pool=(data.data||[]).filter(x=>eligible(x)&&verifiedCardImageUrl(x));
 if(!pool.length)fail('No eligible commander candidates');
 const start=numericHash(date+':'+i)%pool.length;
 let selected=null;for(let j=0;j<pool.length;j++){const x=pool[(start+j)%pool.length];if(!results.some(v=>v.name===x.name)&&x.oracle_text?.length>=65){selected=x;break}}
 if(!selected)fail('Candidate selection exhausted');results.push(cardMini(selected));await sleep(200);
 }return results}
async function verifyCards(names,commander){
 const unique=[...new Set(names.map(n=>clean(n,130)))].filter(Boolean).slice(0,14);
 if(unique.length<7)fail('Fewer than seven proposed evidence cards');
 const response=await fetch(SOURCE+'/cards/collection',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({identifiers:unique.map(name=>({name}))}),signal:AbortSignal.timeout(16000)});
 if(!response.ok)fail('Scryfall card collection unavailable '+response.status);
 const data=await response.json();const verified=new Map();for(const x of data.data||[]){if(!eligible(x))continue;if(!x.color_identity.every(c=>commander.colors.includes(c)))continue;const item=cardMini(x);verified.set(x.name.toLowerCase(),item)}
 if(verified.size<6)fail('Insufficient Commander-legal, color-compatible evidence cards');return [...verified.values()];
}
async function think(env,messages,max_tokens){if(!env.AI)fail('Workers AI binding missing');const response=await env.AI.run(MODEL,{messages,max_tokens,temperature:0.35});return jsonFromModel(response)}
const editorialSystem=`You are a careful Magic: The Gathering Commander researcher. Use ONLY supplied Scryfall Oracle descriptions and candidate data as established facts. Do not invent EDHREC commander deck counts, adoption rates, test results, prices, unsupported rules, or citations. Avoid definitive combo or infinite-loop claims. Distinguish original strategic hypotheses from verified Oracle text. Return a single valid JSON object and no markdown.`;
// House style for the published article. Learned from weak automated drafts:
// vague verbs, a placeholder headline, and card notes that misread Oracle text.
const STYLE=`House style: write like a sharp Commander columnist talking to a friend. Short, concrete sentences. Every claim about a card must follow directly from its supplied Oracle text; never say a card makes a type or color of mana its text does not mention. Explain HOW each card connects to the commander's own text, naming the exact words that make it work. Never use the words utilize, leverage, synergy, synergize, advantage, unique, or "game-changing". The headline is a punchy full sentence about the strategy (not "<Commander> Rescue Report", not just the commander's name). The theme is 2 to 6 words and never promises infinite mana or combos.`;
// Measurable editorial floor. A report that fails is rewritten, never published.
const VAGUE=/\b(utiliz\w*|leverag\w*|synerg\w*|game-changing)\b/i;
export function qualityIssues(report){
 const issues=[];const s=report?.sections||{};const name=String(report?.commander?.name||'');
 const first=name.split(',')[0].trim().toLowerCase();const headline=String(s.headline||'').trim().toLowerCase();
 if(!headline||/rescue report$/.test(headline)||headline===first||headline===name.toLowerCase())issues.push('headline is a placeholder; write a full sentence about the strategy');
 if(/\binfinite\b/i.test(String(report?.theme||'')+' '+String(report?.hook||'')))issues.push('theme or hook promises infinite effects');
 const words=String(report?.theme||'').trim().split(/\s+/).filter(Boolean).length;if(words<2||words>6)issues.push('theme must be 2 to 6 words');
 const minimum={diagnosis:220,prescription:300,earlyGame:140,midGame:140,lateGame:140,risks:180,verdict:150};
 for(const [key,min] of Object.entries(minimum))if(String(s[key]||'').length<min)issues.push(key+' is too thin (at least '+min+' characters)');
 const syn=Array.isArray(report?.synergies)?report.synergies:[];
 if(syn.length<6)issues.push('at least six key cards need explanations');
 for(const x of syn)if(String(x?.why||'').length<70)issues.push('the note for '+x?.name+' is too short; explain how it works with the commander');
 const prose=Object.values(s).join(' ');
 const cited=syn.filter(x=>x?.name&&prose.includes(x.name)).length;if(cited<3)issues.push('the strategy sections must name at least three of the key cards');
 if(VAGUE.test(prose+' '+syn.map(x=>x?.why).join(' ')+' '+String(report?.hook||'')))issues.push('replace vague words (utilize, leverage, synergy) with what the cards actually do');
 return issues;
}
// Reject an invalid outline before spending card lookup or article tokens.
export function proposalIssues(proposal,pool){
 const issues=[];
 if(!pool.some(x=>x.name===proposal?.commander))issues.push('Model selected nonexistent candidate');
 for(const [field,limit] of [['usualBuild',70],['theme',80],['hook',210],['selectionReason',220]]){
  if(typeof proposal?.[field]!=='string'||!proposal[field].trim()||proposal[field].length>limit)issues.push('Invalid '+field);
 }
 const words=String(proposal?.theme||'').trim().split(/\s+/).filter(Boolean).length;
 if(words<2||words>6)issues.push('theme must be 2 to 6 words');
 if(/\binfinite\b/i.test(String(proposal?.theme||'')+' '+String(proposal?.hook||'')))issues.push('theme or hook promises infinite effects');
 const names=Array.isArray(proposal?.supportCards)?proposal.supportCards.map(n=>clean(n,130).toLowerCase()).filter(Boolean):[];
 if(new Set(names).size<7||names.length>14)issues.push('Invalid evidence card list');
 return issues;
}
async function research(env,date){
 const pool=await candidates(date);
 const proposalMessages=[{role:'system',content:editorialSystem},{role:'user',content:`For these three Commander-legal cards, choose the strongest UNUSUAL but strategically plausible alternative to a conventional build. A moderately popular commander with a genuinely different strategy is good. This week's candidate set is ordered across Scryfall EDHREC card-use rank bands, NOT commander deck popularity. Never claim numeric theme adoption. Propose 10-13 EXISTING exact English Magic card names whose effects could support the theme; they will be checked against Scryfall. Return JSON with: "commander" (exact candidate name), "usualBuild" (max 70 chars; label as approximate), "theme" (max 80 chars), "hook" (max 210 chars), "supportCards" (array of 10-13 exact names), "selectionReason" (max 220 chars). ${STYLE} Candidates: ${JSON.stringify(pool)}` }];
 let proposal=await think(env,proposalMessages,1550);
 let problems=proposalIssues(proposal,pool);
 if(problems.length){
  const correction=proposalMessages.map((message,i)=>i===proposalMessages.length-1?{...message,content:message.content+'\nThe previous outline was rejected: '+problems.join('; ')+'. Return a corrected outline using the same supplied candidates.'}:message);
  proposal=await think(env,correction,1550);
  problems=proposalIssues(proposal,pool);
  if(problems.length)fail('Editorial outline rejected: '+problems.join('; '));
 }
 const commander=pool.find(x=>x.name===proposal.commander);
 await sleep(220);const verified=await verifyCards(proposal.supportCards,commander);
 const articlePrompt=`Write an honest original Commander Rescue Report for an unusual strategic hypothesis, anchored STRICTLY to these verified English Scryfall Oracle texts. Only cite names supplied here and do not state a precise rule interaction without direct support. No deck is playtested; do not claim verified combos, a 100-card list, prices for full decks or measured archetype adoption. Return JSON ONLY with string fields: "headline" (max 95 chars), "diagnosis" (max 500 chars), "prescription" (max 650 chars), "earlyGame" (max 360 chars), "midGame" (max 360 chars), "lateGame" (max 360 chars), "risks" (max 450 chars), "verdict" (max 380 chars), and "synergies" array of at least FIVE objects {"name":"exact evidence card name", "why":"explanation up to 240 chars"}. Commander: ${JSON.stringify(commander)}. Hypothesis: ${JSON.stringify({usualBuild:proposal.usualBuild,theme:proposal.theme,hook:proposal.hook,selectionReason:proposal.selectionReason})}. Verified evidence cards: ${JSON.stringify(verified.map(x=>({name:x.name,oracle:x.oracle,type:x.type,colors:x.colors})))}\n${STYLE}`;
 const validByName=new Map(verified.map(x=>[x.name.toLowerCase(),x]));
 let feedback='';let lastIssues=[];
 for(let attempt=0;attempt<3;attempt++){
  const article=await think(env,[{role:'system',content:editorialSystem},{role:'user',content:articlePrompt+feedback}],2750);
  let item;try{item=assemble(article)}catch(e){lastIssues=[clean(e?.message,140)];feedback=`\nYour previous draft was rejected: ${lastIssues.join('; ')}. Fix every point.`;continue}
  lastIssues=qualityIssues(item);
  if(!lastIssues.length)return item;
  feedback=`\nYour previous draft was rejected by the editor: ${lastIssues.slice(0,6).join('; ')}. Rewrite the whole report and fix every point.`;
  await sleep(300);
 }
 fail('Editorial quality floor not met: '+lastIssues.slice(0,3).join('; '));
 function assemble(article){
 if(!Array.isArray(article.synergies))fail('No synergies');let examples=[];for(const row of article.synergies){const v=validByName.get(clean(row.name,130).toLowerCase());if(v&&!examples.some(x=>x.name===v.name)&&clean(row.why).length>=25)examples.push({name:v.name,why:clean(row.why,240),oracle:v.oracle,url:v.scryfall})}
 if(examples.length<5)fail('Not enough verified named synergy cards');
 const keys=['headline','diagnosis','prescription','earlyGame','midGame','lateGame','risks','verdict'];const sections={};for(const key of keys){sections[key]=clean(article[key],key==='prescription'?650:500);if(sections[key].length<(key==='headline'?18:55))fail('Incomplete researched section '+key)}
 const banned=/\b(infinite combo|guaranteed (?:win|kill)|always win|100%|according to EDHREC|\d+% of (?:decks|players)|playtested|proven in testing)\b/i;
 if([Object.values(sections).join(' '),examples.map(x=>x.why).join(' ')].some(x=>banned.test(x)))fail('Unsafe or unsupported editorial certainty');
 return {version:1,date,createdAt:new Date().toISOString(),commander:{name:commander.name,identity:commander.colors,oracle:commander.oracle,scryfall:commander.scryfall,edhrecCardUseRank:commander.rank,imageUrl:commander.imageUrl},theme:clean(proposal.theme,80),usualBuild:clean(proposal.usualBuild,70),hook:clean(proposal.hook,210),selectionReason:clean(proposal.selectionReason,220),sections,synergies:examples.slice(0,8),methodology:'AI-assisted editorial strategy hypothesis using live Scryfall Oracle text and card-legality checks. The EDHREC card-use rank is NOT the commander-as-leader deck count. Strategy adoption was not independently measured; interaction interpretations and playtesting have not been judge-certified.',status:'AI-assisted and source-checked; not independently playtested'};
 }
}
export const localReleaseWindow=now=>{const p=chicago(now);return p.weekday==='Fri'&&Number(p.hour)===10};
const asJSON=(value,fallback)=>{try{return JSON.parse(value??'null')??fallback}catch{return fallback}};
const status=(env,data)=>env.REPORTS.put('last-status',JSON.stringify({...data,checkedAt:new Date().toISOString()}));
const validDate=value=>typeof value==='string'&&/^20\d\d-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const validRow=row=>row&&validDate(row.date)&&typeof row.commander==='string'&&row.commander.trim()&&typeof row.theme==='string'&&row.theme.trim();
// Corruption must not masquerade as an empty archive or erase published rows.
export function parseStoredIndex(raw){
 if(raw===null||raw===undefined)return [];
 let list;
 try{list=JSON.parse(raw)}catch{fail('Stored report index is invalid JSON')}
 if(!Array.isArray(list)||list.some(row=>!validRow(row)))fail('Stored report index contains invalid rows');
 const byDate=new Map();
 for(const row of list)if(!byDate.has(row.date))byDate.set(row.date,row);
 return [...byDate.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
const readIndex=async env=>parseStoredIndex(await env.REPORTS.get('index'));
function articleRow(item){
 const row={date:item?.date,commander:item?.commander?.name,theme:item?.theme,headline:item?.sections?.headline,imageUrl:item?.commander?.imageUrl||null};
 if(!validRow(row)||typeof row.headline!=='string'||!row.headline.trim())fail('Stored article cannot be indexed');
 return row;
}
async function readArticle(env,date){
 const raw=await env.REPORTS.get('article:'+date);
 if(raw===null)return null;
 let item;
 try{item=JSON.parse(raw)}catch{fail('Stored article is invalid JSON')}
 if(item?.date!==date)fail('Stored article date mismatch');
 articleRow(item);
 return item;
}
const indexArticle=async(env,item)=>{
 const row=articleRow(item);
 const list=await readIndex(env);
 const next=[row,...list.filter(x=>x.date!==row.date)].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,104);
 await env.REPORTS.put('index',JSON.stringify(next));
};
async function recoverExisting(env,date,item){
 await indexArticle(env,item);
 await status(env,{status:'published',date,commander:item.commander.name,recoveredIndex:true});
 return {status:'already_published',date,recoveredIndex:true};
}
export async function publish(env,now){if(!env.REPORTS)fail('Rescue-only KV binding missing');
 const parts=chicago(now);
 if(!localReleaseWindow(now))return {status:'not_release_window',local:dateKey(parts)+' '+parts.hour};
 const date=dateKey(parts);
 try{
  // Repair the public index if an earlier run saved an article but crashed.
  const existing=await readArticle(env,date);
  if(existing)return await recoverExisting(env,date,existing);
  await readIndex(env);
  await status(env,{status:'researching',date});
  const item=await research(env,date);
  // A second read narrows the overlap window for delayed retries. KV is
  // eventually consistent; this is not a cross-isolate atomic lock.
  const recovered=await readArticle(env,date);
  if(recovered)return await recoverExisting(env,date,recovered);
  // Recheck index before saving to avoid publishing against known corruption.
  await readIndex(env);
  await env.REPORTS.put('article:'+date,JSON.stringify(item));
  await indexArticle(env,item);
  await status(env,{status:'published',date,commander:item.commander.name});
  return {status:'published',date,commander:item.commander.name};
 }catch(e){
  const reason=clean(e?.message,170);
  await status(env,{status:'held_for_review',date,reason});
  return {status:'held_for_review',date,reason};
 }
}
export async function scheduledRun(event,env){
 if(!env.REPORTS)fail('Rescue-only KV binding missing');
 // Use the scheduled timestamp to survive delayed Cloudflare cron execution.
 const epoch=Number(event?.scheduledTime);
 const scheduledAt=new Date(Number.isFinite(epoch)&&epoch>0?epoch:Date.now());
 await env.REPORTS.put('last-trigger',JSON.stringify({scheduledAt:scheduledAt.toISOString(),observedAt:new Date().toISOString(),releaseWindow:localReleaseWindow(scheduledAt)}));
 const result=await publish(env,scheduledAt);
 await env.REPORTS.put('last-run',JSON.stringify({...result,scheduledAt:scheduledAt.toISOString(),observedAt:new Date().toISOString()}));
 return result;
}
export default {
 async scheduled(event,env,ctx){
  ctx.waitUntil(scheduledRun(event,env).then(x=>console.log('Rescue publication',x.status,x.date||'')).catch(async e=>{
   console.error('Rescue release worker failed',String(e));
   if(env.REPORTS)try{await status(env,{status:'worker_error',reason:clean(e?.message,170)})}catch(writeError){console.error('Rescue status write failed',String(writeError))}
  }));
 },
 async fetch(request,env){const u=new URL(request.url);if(request.method!=='GET')return reply({error:'Method not allowed'},405);if(!env.REPORTS)return reply({error:'Publication store unavailable'},503);
  if(u.pathname==='/v1/health')return reply({ok:true,schedule:'Friday at 10:00 America/Chicago',aiConfigured:!!env.AI,last:asJSON(await env.REPORTS.get('last-status'),null),lastTrigger:asJSON(await env.REPORTS.get('last-trigger'),null),lastRun:asJSON(await env.REPORTS.get('last-run'),null)});
  if(u.pathname==='/v1/index'||u.pathname==='/v1/latest'){
   try{const list=await readIndex(env);return reply(u.pathname==='/v1/index'?{reports:list}:{report:list[0]||null})}
   catch{return new Response(JSON.stringify({error:'Publication index temporarily unavailable'}),{status:503,headers:{...publicHeaders,'Cache-Control':'no-store','Retry-After':'300'}})}
  }
  if(u.pathname==='/v1/report'){
   const date=u.searchParams.get('date')||'';
   if(!validDate(date))return reply({error:'Invalid report date'},400);
   try{
    const report=await readArticle(env,date);
    return report?reply({report}):reply({error:'Report not found'},404);
   }catch{
    return new Response(JSON.stringify({error:'Publication temporarily unavailable'}),{status:503,headers:{...publicHeaders,'Cache-Control':'no-store','Retry-After':'300'}});
   }
  }
  return reply({error:'Not found'},404);
 }
};
