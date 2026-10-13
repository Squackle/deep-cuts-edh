import {$,state,el,msg} from "./community.js";
import {fieldGet,fieldPost,dateLabel,emptyNotice,showFieldError} from "./field-client.js";
const ICONS={mention:"@",deck_reply:"🩺",case_update:"🔎",follow:"★",evidence_vote:"💎",challenge_vote:"🏅",featured:"🏆"};
const safeTarget=x=>/^community\.html\?(?:case|deck|profile|evidence)=[A-Za-z0-9_%-]+(?:&[A-Za-z0-9_%-]+)*$/.test(x||"")?x:"community.html#dispatches";
export async function refreshDispatchBadge(){
 const count=$("dispatchUnread");if(!count)return;
 if(!state.me){count.hidden=true;count.textContent="";return}
 try{
  const data=await fieldGet("dispatches");
  count.hidden=!data.unread;count.textContent=data.unread>99?"99+":String(data.unread);
 }catch{count.hidden=true}
}
export async function loadDispatches(){
 const root=$("dispatchList");
 if(!state.me){
  return emptyNotice(root,"Sign in to receive and read your private Field Dispatches.");
 }
 root.replaceChildren(el("p","Retrieving dispatches…","cm-note"));
 try{
  const data=await fieldGet("dispatches");
  const badge=$("dispatchUnread");badge.hidden=!data.unread;badge.textContent=data.unread>99?"99+":String(data.unread);
  root.replaceChildren();
  if(!data.items?.length)return emptyNotice(root,"No dispatches yet. Follow case files or publish a deck to join the conversation.");
  for(const d of data.items){
   const article=el("article",null,"cm-card field-dispatch"+(d.read_at?"":" field-dispatch-new"));
   const heading=el("div",null,"field-rank-line");
   heading.append(el("span",(ICONS[d.kind]||"✉")+" "+d.headline));
   if(!d.read_at)heading.append(el("span","NEW","field-unread"));
   article.append(heading,el("p",dateLabel(d.created_at)+" · "+d.kind.replaceAll("_"," "),"cm-note"));
   const controls=el("div",null,"cm-actions");
   const open=el("a","OPEN DISPATCH ↗","cm-btn cm-outline");open.href=safeTarget(d.target);
   open.addEventListener("click",async event=>{
    if(d.read_at)return;
    event.preventDefault();
    try{await fieldPost("dispatch_read",{id:d.id})}catch{}
    location.href=open.href;
   });
   controls.append(open);
   if(!d.read_at){
    const read=el("button","MARK READ","cm-btn cm-outline");read.type="button";
    read.addEventListener("click",async()=>{try{await fieldPost("dispatch_read",{id:d.id});await loadDispatches()}catch(e){msg(e.message,true)}});
    controls.append(read);
   }
   article.append(controls);root.append(article);
  }
 }catch(e){showFieldError(root,e)}
}
export function initDispatches(){
 $("dispatchRefresh").addEventListener("click",loadDispatches);
 $("dispatchReadAll").addEventListener("click",async()=>{
  try{
   if(!state.me)throw Error("Sign in first.");
   await fieldPost("dispatch_read",{all:true});await loadDispatches();msg("All Field Dispatches marked as read.");
  }catch(e){msg(e.message,true)}
 });
}
