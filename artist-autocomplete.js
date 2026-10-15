/* Accessible artist combobox. List never includes the full artist catalog. */
import {setArtistFilter,selectedArtist} from "./library-facets.js";
export function initArtistAutocomplete(){
 const input=document.getElementById("artistInput"),list=document.getElementById("artistOptions");
 const message=document.getElementById("artistStatus"),clear=document.getElementById("artistClear");
 if(!input||!list||!clear)return;
 let items=[],active=-1,timeout=null,request=0,controller=null;
 const close=()=>{
  list.hidden=true;list.replaceChildren();items=[];active=-1;
  input.setAttribute("aria-expanded","false");
  input.removeAttribute("aria-activedescendant");
 };
 const abort=()=>{clearTimeout(timeout);request++;controller?.abort();controller=null};
 const sync=()=>{clear.hidden=!input.value.trim()};
 const refreshActive=()=>{
  [...list.querySelectorAll('[role="option"]')].forEach((b,i)=>{
   b.setAttribute("aria-selected",String(i===active));
   if(i===active)b.scrollIntoView({block:"nearest"});
  });
  if(active>=0)input.setAttribute("aria-activedescendant","artistOption"+active);
  else input.removeAttribute("aria-activedescendant");
 };
 const choose=name=>{
  abort();close();
  // An artist-specific search is about the illustrations; respect an
  // existing explicit choice of All Printings or Unique Artworks.
  const prints=document.getElementById("printingFilter");
  if(prints?.value==="cards")prints.value="art";
  setArtistFilter(name);
  message.textContent="Artist selected: "+name+". Showing distinct artworks.";
  sync();
  input.focus();
 };
 const show=matches=>{
  close();
  items=matches.filter(x=>typeof x==="string"&&x.length<=100).slice(0,8);
  if(!items.length){message.textContent="No matching artists. Check the spelling or try a shorter name.";return}
  for(const [i,name] of items.entries()){
   const option=document.createElement("button");
   option.type="button";option.className="dc-artist-option";option.role="option";
   option.id="artistOption"+i;option.textContent=name;
   option.setAttribute("aria-selected","false");
   option.addEventListener("pointerdown",e=>e.preventDefault());
   option.addEventListener("click",()=>choose(name));
   list.append(option);
  }
  list.hidden=false;input.setAttribute("aria-expanded","true");
  message.textContent=items.length+" artist suggestion"+(items.length===1?"":"s")+". Use arrow keys to choose.";
 };
 const suggest=async()=>{
  const q=input.value.trim(),serial=++request;
  controller?.abort();controller=null;
  if(q.length<2){close();message.textContent="Type at least two letters to find an illustrator.";return}
  message.textContent="Finding artists…";
  controller=new AbortController();
  try{
   const res=await fetch("/api/artist-suggest?q="+encodeURIComponent(q),{
    credentials:"omit",cache:"default",signal:controller.signal,
    headers:{"Accept":"application/json"}});
   if(!res.ok)throw Error("Unavailable");
   const result=await res.json();
   if(serial!==request||input.value.trim()!==q)return;
   show(Array.isArray(result.suggestions)?result.suggestions:[]);
  }catch(err){
   if(serial!==request||err.name==="AbortError")return;
   close();
   message.textContent='Suggestions unavailable. You can search with a:"artist name" in the main search box.';
  }
 };
 input.addEventListener("input",()=>{
  abort();close();sync();
  if(selectedArtist())setArtistFilter("",{preserveInput:true,search:false});
  if(input.value.trim().length>=2)timeout=setTimeout(suggest,240);
  else message.textContent="Type at least two letters to find an illustrator.";
 });
 input.addEventListener("keydown",e=>{
  if(e.key==="Escape"){abort();close();return}
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
   if(list.hidden)return;
   e.preventDefault();
   active=(active+(e.key==="ArrowDown"?1:-1)+items.length)%items.length;
   refreshActive();
   return;
  }
  if(e.key==="Enter"){
   // Never treat the unselected artist text as a committed name.
   e.preventDefault();
   if(!list.hidden&&items.length)choose(items[active>=0?active:0]);
   else if(!selectedArtist())message.textContent="Choose an artist from the suggestions first.";
  }
 });
 input.addEventListener("blur",()=>{setTimeout(()=>{
  if(!list.contains(document.activeElement))close();
 },120)});
 document.addEventListener("pointerdown",e=>{
  if(!input.closest(".dc-artist-filter").contains(e.target))close();
 });
 clear.addEventListener("click",()=>{
  abort();close();setArtistFilter("");
  message.textContent="Artist filter cleared.";sync();input.focus();
 });
 document.addEventListener("deepcuts:artist-clear",()=>{
  abort();close();message.textContent="Artist filter cleared.";sync();
 });
 document.getElementById("libraryReset")?.addEventListener("click",()=>{abort();close();sync();message.textContent=""});
 document.getElementById("browseAll")?.addEventListener("click",()=>{abort();close();sync();message.textContent=""});
 document.querySelectorAll("[data-library-preset]").forEach(b=>b.addEventListener("click",()=>{
  abort();close();sync();message.textContent="";
 }));
 input.addEventListener("focus",()=>{if(selectedArtist())message.textContent="Artist selected. Edit to search for another.";});
 sync();
 if(selectedArtist())message.textContent="Artist selected: "+selectedArtist()+".";
}
