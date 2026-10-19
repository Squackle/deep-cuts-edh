/* Pure rendering only: no recipient selection, cron, network access or sends.
 * The existing Google account-recovery mailer MUST NEVER send newsletters.
 * Do not call this from a scheduled worker until opt-in, suppression, verified
 * newsletter provider, physical postal footer and owner switch exist.
 */
const ORIGIN="https://deep-cuts-edh.pages.dev";
const esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
function publicURL(url){
 if(typeof url!=="string"||url.length>400)throw Error("Unapproved public URL");
 let u;try{u=new URL(url,ORIGIN)}catch{throw Error("Invalid link")}
 if(u.origin!==ORIGIN||u.username||u.password||u.hash)throw Error("Only public Deep Cuts EDH pages are allowed");
 if(!/^\/(?:reports\/[a-z0-9-]+|community(?:\?.*)?|games(?:\/[a-z0-9-/]+)?|matchmaker|nominations|deep-cut-finder|case-file)(?:\?.*)?$/.test(u.pathname+u.search))
  throw Error("Unapproved newsletter destination");
 return u.href;
}
function safeHeading(s,max=90){
 if(typeof s!=="string"||s.trim().length<3||s.length>max||/[\x00-\x1f]/.test(s))throw Error("Invalid published headline");
 return s.trim();
}
function story(s){
 if(!s||typeof s!=="object")throw Error("Invalid public story");
 return {title:safeHeading(s.title),url:publicURL(s.url)};
}
export function renderWeeklyDispatch({weekLabel,featured,stories=[],games=[],unsubscribeUrl,postalAddress,preview=false}){
 const week=safeHeading(weekLabel,65);
 if(!featured||typeof featured!=="object")throw Error("Featured published Commander is required");
 const lead=story(featured);
 if(!Array.isArray(stories)||stories.length>5||!Array.isArray(games)||games.length>7)throw Error("Content budget exceeded");
 const highlights=stories.map(story),arcade=games.map(story);
 if(highlights.length+arcade.length<1)throw Error("Refuse to generate empty newsletter issues");
 if(!preview){
  if(typeof unsubscribeUrl!=="string"||!/^https:\/\/deep-cuts-edh\.pages\.dev\/unsubscribe\?token=[A-Za-z0-9_-]{24,128}$/.test(unsubscribeUrl))
   throw Error("Real one-click unsubscribe URL required before sending");
  if(typeof postalAddress!=="string"||postalAddress.trim().length<12||postalAddress.length>230)
   throw Error("Public postal address is required before sending");
 }
 const unsub=preview?"(unsubscription link appears in real recipient emails)":unsubscribeUrl;
 const address=preview?"Mailing address will appear in opted-in delivery.":postalAddress.trim();
 const list=(items)=>items.map(s=>'<li style="margin:0 0 10px"><a style="color:#77582a;font-weight:700" href="'+esc(s.url)+'">'+esc(s.title)+'</a></li>').join("");
 const plain=(items)=>items.map(s=>"- "+s.title+" — "+s.url).join("\n");
 const subject="Deep Cuts EDH · Weekly Dispatch · "+week;
 const text=[
  "DEEP CUTS EDH — THE WEEKLY DISPATCH",week,"",
  "COMMANDER OF THE WEEK",lead.title,lead.url,"",
  ...(highlights.length?["FROM THE ARCHIVES",plain(highlights),""]:[]),
  ...(arcade.length?["ARCADE AND GAMES",plain(arcade),""]:[]),
  "You subscribed to Deep Cuts EDH Weekly Dispatch.",
  "Unsubscribe: "+unsub,address
 ].join("\n");
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(subject)+'</title></head>'+
 '<body style="margin:0;background:#122419;color:#f5eed7;font-family:Arial,sans-serif">'+
 '<div style="max-width:620px;margin:auto;padding:28px 22px">'+
 '<p style="color:#d5bd85;font-size:12px;letter-spacing:2px">DEEP CUTS EDH / FIELD DISPATCH</p>'+
 '<h1 style="font-size:34px;font-family:Georgia,serif;margin:0 0 12px">The Weekly Dispatch</h1>'+
 '<p style="color:#bdcdbd;font-size:14px">'+esc(week)+'</p>'+
 '<div style="background:#f1e9d6;color:#183426;border:1px solid #aa945f;padding:23px;border-radius:5px;margin-top:25px">'+
 '<p style="color:#806636;font-size:11px;font-weight:800">COMMANDER OF THE WEEK</p>'+
 '<h2 style="font-family:Georgia,serif">'+esc(lead.title)+'</h2>'+
 '<p><a style="color:#355c3e" href="'+esc(lead.url)+'">Open the investigation ↗</a></p>'+
 (highlights.length?'<h3>From the Archives</h3><ul style="padding-left:20px">'+list(highlights)+'</ul>':"")+
 (arcade.length?'<h3>Arcade and Games</h3><ul style="padding-left:20px">'+list(arcade)+'</ul>':"")+
 '</div><p style="color:#c6d3c4;font-size:12px;line-height:1.6;margin-top:22px">You requested these weekly emails. <a style="color:#e5cd96" href="'+esc(preview?ORIGIN+"/privacy":unsub)+'">Unsubscribe</a> whenever you like.</p>'+
 '<p style="color:#b0c2b2;font-size:11px">'+esc(address)+'</p>'+
 '</div></body></html>';
 return {subject,html,text,preview:Boolean(preview)};
}
