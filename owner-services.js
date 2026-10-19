/* Owner Command Center: editorially curated external service shortcuts.
 * External navigation only. No owner credentials, tokens, analytics or API calls.
 * Favicon requests are lazy and never include a referring owner URL.
 */
(()=>{
"use strict";
const home=document.querySelector(".owner-v2-home");
const panel=document.getElementById("owner-panel-services");
const area=panel?.querySelector(".owner-v2-data");
if(!home||!area)return;
const groups=[
 {title:"Search & Google",items:[
  ["Search Console","Indexing, search terms and inspections","https://search.google.com/search-console","search.google.com"],
  ["Search Console Insights","Search performance and trending content","https://search.google.com/search-console/insights","search.google.com"],
  ["PageSpeed Insights","Mobile speed and Core Web Vitals","https://pagespeed.web.dev/","pagespeed.web.dev"],
  ["Google AdSense","Ad approval and earnings","https://adsense.google.com/","adsense.google.com"],
  ["Google Analytics","Analytics dashboard, if configured","https://analytics.google.com/","analytics.google.com"],
  ["Rich Results Test","Validate structured data","https://search.google.com/test/rich-results","search.google.com"],
  ["Google SEO Guide","Official search optimization guidance","https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=en","developers.google.com"]
 ]},
 {title:"Hosting & code",items:[
  ["Cloudflare Pages","Deployments, domains and usage","https://dash.cloudflare.com/","cloudflare.com"],
  ["GitHub repository","Site code, issues and pull requests","https://github.com/Squackle/deep-cuts-edh","github.com"],
  ["GitHub Actions","Builds and security checks","https://github.com/Squackle/deep-cuts-edh/actions","github.com"],
  ["Game Lab","Game development repository","https://github.com/Squackle/deep-cuts-game-lab-","github.com"]
 ]},
 {title:"Publishing & community",items:[
  ["follow.it","Commander Rescue Report subscribers","https://follow.it/deep-cuts-edh-commander-rescue-reports?leanpub","follow.it"],
  ["Ko-fi","Memberships and supporter income","https://ko-fi.com/manage","ko-fi.com"],
  ["ChatGPT","Research and site development","https://chatgpt.com/","chatgpt.com"],
  ["Scryfall","Card data and Oracle search","https://scryfall.com/","scryfall.com"]
 ]}
];
function node(tag,cls,value){
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(value!==undefined)e.textContent=value;return e;
}
function card(item,compact=false){
 const [name,description,url,domain]=item;
 const link=node("a",compact?"owner-service-card owner-service-card-compact":"owner-service-card");
 link.href=url;link.target="_blank";link.rel="noopener noreferrer";
 link.referrerPolicy="no-referrer";
 link.setAttribute("aria-label","Open "+name+" in a new tab");
 const icon=node("span","owner-service-icon");
 icon.setAttribute("aria-hidden","true");
 icon.textContent=name.slice(0,1);
 const img=document.createElement("img");
 img.alt="";img.width=38;img.height=38;
 img.loading="lazy";img.decoding="async";img.referrerPolicy="no-referrer";
 img.src="https://www.google.com/s2/favicons?domain="+encodeURIComponent(domain)+"&sz=64";
 img.addEventListener("error",()=>{img.style.display="none";},{once:true});
 icon.append(img);
 const copy=node("span","owner-service-copy");
 copy.append(node("strong","",name));
 if(!compact)copy.append(node("small","",description));
 link.append(icon,copy,node("span","owner-service-out","↗"));
 return link;
}
area.replaceChildren();
area.append(node("p","owner-v2-muted","Jump to the official services used to operate Deep Cuts EDH. Links open in a new tab and do not grant access or share your owner key. Google Analytics is only relevant if separately configured."));
for(const group of groups){
 const section=node("section","owner-service-group");
 section.append(node("h3","",group.title));
 const grid=node("div","owner-service-grid");
 for(const item of group.items)grid.append(card(item));
 section.append(grid);area.append(section);
}
const quick=node("section","owner-service-quick");
quick.setAttribute("aria-label","Quick links to external services");
quick.append(node("h3","","SITE TOOLS"));
const quickRow=node("div","owner-service-quick-grid");
const quickNames=new Set(["Search Console","PageSpeed Insights","Google AdSense","follow.it","Cloudflare Pages","GitHub repository","ChatGPT"]);
for(const group of groups)for(const item of group.items)if(quickNames.has(item[0]))quickRow.append(card(item,true));
quick.append(quickRow);
const tiles=home.querySelector(".owner-v2-tiles");
if(tiles)home.insertBefore(quick,tiles);
})();