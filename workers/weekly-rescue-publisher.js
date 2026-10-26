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
const jsonFromModel=x=>{const str=typeof x==='string'?x:x?.response??x?.choices?.[0]?.message?.content??'';const start=str.indexOf('{'),end=str.lastIndexOf('}');if(start<0||end<start)fail('AI supplied no JSON');return JSON.parse(str.slice(start,end+1))};
const eligible=x=>x&&x.lang==='en'&&x.legalities?.commander==='legal'&&x.games?.includes('paper')&&Array.isArray(x.color_identity)&&x.color_identity.length<=5&&!!(x.oracle_text||x.card_faces?.[0]?.oracle_text);
const cardMini=x=>({name:x.name,oracle:clean(x.oracle_text||x.card_faces?.map(f=>f.oracle_text).join(' // ')||'',1100),type:clean(x.type_line,120),colors:x.color_identity,rank:Number.isInteger(x.edhrec_rank)?x.edhrec_rank:null,scryfall:x.scryfall_uri,price:Number.isFinite(Number(x.prices?.usd))?Number(x.prices.usd):null});
const numericHash=s=>{let n=2166136261;for(const c of s){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0};
const pickPages=date=>{const week=Math.floor(Date.parse(date+'T00:00:00Z')/604800000);return week%4===0?[3,4,5]:week%4===1?[5,7,9]:week%4===2?[2,6,10]:[4,8,10]};
async function fromScryfall(url){const response=await fetch(url,{headers,signal:AbortSignal.timeout(16000)});if(!response.ok)fail('Scryfall request failed '+response.status);return response.json()}
async function candidates(date){const results=[];const pages=pickPages(date);for(let i=0;i<pages.length;i++){
 const query=new URL(SOURCE+'/cards/search');query.searchParams.set('q','is:commander legal:commander game:paper');query.searchParams.set('order','edhrec');query.searchParams.set('dir','asc');query.searchParams.set('unique','cards');query.searchParams.set('page',String(pages[i]));
 const data=await fromScryfall(query);const pool=(data.data||[]).filter(eligible);
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
async function research(env,date){
 const pool=await candidates(date);
 const proposal=await think(env,[{role:'system',content:editorialSystem},{role:'user',content:`For these three Commander-legal cards, choose the strongest UNUSUAL but strategically plausible alternative to a conventional build. A moderately popular commander with a genuinely different strategy is good. This week's candidate set is ordered across Scryfall EDHREC card-use rank bands, NOT commander deck popularity. Never claim numeric theme adoption. Propose 10-13 EXISTING exact English Magic card names whose effects could support the theme; they will be checked against Scryfall. Return JSON with: "commander" (exact candidate name), "usualBuild" (max 70 chars; label as approximate), "theme" (max 80 chars), "hook" (max 210 chars), "supportCards" (array of 10-13 exact names), "selectionReason" (max 220 chars). Candidates: ${JSON.stringify(pool)}` }],1550);
 const commander=pool.find(x=>x.name===proposal.commander);if(!commander)fail('Model selected nonexistent candidate');
 if(!Array.isArray(proposal.supportCards))fail('Missing evidence card list');
 await sleep(220);const verified=await verifyCards(proposal.supportCards,commander);
 const article=await think(env,[{role:'system',content:editorialSystem},{role:'user',content:`Write an honest original Commander Rescue Report for an unusual strategic hypothesis, anchored STRICTLY to these verified English Scryfall Oracle texts. Only cite names supplied here and do not state a precise rule interaction without direct support. No deck is playtested; do not claim verified combos, a 100-card list, prices for full decks or measured archetype adoption. Return JSON ONLY with string fields: "headline" (max 95 chars), "diagnosis" (max 500 chars), "prescription" (max 650 chars), "earlyGame" (max 360 chars), "midGame" (max 360 chars), "lateGame" (max 360 chars), "risks" (max 450 chars), "verdict" (max 380 chars), and "synergies" array of at least FIVE objects {"name":"exact evidence card name", "why":"explanation up to 240 chars"}. Commander: ${JSON.stringify(commander)}. Hypothesis: ${JSON.stringify({usualBuild:proposal.usualBuild,theme:proposal.theme,hook:proposal.hook,selectionReason:proposal.selectionReason})}. Verified evidence cards: ${JSON.stringify(verified.map(x=>({name:x.name,oracle:x.oracle,type:x.type,colors:x.colors})))}` }],2750);
 const validByName=new Map(verified.map(x=>[x.name.toLowerCase(),x]));
 if(!Array.isArray(article.synergies))fail('No synergies');let examples=[];for(const row of article.synergies){const v=validByName.get(clean(row.name,130).toLowerCase());if(v&&!examples.some(x=>x.name===v.name)&&clean(row.why).length>=25)examples.push({name:v.name,why:clean(row.why,240),oracle:v.oracle,url:v.scryfall})}
 if(examples.length<5)fail('Not enough verified named synergy cards');
 const keys=['headline','diagnosis','prescription','earlyGame','midGame','lateGame','risks','verdict'];const sections={};for(const key of keys){sections[key]=clean(article[key],key==='prescription'?650:500);if(sections[key].length<(key==='headline'?18:55))fail('Incomplete researched section '+key)}
 const banned=/\b(infinite combo|guaranteed (?:win|kill)|always win|100%|according to EDHREC|\d+% of (?:decks|players)|playtested|proven in testing)\b/i;
 if([Object.values(sections).join(' '),examples.map(x=>x.why).join(' ')].some(x=>banned.test(x)))fail('Unsafe or unsupported editorial certainty');
 return {version:1,date,createdAt:new Date().toISOString(),commander:{name:commander.name,identity:commander.colors,oracle:commander.oracle,scryfall:commander.scryfall,edhrecCardUseRank:commander.rank},theme:clean(proposal.theme,80),usualBuild:clean(proposal.usualBuild,70),hook:clean(proposal.hook,210),selectionReason:clean(proposal.selectionReason,220),sections,synergies:examples.slice(0,8),methodology:'AI-assisted editorial strategy hypothesis using live Scryfall Oracle text and card-legality checks. The EDHREC card-use rank is NOT the commander-as-leader deck count. Strategy adoption was not independently measured; interaction interpretations and playtesting have not been judge-certified.',status:'AI-assisted and source-checked; not independently playtested'};
}
export const localReleaseWindow=now=>{const p=chicago(now);return p.weekday==='Fri'&&Number(p.hour)===10};
export async function publish(env,now){if(!env.REPORTS)fail('Rescue-only KV binding missing');const parts=chicago(now);
 if(parts.weekday!=='Fri'||Number(parts.hour)!==10)return {status:'not_release_window',local:dateKey(parts)+' '+parts.hour};
 const date=dateKey(parts);if(await env.REPORTS.get('article:'+date))return {status:'already_published',date};
 let item;try{item=await research(env,date)}catch(e){const error=clean(e?.message,170);await env.REPORTS.put('last-status',JSON.stringify({status:'held_for_review',date,reason:error,checkedAt:new Date().toISOString()}));return {status:'held_for_review',date,reason:error}}
 await env.REPORTS.put('article:'+date,JSON.stringify(item));
 const previous=JSON.parse(await env.REPORTS.get('index')||'[]');const next=[{date,commander:item.commander.name,theme:item.theme,headline:item.sections.headline},...previous.filter(x=>x.date!==date)].slice(0,104);
 await env.REPORTS.put('index',JSON.stringify(next));await env.REPORTS.put('last-status',JSON.stringify({status:'published',date,checkedAt:new Date().toISOString()}));return {status:'published',date,commander:item.commander.name};
}
export default {
 async scheduled(_event,env,ctx){ctx.waitUntil(publish(env,new Date()).then(x=>console.log('Rescue publication',x.status,x.date||'')).catch(e=>console.error('Rescue release worker failed',String(e))))},
 async fetch(request,env){const u=new URL(request.url);if(request.method!=='GET')return reply({error:'Method not allowed'},405);if(!env.REPORTS)return reply({error:'Publication store unavailable'},503);
  if(u.pathname==='/v1/health')return reply({ok:true,schedule:'Friday at 10:00 America/Chicago',aiConfigured:!!env.AI,last:JSON.parse(await env.REPORTS.get('last-status')||'null')});
  if(u.pathname==='/v1/index')return reply({reports:JSON.parse(await env.REPORTS.get('index')||'[]')});
  if(u.pathname==='/v1/latest'){const list=JSON.parse(await env.REPORTS.get('index')||'[]');return reply({report:list[0]||null})}
  if(u.pathname==='/v1/report'){const date=u.searchParams.get('date')||'';if(!/^20\d\d-\d\d-\d\d$/.test(date))return reply({error:'Invalid report date'},400);const x=await env.REPORTS.get('article:'+date,'json');return x?reply({report:x}):reply({error:'Report not found'},404)}
  return reply({error:'Not found'},404);
 }
};
