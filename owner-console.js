// Private owner console. Bearer credential is read from the input and never stored.
(()=>{
 const $=id=>document.getElementById(id);
 const wrap=$("ownerTable"),status=$("ownerConsoleStatus");
 let view="profiles",page=0,loading=false;
 const node=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined&&value!==null)n.textContent=String(value);return n};
 const message=s=>{status.textContent=s};
 const key=()=>document.getElementById("opsForm").elements.operatorKey.value.trim();
 const pretty=s=>String(s||"").replace(/_/g," ");
 const date=(v,unix=false)=>{
  if(!v)return "—";
  const d=unix?new Date(Number(v)*1000):new Date(String(v).replace(" ","T")+"Z");
  return Number.isNaN(d.valueOf())?"—":d.toLocaleString();
 };
 const short=id=>id?String(id).slice(0,8)+"…":"—";
 async function call(view,body,query={}){
  const k=key();if(!/^dcissuer1_[a-f0-9]{64}$/.test(k))throw Error("Enter your private owner key in the field above.");
  const url=new URL("/api/owner-members",location.href),headers={Authorization:"Bearer "+k};
  let opts={headers,cache:"no-store",credentials:"same-origin"};
  if(body!==undefined){opts.method="POST";headers["Content-Type"]="application/json";opts.body=JSON.stringify(body)}
  else{url.searchParams.set("view",view);Object.entries(query).forEach(([k,v])=>url.searchParams.set(k,String(v)))}
  const r=await fetch(url,opts),data=await r.json();if(!r.ok)throw Error(data.error||"Owner request failed.");
  return data;
 }
 function table(columns,rows,decorate){
  wrap.replaceChildren();if(!rows.length){wrap.append(node("p","No records found."));return}
  const tab=node("table"),thead=node("thead"),header=node("tr");
  for(const [label] of columns)header.append(node("th",label));thead.append(header);tab.append(thead);
  const tbody=node("tbody");
  rows.forEach(row=>{
   const tr=node("tr");for(const [,field] of columns){const td=node("td",typeof field==="function"?field(row):row[field]);tr.append(td)}
   if(decorate){const td=node("td");decorate(td,row);tr.append(td)}tbody.append(tr)
  });tab.append(tbody);wrap.append(tab);
 }
 function actionButton(container,text,handler,critical=false){
  const btn=node("button",text);btn.type="button";if(critical)btn.className="danger";
  btn.addEventListener("click",async()=>{btn.disabled=true;try{await handler()}catch(e){message(e.message)}finally{btn.disabled=false}});
  container.append(btn);
 }
 function showIssued(data){
  $("issuedKey").textContent=data.key;$("issuedKeySection").hidden=false;
  $("issuedKeySection").scrollIntoView({behavior:"smooth",block:"start"});
  message("New "+data.tier+" complimentary credential created. Its plaintext appears exactly once; save it, then clear it from the screen.");
 }
 async function changeGrant(action,row,days){
  if(!["complimentary"].includes(row.source))throw Error("Only complimentary grants can be edited here.");
  if(action==="revoke"&&!confirm("Revoke "+row.label+" and immediately invalidate its active devices?"))return;
  if(action==="rotate"&&!confirm("Replace "+row.label+"'s key and revoke all its device tokens? Save the new key for the recipient."))return;
  let req={action,memberId:row.id};
  if(action==="extend"){const n=Number(prompt("Set access for how many days from today (1–365)?","30"));if(!Number.isInteger(n)||n<1||n>365)throw Error("Enter a duration between 1 and 365 days.");req.days=n}
  const x=await call(null,req);
  if(x.key)showIssued(x);
  else message(action==="revoke"?"Access revoked and device sessions disabled.":"Expiry updated to "+date(x.expiresAt,true)+".");
  await load();
 }
 function renderList(data){
  $("ownerPageLabel").textContent="Page "+(page+1);
  if(view==="profiles"){
   table([["Username",r=>"@"+r.handle],["Joined",r=>date(r.created_at)],["Decks",r=>r.decks],["Comments",r=>r.comments],["Field tests",r=>r.playtests],["Recovery email",r=>r.recovery_verified?"Verified":r.recovery_pending?"Pending confirmation":"Not connected"]],data.profiles||[]);
   $("ownerNext").disabled=(data.profiles||[]).length<50;return;
  }
  if(view==="audit"){
   table([["Action",r=>pretty(r.action)],["Member ID",r=>short(r.member_id)],["Tier",r=>r.tier],["When",r=>date(r.event_time,true)],["Notes",r=>r.detail]],data.events||[]);
   $("ownerNext").disabled=true;return;
  }
  const entries=data.members||[];
  const cols=[["Member",r=>r.label],["Source",r=>r.source],["Tier",r=>pretty(r.tier)],["Status",r=>r.active?"Active":"Inactive / expired"],["Expires",r=>date(r.expiresAt,true)],["Devices",r=>r.devices+"/2"],["Last used",r=>date(r.lastSeen,true)],["Actions",r=>""]];
  wrap.replaceChildren();
  if(!entries.length){wrap.append(node("p","No membership records found."));return}
  const tab=node("table"),thead=node("thead"),hr=node("tr");
  cols.forEach(c=>hr.append(node("th",c[0])));thead.append(hr);tab.append(thead);const tbody=node("tbody");
  for(const r of entries){
   const tr=node("tr");
   const values=[r.label,r.source,pretty(r.tier),r.active?"Active":"Inactive / expired",date(r.expiresAt,true),r.devices+"/2",date(r.lastSeen,true)];
   values.forEach(v=>tr.append(node("td",v)));
   const cell=node("td");if(r.source==="complimentary"){
    const controls=node("div");controls.className="member-actions";
    if(!r.revoked){
     actionButton(controls,r.active?"EXTEND":"RENEW EXPIRED",()=>changeGrant("extend",r));
     actionButton(controls,"ROTATE KEY",()=>changeGrant("rotate",r));
     actionButton(controls,"REVOKE",()=>changeGrant("revoke",r),true);
    }else controls.append(node("span","Revoked"));
    cell.append(controls);
   }else cell.textContent="—";
   tr.append(cell);tbody.append(tr);
  }
  tab.append(tbody);wrap.append(tab);
  $("ownerNext").disabled=entries.length<50;
 }
 async function load(){
  if(loading)return;loading=true;$("ownerRefresh").disabled=true;
  try{message("Loading private records…");const [overview,records]=await Promise.all([call("overview"),call(view,undefined,{page})]);
   const stats=$("ownerStats");stats.replaceChildren();
   const labels=[["Profiles",overview.stats.community_profiles],["Verified emails",overview.stats.verified_recovery_emails],["Pending emails",overview.stats.pending_recovery_emails],["Public decks",overview.stats.public_decks],["Memberships",overview.stats.membership_records],["Free grants active",overview.stats.active_complimentary],["Ko-fi linked",overview.stats.kofi_linked],["Device sessions",overview.stats.activated_devices]];
   for(const [k,v] of labels){const box=node("div");box.className="owner-stat";box.append(node("strong",v),node("span",k));stats.append(box)}
   renderList(records);message("Private records loaded. No recovery keys or plaintext email addresses are exposed.");
  }catch(e){message(e.message);wrap.replaceChildren(node("p","Unable to load private records."))}
  finally{loading=false;$("ownerRefresh").disabled=false}
 }
 $("ownerRefresh").addEventListener("click",load);
 for(const b of document.querySelectorAll("[data-owner-view]"))b.addEventListener("click",()=>{
  view=b.dataset.ownerView;page=0;
  document.querySelectorAll("[data-owner-view]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  load();
 });
 $("ownerPrev").addEventListener("click",()=>{if(page>0){page--;load()}});
 $("ownerNext").addEventListener("click",()=>{if(page<200){page++;load()}});
 $("complimentaryForm").addEventListener("submit",async e=>{
  e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type="submit"]');
  if(!form.reportValidity())return;
  button.disabled=true;
  try{
   const data=await call(null,{action:"grant",label:form.elements.label.value.trim(),tier:form.elements.tier.value,days:Number(form.elements.days.value)});
   showIssued(data);form.reset();await load();
  }catch(e){message(e.message)}finally{button.disabled=false}
 });
})();
