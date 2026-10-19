import {validCommander} from "./deep-tools-core.js";
const $=id=>document.getElementById(id);
let busy=false,current=null;
const safe=(value,max)=>String(value||"").trim().slice(0,max);
const msg=(value,error=false)=>{const el=$("cfStatus");el.textContent=value;el.dataset.error=error?"true":"false"};
const currentKind=()=>document.querySelector('input[name="kind"]:checked').value;
function setKind(){
 const deck=currentKind()==="deck";
 $("cfQueryLabel").textContent=deck?"PUBLISHED DECK ID":"EXACT COMMANDER NAME";
 $("cfQuery").maxLength=deck?32:130;
 $("cfQuery").placeholder=deck?"32-character public deck ID":"e.g. Toshiro Umezawa";
 $("cfQuery").value="";
}
document.querySelectorAll('input[name="kind"]').forEach(r=>r.addEventListener("change",setKind));
async function lookupCommander(name){
 if(name.length<2||name.length>130)return Promise.reject(Error("Enter a valid Commander card name."));
 const res=await fetch("/api/tool-cards",{method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({names:[name]}),credentials:"same-origin",cache:"no-store"});
 const data=await res.json().catch(()=>null);
 if(!res.ok||!Array.isArray(data?.cards))throw Error(data?.error||"The public Commander card lookup is unavailable.");
 const c=data.cards.find(c=>c.name?.toLowerCase()===name.toLowerCase());
 if(!c||!validCommander(c))throw Error("That exact name is not a verified Commander-legal card. Check the spelling and try again.");
 return {kind:"commander",title:safe(c.name,130),subtitle:"A legendary Commander to investigate",byline:"Legal Commander card · Current card record",source:"Scryfall"};
}
async function lookupDeck(id){
 if(!/^[0-9a-f]{32}$/i.test(id))throw Error("Enter a 32-character public Community deck ID.");
 const res=await fetch("/api/community?action=deck&id="+encodeURIComponent(id),{credentials:"omit",cache:"no-store"});
 const data=await res.json().catch(()=>null);
 if(!res.ok||!data?.deck)throw Error("Could not find a published public Community deck with that ID.");
 const d=data.deck;
 if(d.id!==id||typeof d.title!=="string"||typeof d.handle!=="string"||typeof d.commander!=="string")
  throw Error("The public deck response was incomplete.");
 return {kind:"deck",title:safe(d.title,90),subtitle:safe(d.commander,130),byline:"Published by @"+safe(d.handle,24),source:"Deep Cuts Community"};
}
const canvas=$("cfCanvas");
function wrap(ctx,text,maxWidth,maxLines=2){
 const words=text.split(/\s+/).filter(Boolean),out=[];let line="";
 for(const word of words){
  if(!line){line=word;continue}
  if(ctx.measureText(line+" "+word).width>maxWidth){out.push(line);line=word}
  else line+=" "+word;
 }
 if(line)out.push(line);
 if(out.length>maxLines){const rest=out.slice(maxLines-1).join(" ");out.length=maxLines;let tail=rest;
  while(tail.length&&ctx.measureText(tail+"…").width>maxWidth)tail=tail.slice(0,-1);
  out[maxLines-1]=tail+"…";
 }
 return out;
}
function draw(data){
 const ctx=canvas.getContext("2d",{alpha:false});
 if(!ctx)throw Error("This browser cannot render the preview.");
 const {width:w,height:h}=canvas;
 const bg=ctx.createLinearGradient(0,0,w,h);
 bg.addColorStop(0,"#253f2e");bg.addColorStop(.6,"#152b20");bg.addColorStop(1,"#091910");
 ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 // An original illustrative field-grid, no third-party card art to taint PNGs.
 ctx.save();ctx.strokeStyle="#8b9c7936";ctx.lineWidth=2;
 for(let x=40;x<w;x+=50){ctx.beginPath();ctx.moveTo(x,40);ctx.lineTo(x,h-40);ctx.stroke()}
 for(let y=40;y<h;y+=50){ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(w-40,y);ctx.stroke()}
 ctx.restore();
 ctx.strokeStyle="#d3b977";ctx.lineWidth=5;ctx.strokeRect(35,35,w-70,h-70);
 ctx.strokeStyle="#708961";ctx.lineWidth=1.4;ctx.strokeRect(54,54,w-108,h-108);
 ctx.fillStyle="#e7ce92";ctx.font="bold 27px ui-sans-serif,system-ui";
 ctx.fillText("DEEP CUTS   EDH",94,122);
 ctx.font="bold 19px ui-monospace,monospace";ctx.fillStyle="#acc6ab";
 ctx.fillText(data.kind==="deck"?"COMMUNITY / PUBLISHED DECK":"ARCHIVE / COMMANDER IDEA",94,180);
 let size=70,rows=[];
 do{
  ctx.font="bold "+size+"px Georgia,serif";
  rows=wrap(ctx,data.title,980,2);
  if(rows.some(x=>ctx.measureText(x).width>980))size-=3;
  else break;
 }while(size>38);
 ctx.fillStyle="#f9efcf";
 for(let i=0;i<rows.length;i++)ctx.fillText(rows[i],94,295+i*(size+10));
 const subY=Math.max(360,295+rows.length*(size+10)+15);
 ctx.font="500 29px ui-sans-serif,system-ui";ctx.fillStyle="#e0c689";
 const subtitles=wrap(ctx,data.subtitle,960,2);
 for(let i=0;i<subtitles.length;i++)ctx.fillText(subtitles[i],94,subY+i*39);
 ctx.strokeStyle="#d3b977";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(94,515);ctx.lineTo(1106,515);ctx.stroke();
 ctx.font="bold 19px ui-sans-serif,system-ui";ctx.fillStyle="#d8e4cd";ctx.fillText(data.byline,94,555);
 ctx.font="bold 20px ui-monospace,monospace";ctx.fillStyle="#e7ce92";
 ctx.textAlign="right";ctx.fillText("deep-cuts-edh.pages.dev",1106,557);ctx.textAlign="left";
 canvas.setAttribute("aria-label","Deep Cuts EDH "+data.kind+" social image for "+data.title);
 canvas.hidden=false;$("cfPlaceholder").hidden=true;
}
function linkFor(kind,key){
 const url=new URL("/case-file",location.origin);url.searchParams.set(kind,key);return url.href;
}
function filename(data){return "deep-cuts-"+data.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,45)+".png"}
async function generate(kind,key){
 if(busy)return;busy=true;$("cfGenerate").disabled=true;$("cfActions").hidden=true;
 msg("Verifying public "+(kind==="deck"?"deck":"Commander card")+" data…");
 try{
  const data=kind==="deck"?await lookupDeck(key):await lookupCommander(key);
  draw(data);
  current={kind,key:kind==="deck"?key:data.title,data};
  $("cfActions").hidden=false;
  msg("Public "+(kind==="deck"?"deck":"Commander")+" case file ready. Download the artwork or copy a link.");
  history.replaceState(null,"",new URL(linkFor(kind,current.key)).pathname+new URL(linkFor(kind,current.key)).search);
 }catch(e){current=null;canvas.hidden=true;$("cfPlaceholder").hidden=false;msg(e?.message||"Couldn't create your case file.",true)}
 finally{busy=false;$("cfGenerate").disabled=false}
}
$("cfForm").addEventListener("submit",e=>{e.preventDefault();generate(currentKind(),$("cfQuery").value.trim())});
$("cfDownload").addEventListener("click",()=>{
 if(!current)return;
 canvas.toBlob(blob=>{
  if(!blob){msg("PNG export is unsupported in this browser.",true);return}
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename(current.data);document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 },"image/png");
});
$("cfCopy").addEventListener("click",async()=>{
 if(!current)return;
 const link=linkFor(current.kind,current.key);
 try{await navigator.clipboard.writeText(link);msg("Case file link copied. Anyone with it can view this public discovery.")}
 catch{$("cfStatus").replaceChildren(document.createTextNode("Copy this link: "));const input=document.createElement("input");input.value=link;input.readOnly=true;$("cfStatus").append(input);input.select();}
});
const params=new URLSearchParams(location.search),commander=params.get("commander"),deck=params.get("deck");
if(commander&&commander.length<=130){$("cfQuery").value=commander;generate("commander",commander)}
else if(deck&&/^[0-9a-f]{32}$/i.test(deck)){
 document.querySelector('input[name="kind"][value="deck"]').checked=true;
 setKind();$("cfQuery").value=deck;generate("deck",deck);
}
