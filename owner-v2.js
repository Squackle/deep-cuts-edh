/* Deep Cuts EDH Owner Command Center 2.0.
 * Progressive UI on top of existing secured forms, not a replacement for server auth.
 * API results are rendered as text nodes. No owner credentials are persisted.
 */
(()=>{
"use strict";
const $=id=>document.getElementById(id), main=document.querySelector("main.ops");
const stage=document.querySelector(".owner-panel-stage");
if(!main||!stage||!$("opsForm")||!document.querySelector(".owner-main-nav"))return;
const el=(tag,text="",cls="")=>{const x=document.createElement(tag);if(text!==null)x.textContent=String(text);if(cls)x.className=cls;return x;};
const groups=[
 ["Content",[["publishing","Publishing"],["nominations","Nominations"],["seo","Search & indexing"]]],
 ["Community",[["moderation","Moderation"],["feedback","Feedback"],["directory","Member directory"],["evidence","Evidence"]]],
 ["Games",[["games","Game statistics"],["integrity","Score integrity"],["schedule","Scheduled content"]]],
 ["Business",[["members","Paid memberships"],["grants","Free keys"],["adfree","Ad-free"],["revenue","Revenue records"]]],
 ["Site",[["site","Site status"],["analytics","Community activity"],["features","Feature switches"]]],
 ["Security",[["sweep","Security sweep"],["recovery","Backups & recovery"],["audit","Admin activity"],["tools","Tools & diagnostics"]]]
];
const oldPanels={};
for(const section of [...stage.querySelectorAll(".owner-workspace-panel")])oldPanels[section.id.replace("owner-panel-","")]=section;
const oldNav=document.querySelector(".owner-main-nav");oldNav.remove();
stage.replaceChildren();main.classList.add("owner-v2");
const heading=main.querySelector("h1");heading.textContent="Owner Command Center";document.title="Owner Command Center | Deep Cuts EDH";
const existingDescription=main.querySelector(".owner-subtitle");if(existingDescription)existingDescription.textContent="Manage the website, community, games, and memberships.";
const layout=el("div",null,"owner-v2-layout");
const menu=el("nav",null,"owner-v2-menu");menu.setAttribute("aria-label","Admin navigation");
const content=el("div",null,"owner-v2-content");
const crumb=el("div",null,"owner-v2-crumb");crumb.setAttribute("aria-live","polite");
const workspace=el("div",null,"owner-v2-workspace");
layout.append(menu,content);content.append(crumb,workspace);stage.append(layout);
const spaces=new Map(),navButtons=new Map();
function button(label,click,cls=""){
 const b=el("button",label,cls);b.type="button";b.addEventListener("click",click);return b;
}
const home=el("section",null,"owner-v2-home");
const welcome=el("h2","Welcome back.");
const sub=el("p","Choose a section to manage your site. Changes requiring approval will ask for confirmation.","owner-v2-muted");
const homeTiles=el("div",null,"owner-v2-tiles");
// The audit itself runs in GitHub Actions with least-privilege CI credentials.
// This link does not impersonate the owner or expose a GitHub token in the browser.
const sweepQuick=el("div",null,"owner-v2-security-quick");
const sweepLink=el("a","Run Security Sweep ↗","owner-v2-security-cta");
sweepLink.href="https://github.com/Squackle/deep-cuts-edh/actions/workflows/security-sweep.yml";
sweepLink.target="_blank";
sweepLink.rel="noopener noreferrer";
sweepLink.setAttribute("aria-label","Open GitHub Actions to run a security sweep");
const sweepHelp=el("p","Opens GitHub Actions. Select Run workflow on main to start a safe, non-disruptive sweep.","owner-v2-muted owner-v2-security-help");
sweepQuick.append(sweepLink,sweepHelp);
home.append(welcome,sub,sweepQuick,homeTiles);
spaces.set("home",home);
for(const [name,sections] of groups){
 const navItem=button(name,()=>showGroup(name),"owner-v2-menu-button");
 navItem.dataset.ownerV2Group=name;menu.append(navItem);navButtons.set(name,navItem);
 const tile=button(name,()=>showGroup(name),"owner-v2-home-tile");
 tile.append(el("small",sections.map(([k,n])=>n).join(" · ")));
 homeTiles.append(tile);
 const groupPage=el("section",null,"owner-v2-group");
 groupPage.append(el("h2",name),el("p","Choose a tool below.","owner-v2-muted"));
 const links=el("div",null,"owner-v2-tool-grid");
 for(const [id,label] of sections) {
  const b=button(label,()=>showTool(id,name),"owner-v2-tool-card");
  links.append(b);
  const panel=oldPanels[id]||el("section",null,"owner-workspace-panel");
  panel.hidden=true;panel.classList.add("owner-v2-tool-panel");
  if(!oldPanels[id]){
   panel.append(el("h2",label));
   const status=el("output",null,"owner-v2-message");status.setAttribute("role","status");status.setAttribute("aria-live","polite");
   const body=el("div",null,"owner-v2-data");
   panel.append(status,body);
  }
  spaces.set(id,panel);
 }
 groupPage.append(links);spaces.set("group:"+name,groupPage);
}
const homeButton=button("Home",()=>showHome(),"owner-v2-menu-button");
homeButton.dataset.ownerV2Group="Home";menu.prepend(homeButton);navButtons.set("Home",homeButton);
const sectionOrder=["home",...Array.from(groups).flatMap(([g,sections])=>["group:"+g,...sections.map(([k])=>k)])];
sectionOrder.forEach(id=>workspace.append(spaces.get(id)));
let active="home",requestSeq=0;
function activePage(id){
 active=id;
 for(const [key,panel] of spaces)panel.hidden=key!==id;
 for(const [key,btn] of navButtons)btn.setAttribute("aria-current",(id==="home"?key==="Home":id==="group:"+key||(groups.find(([name,sections])=>name===key)?.[1]||[]).some(([sid])=>sid===id))?"page":"false");
}
function showHome(){activePage("home");crumb.replaceChildren();history.replaceState(null,"",location.pathname+"#home");}
function showGroup(name){activePage("group:"+name);crumb.replaceChildren(button("Home",showHome),el("span"," / "+name));history.replaceState(null,"",location.pathname+"#"+name.toLowerCase());}
function showTool(id,group){
 activePage(id);crumb.replaceChildren(button("Home",showHome),el("span"," / "),button(group,()=>showGroup(group)),el("span"," / "+((groups.find(([name])=>name===group)?.[1]||[]).find(([k])=>k===id)?.[1]||id)));
 history.replaceState(null,"",location.pathname+"#"+id);
 if(readers[id])load(id);
}
showHome();
function clearPrivateViews(){
 ++requestSeq; // discard asynchronous requests from any previous owner-key session
 for(const [id,panel] of spaces){
  if(["home"].includes(id)||id.startsWith("group:")||oldPanels[id])continue;
  const body=panel.querySelector(".owner-v2-data");
  if(body)body.replaceChildren();
  const status=panel.querySelector(".owner-v2-message");
  if(status)status.textContent="";
 }
 showHome();
}
const lock=$("ownerLock");
if(lock)lock.addEventListener("click",clearPrivateViews);
const lockStatus=$("ownerLockStatus");
if(lockStatus)new MutationObserver(()=>{
 const status=lockStatus.textContent||"";
 if(status.includes("Auto-locked")||status.includes("Owner key cleared"))clearPrivateViews();
}).observe(lockStatus,{childList:true,subtree:true,characterData:true});
function ownerKey(){return $("opsForm").elements.operatorKey.value.trim();}
function panelStatus(id,message){const node=spaces.get(id)?.querySelector(".owner-v2-message");if(node)node.textContent=message||"";}
async function api(view,payload){
 const key=ownerKey();if(!/^dcissuer1_[a-f0-9]{64}$/.test(key))throw Error("Enter your private owner key above to load this section.");
 const url=new URL("/api/owner-ops",location.href);const headers={Authorization:"Bearer "+key};
 const opt={headers,credentials:"same-origin",cache:"no-store"};
 if(payload!==undefined){opt.method="POST";headers["Content-Type"]="application/json";opt.body=JSON.stringify(payload);}
 else url.searchParams.set("view",view);
 let r;
 try{r=await fetch(url,opt)}catch{throw Error("Cannot reach the admin service. Check your Cloudflare login and connection.");}
 if(!(r.headers.get("content-type")||"").includes("application/json"))throw Error("Cloudflare login may have expired. Refresh the page and sign in again.");
 let data;try{data=await r.json()}catch{throw Error("Admin service returned an unreadable response.");}
 if(!r.ok)throw Error(data.error||"Request failed (HTTP "+r.status+").");
 return data;
}
function clear(node){node.replaceChildren();}
function label(text){return String(text??"—");}
function readableDate(input){
 if(input==null)return "—";
 if(typeof input==="number"&&input>10000000)return new Date(input*1000).toLocaleString();
 return String(input);
}
function line(container,labelText,value){
 const r=el("div",null,"owner-v2-stat");r.append(el("span",labelText),el("strong",label(value)));container.append(r);
}
function stats(container,values){
 const grid=el("div",null,"owner-v2-stat-grid");
 for(const [k,v] of Object.entries(values||{}))line(grid,k.replaceAll("_"," "),v);container.append(grid);
}
function links(container,items){
 const bar=el("div",null,"owner-v2-links");
 for(const [title,url] of items){const a=el("a",title+" ↗");a.href=url;a.target="_blank";a.rel="noopener noreferrer";bar.append(a);}
 container.append(bar);
}
function table(container,rows,fields){
 if(!rows?.length){container.append(el("p","No records found.","owner-v2-muted"));return}
 const scroll=el("div",null,"owner-v2-scroll"),tab=el("table"),thead=el("thead"),head=el("tr");
 for(const [label] of fields)head.append(el("th",label));
 thead.append(head);tab.append(thead);
 const tbody=el("tbody");
 for(const row of rows){const tr=el("tr");for(const [,getter] of fields){const td=el("td");const val=typeof getter==="function"?getter(row):row[getter];td.textContent=label(val);tr.append(td)}tbody.append(tr)}
 tab.append(tbody);scroll.append(tab);container.append(scroll);
}
function message(container,text){container.append(el("p",text,"owner-v2-muted"));}
function action(container,title,fn,destructive=false){
 const b=button(title,async()=>{
  if(destructive&&!confirm("Confirm "+title+"? The action will be saved and audited."))return;
  b.disabled=true;
  try{await fn();}catch(e){const status=spaces.get(active)?.querySelector(".owner-v2-message");if(status)status.textContent=e.message;}
  finally{b.disabled=false;}
 },destructive?"owner-v2-danger":"owner-v2-action");container.append(b);
}
async function mutate(payload,id){
 const result=await api(null,payload);
 panelStatus(id,result.message||"Action completed and audited.");
 await load(id);
}
function titled(container,title){container.append(el("h3",title))}
const renderers={
 overview:(node,d)=>stats(node,d.stats),
 moderation:(node,d)=>{
  titled(node,"Pending nominations");message(node,"Check card legality and duplicates before approving. Rejection preserves recorded votes.");
  for(const n of d.nominations||[]){
   const c=el("article",null,"owner-v2-record");c.append(el("strong",n.name+" · "+n.votes+" votes"),el("p",n.rationale||"No rationale."),el("p",n.strategy||""));
   action(c,"Approve",()=>mutate({kind:"nomination",action:"approved",id:String(n.id)},"moderation"),true);
   action(c,"Reject",()=>mutate({kind:"nomination",action:"rejected",id:String(n.id)},"moderation"),true);node.append(c)
  }
  if(!d.nominations?.length)message(node,"No pending nominations.");
  titled(node,"Open reports");
  for(const r of d.reports||[]){const c=el("article",null,"owner-v2-record");c.append(el("strong","Reported comment · "+r.author),el("p",r.reason),el("p",r.comment_body||"Comment no longer available"));
   action(c,"Resolve",()=>mutate({kind:"report",action:"resolved",id:r.id},"moderation"));
   action(c,"Dismiss",()=>mutate({kind:"report",action:"dismissed",id:r.id},"moderation"));node.append(c)}
  if(!d.reports?.length)message(node,"No open reports.");
  titled(node,"Latest research findings");table(node,d.evidence,[["Finding","title"],["Case","case_slug"],["Status","status"]]);
 },
 feedback:(node,d)=>{
  titled(node,"Feedback inbox");
  for(const r of d.feedback||[]){const c=el("article",null,"owner-v2-record");
   c.append(el("strong",r.category+" · "+r.status+" · #"+r.id),el("p",r.message),el("small",r.page+" · "+r.created_at));
   if(r.status!=="reviewed")action(c,"Mark reviewed",()=>mutate({kind:"feedback",action:"reviewed",id:String(r.id)},"feedback"));
   if(r.status!=="resolved")action(c,"Resolve",()=>mutate({kind:"feedback",action:"resolved",id:String(r.id)},"feedback"));
   node.append(c);
  }
  if(!d.feedback?.length)message(node,"No feedback yet.");
  links(node,[["GitHub issues","https://github.com/Squackle/deep-cuts-edh/issues"]]);
 },
 publishing:(node,d)=>{
  message(node,"Manage research and draft status. Marking a draft ready or published here does NOT publish a website article.");
  const form=el("form",null,"owner-v2-editor");
  for(const [name,txt,tag] of [["commander","Commander","input"],["title","Report title","input"],["notes","Research notes","textarea"]]){
   const l=el("label",txt);const x=el(tag);x.name=name;x.required=name!=="notes";x.maxLength=name==="notes"?1200:name==="title"?160:100;l.append(x);form.append(l)
  }
  const stageLabel=el("label","Stage"),sel=el("select");
  for(const n of ["research","draft","review","ready","published"]){const op=el("option",n);op.value=n;sel.append(op)}
  sel.name="stage";stageLabel.append(sel);form.append(stageLabel);
  const edit=el("input");edit.type="hidden";edit.name="id";form.append(edit);
  const save=button("Save editorial record",async()=>{
    const payload={kind:"editorial",id:edit.value,commander:form.elements.commander.value,title:form.elements.title.value,notes:form.elements.notes.value,action:sel.value};
    try{await mutate(payload,"publishing")}catch(e){panelStatus("publishing",e.message)}
  },"owner-v2-primary");form.append(save);node.append(form);
  titled(node,"Drafts & research");
  for(const r of d.drafts||[]){
   const c=el("article",null,"owner-v2-record");c.append(el("strong",r.commander+" — "+r.title),el("p","Stage: "+r.stage),el("p",r.notes||"No notes yet."));
   action(c,"Edit",async()=>{form.elements.id.value=r.id;form.elements.commander.value=r.commander;form.elements.title.value=r.title;form.elements.notes.value=r.notes;sel.value=r.stage;form.scrollIntoView({behavior:"smooth",block:"center"})});
   node.append(c)
  }
  if(!d.drafts?.length)message(node,"No editorial drafts created.");
  titled(node,"Approved nomination candidates");table(node,d.candidates,[["Commander","name"],["Nomination status","status"]]);
  links(node,[["Publishing checklist","https://github.com/Squackle/deep-cuts-edh/blob/main/docs/REPORT-PUBLISHING.md"]]);
 },
 games:(node,d)=>{
  message(node,d.note);
  titled(node,"Hive Run verified scores");table(node,d.hive,[["Mode","mode"],["Rules","rules_version"],["Runs","runs"],["Average","average_score"],["Best","best_score"],["Avg. evolutions","average_evolutions"]]);
  titled(node,"Daily puzzles · 30 days");table(node,[...(d.daily||[]),...(d.arcane||[])],[["Game","game"],["Recorded plays","plays"],["Wins","wins"],["Average score","average_score"]]);
  links(node,[["Hive Run lab","https://deep-cuts-game-lab.pages.dev/"]]);
 },
 integrity:(node,d)=>{
  message(node,d.note);
  titled(node,"Issued vs completed score sessions");table(node,d.sessions,[["Mode","mode"],["Rules","rules_version"],["Issued","issued"],["Used","completed"]]);
  titled(node,"Verified scores");table(node,d.scores,[["Mode","mode"],["Rules","rules_version"],["Verified","verified"]]);
 },
 schedule:(node,d)=>{
  message(node,"Latest records confirm content generation, not necessarily that every scheduled job ran successfully.");
  titled(node,"Cold Case / Obscurity Ladder");table(node,d.cold,[["Game","game"],["Latest day","latest_day"],["Cached days","cached_days"]]);
  titled(node,"Arcane Cipher / Conspiracy Board");table(node,d.arcane,[["Game","game"],["Latest day","latest_day"],["Cached days","cached_days"]]);
  titled(node,"Recent community challenges");table(node,d.challenge,[["Title","title"],["Commander","commander"],["Status","status"],["Closes","closes_at"]]);
  links(node,[["Cloudflare Workers schedules","https://dash.cloudflare.com/"],["GitHub Actions","https://github.com/Squackle/deep-cuts-edh/actions"]]);
 },
 site:(node,d)=>{
  message(node,"These counts come directly from production D1. Hosting availability, code deployment and edge errors are checked in Cloudflare and GitHub.");
  stats(node,d.records);titled(node,"Recent Ko-fi webhook events");table(node,d.webhook,[["Event","event_type"],["Class","classification"],["Received","received_at"]]);
  links(node,[["Cloudflare dashboard","https://dash.cloudflare.com/"],["Deployment checks","https://github.com/Squackle/deep-cuts-edh/actions"]]);
 },
 revenue:(node,d)=>{
  message(node,d.note);
  stats(node,d.summary);
  message(node,"AdSense approval and earnings are not currently available via a verified server integration.");
  links(node,[["Ko-fi","https://ko-fi.com/deepcutsedh"],["Google AdSense","https://www.google.com/adsense/"],["Ad-free guide","https://github.com/Squackle/deep-cuts-edh/blob/main/docs/KOFI-ADFREE.md"]]);
 },
 analytics:(node,d)=>{
  message(node,d.note);stats(node,d.activity);
  titled(node,"Evidence contributions by case");table(node,d.content,[["Case","case_slug"],["Research items","research_items"],["Featured","featured"]]);
  message(node,"Full visitor analytics and funnels require a separate privacy-reviewed analytics integration.");
 },
 features:(node,d)=>{
  message(node,"These two switches directly control NEW public submission requests. They do not hide existing pages, delete existing records, or disable browsing.");
  for(const flag of d.flags||[]){
   const c=el("article",null,"owner-v2-record");
   const display=flag.flag==="public_nominations"?"Nominations and voting":"New feedback submissions";
   c.append(el("strong",display),el("p",flag.enabled?"Accepting new submissions":"Paused — new submissions receive a clear response"));
   action(c,flag.enabled?"Pause submissions":"Resume submissions",()=>mutate({kind:"feature",id:flag.flag,enabled:!flag.enabled},"features"),true);node.append(c)
  }
  links(node,[["Deployment and other feature releases","https://github.com/Squackle/deep-cuts-edh/pulls"]]);
 },
 recovery:(node,d)=>{
  message(node,d.note);titled(node,"Confirmed database tables");table(node,d.tables,[["Table","name"]]);
  links(node,[["Cloudflare D1 backup and restore","https://dash.cloudflare.com/"],["Database operations guide","https://github.com/Squackle/deep-cuts-edh/blob/main/db/OPERATIONS.md"]]);
  message(node,"No database restoration, secret export, or deletion can be triggered from this dashboard.");
 },
 audit:(node,d)=>{titled(node,"Recent owner actions");table(node,d.audit||d.latest,[["Category","category"],["Action","action"],["Target","target"],["Time",r=>readableDate(r.occurred_at)]])}
};
const readers={moderation:"moderation",feedback:"feedback",publishing:"publishing",games:"games",integrity:"integrity",schedule:"schedule",site:"site",revenue:"revenue",analytics:"analytics",features:"features",recovery:"recovery",audit:"site"};
async function load(id){
 const code=readers[id];if(!code)return;
 const panel=spaces.get(id),area=panel?.querySelector(".owner-v2-data");
 if(!area)return;
 const serial=++requestSeq;panelStatus(id,"Loading…");
 try{
  const data=await api(code);
  if(active!==id||serial!==requestSeq)return;
  clear(area);renderers[id](area,data);panelStatus(id,"Updated from production data.");
 }catch(e){if(active===id)panelStatus(id,e.message)}
}
function staticPanel(id,text,linksArr){
 const area=spaces.get(id).querySelector(".owner-v2-data");
 message(area,text);links(area,linksArr);
}
staticPanel("sweep","Launch a safe security audit at any time. Choose Run workflow on the GitHub Actions page (select main), then download the sanitized security report artifact when it finishes. Checks include risky code patterns, server authorization guards, workflows, secret-shaped strings and anonymous Cloudflare Access redirects. Identity, payment and data-changing tests need separate staging review.",[
 ["Run security sweep","https://github.com/Squackle/deep-cuts-edh/actions/workflows/security-sweep.yml"],
 ["View previous reports","https://github.com/Squackle/deep-cuts-edh/actions/workflows/security-sweep.yml"],
 ["Full security checklist","https://github.com/Squackle/deep-cuts-edh/blob/main/docs/SECURITY-SWEEP-RUNBOOK.md"]
]);
staticPanel("seo","Search Console indexing and AdSense approval depend on Google. The tools below open their authoritative dashboards; this page does not invent search traffic or approval.",[
 ["Search Console","https://search.google.com/search-console"],["Sitemap","https://deep-cuts-edh.pages.dev/sitemap.xml"],["Robots","https://deep-cuts-edh.pages.dev/robots.txt"],["AdSense","https://www.google.com/adsense/"]
]);
const route=decodeURIComponent(location.hash.slice(1));
const found=groups.flatMap(([g,x])=>x.map(([id])=>({group:g,id}))).find(x=>x.id===route);
if(found)showTool(found.id,found.group);
else{const group=groups.find(([g])=>g.toLowerCase()===route);if(group)showGroup(group[0]);}
})();