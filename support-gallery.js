/* Only approved public showcase and opt-in credit submissions appear here. */
(()=>{"use strict";
const area=document.getElementById("supportGalleryEntries");if(!area)return;
fetch("/api/supporter-gallery",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error("Unavailable");return r.json()}).then(d=>{
 const items=d.entries||[];area.replaceChildren();
 if(!items.length){area.textContent="The first public supporter investigations will appear here after review.";return}
 for(const item of items){
  const div=document.createElement("div");div.className="support-gallery-entry";
  const label=document.createElement("strong");label.textContent=item.category==="credit"?"CREDITED INVESTIGATOR":"SUPPORTER DECK FILE";
  const body=document.createElement("p");body.textContent=item.description;
  div.append(label,body);area.append(div);
 }
}).catch(()=>{area.textContent="The community showcase is temporarily unavailable."});
})();