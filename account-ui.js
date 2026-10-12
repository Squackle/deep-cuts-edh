/* Deep Cuts authenticated deck shelf. Uses HttpOnly cookie; never stores password locally. */
import {readDeck} from "./shared.js";
const $=id=>document.getElementById(id);
let user=null,captcha=null,token="",decks=[];
const msg=s=>{$("accountStatus").textContent=s};
async function request(action,body={}){
 const r=await fetch("/api/account",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...body}),credentials:"same-origin"});
 const data=await r.json();if(!r.ok)throw Error(data.error||"Account request failed.");return data;
}
function display(){
 $("accountGuest").hidden=!!user;$("accountSigned").hidden=!user;
 if(user){$("accountGreeting").textContent="Signed in as "+user;renderShelf();}
}
function renderShelf(){
 const select=$("accountDeckList"),existing=select.value;select.replaceChildren();
 const first=document.createElement("option");first.value="";first.textContent="Choose a saved cloud deck";select.append(first);
 for(const d of decks){const opt=document.createElement("option");opt.value=d.name;opt.textContent=d.name+" · "+(d.updated_at||"").slice(0,10);select.append(opt)}
 if(decks.some(x=>x.name===existing))select.value=existing;
}
async function refresh(){
 try{
  const r=await fetch("/api/account",{credentials:"same-origin",cache:"no-store"});
  const data=await r.json();if(!r.ok)throw Error(data.error||"Account service unavailable.");
  user=data.authenticated?data.username:null;decks=data.decks||[];display();
  if(user)msg("Cloud shelf ready · "+decks.length+" saved "+(decks.length===1?"deck":"decks")+".");
 }catch(e){msg(e.message)}
}
async function prepareCaptcha(){
 const holder=$("accountCaptcha");
 if(captcha!==null){window.turnstile?.reset(captcha);token="";return}
 if(!window.turnstile?.render){
  await new Promise((ok,fail)=>{
   const prev=document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
   if(prev){
    let count=0;const interval=setInterval(()=>{if(window.turnstile?.render){clearInterval(interval);ok()}else if(++count>80){clearInterval(interval);fail(Error("Verification blocked."))}},100);return;
   }
   const s=document.createElement("script");s.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";s.async=true;s.onload=ok;s.onerror=()=>fail(Error("Verification blocked."));document.head.append(s);
  });
 }
 captcha=window.turnstile.render(holder,{sitekey:"0x4AAAAAAFU5c2gIVJQkigt0",theme:"light",callback:x=>{token=x},"expired-callback":()=>{token=""}});
}
$("accountRegisterToggle")?.addEventListener("click",async()=>{
 $("accountCreate").hidden=!$("accountCreate").hidden;
 if(!$("accountCreate").hidden){msg("Complete verification to create an account.");try{await prepareCaptcha()}catch(e){msg(e.message)}}
});
$("accountLogin")?.addEventListener("click",async()=>{
 const btn=$("accountLogin");btn.disabled=true;msg("Signing in…");
 try{const data=await request("login",{username:$("accountUsername").value,password:$("accountPassword").value});
  user=data.username;$("accountPassword").value="";await refresh();}
 catch(e){msg(e.message)}finally{btn.disabled=false}
});
$("accountRegister")?.addEventListener("click",async()=>{
 if(!token){msg("Complete human verification first.");return}
 const btn=$("accountRegister");btn.disabled=true;msg("Creating account…");
 try{
  const data=await request("register",{username:$("accountUsername").value,password:$("accountPassword").value,token});
  user=data.username;$("accountPassword").value="";$("accountCreate").hidden=true;await refresh();
 }catch(e){msg(e.message);if(captcha!==null)window.turnstile.reset(captcha);token=""}
 finally{btn.disabled=false}
});
$("accountLogout")?.addEventListener("click",async()=>{
 try{await request("logout");user=null;decks=[];display();msg("Signed out on this browser.")}catch(e){msg(e.message)}
});
$("accountSave")?.addEventListener("click",async()=>{
 const deck=readDeck(),name=$("accountDeckName").value.trim(),button=$("accountSave");
 if(!deck.commanders?.length||!deck.cards?.length){msg("Add and analyze your Commander deck first.");return}
 if(!name){msg("Enter a name for this deck.");return}
 if(decks.some(x=>x.name===name)&&!confirm("Overwrite "+name+" in your cloud account?"))return;
 button.disabled=true;msg("Saving…");
 try{
  await request("save",{name,deck:{commanders:deck.commanders,cards:deck.cards.map(x=>({name:x.name,qty:x.qty})),targetBracket:deck.targetBracket}});
  await refresh();$("accountDeckList").value=name;msg("Saved "+name+" to your cloud shelf.");
 }catch(e){msg(e.message)}finally{button.disabled=false}
});
$("accountLoad")?.addEventListener("click",async()=>{
 const name=$("accountDeckList").value;if(!name){msg("Select a cloud deck.");return}
 if(!confirm("Replace your current draft with "+name+"?"))return;
 try{
  const r=await request("load",{name}),deck={...r.deck,cards:r.deck.cards.map(c=>({...c,card:null}))};
  window.dispatchEvent(new CustomEvent("deepcuts:loadsnapshot",{detail:{deck}}));
  $("accountDeckName").value=name;msg("Loaded "+name+". Analyze to refresh card and bracket checks.");
 }catch(e){msg(e.message)}
});
$("accountDelete")?.addEventListener("click",async()=>{
 const name=$("accountDeckList").value;if(!name)return;
 if(!confirm("Permanently delete "+name+" from your cloud shelf?"))return;
 try{await request("delete",{name});await refresh();msg("Deleted "+name+".")}catch(e){msg(e.message)}
});
refresh();
