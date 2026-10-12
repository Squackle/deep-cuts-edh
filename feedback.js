/* Small, accessible sitewide feedback launcher with native Cloudflare D1 storage. */
(() => {
 const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
 const key="0x4AAAAAAFU5c2gIVJQkigt0";
 let widget=null,challengeToken="",widgetRoot=null;
 function loadTurnstile(){
  return new Promise((resolve,reject)=>{
   if(window.turnstile?.render){resolve();return}
   const existing=document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
   if(existing){let polls=0;const timer=setInterval(()=>{if(window.turnstile?.render){clearInterval(timer);resolve()}else if(++polls>75){clearInterval(timer);reject(new Error("Verification did not load."))}},100);return}
   const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;
   script.onload=()=>resolve();script.onerror=()=>reject(new Error("Human verification is blocked."));document.head.append(script);
  })
 }
 function start(){
  const open=el("button","dc-feedback-launch","<escape>Feedback</escape>");open.textContent="✎ Feedback";
  open.type="button";open.setAttribute("aria-label","Report a bug or suggest a feature");
  const dlg=el("dialog","dc-feedback-dialog");dlg.setAttribute("aria-labelledby","dc-feedback-title");
  const close=el("button","dc-feedback-close","×");close.type="button";close.setAttribute("aria-label","Close feedback");
  const heading=el("h2",null,"Help improve Deep Cuts");heading.id="dc-feedback-title";
  const lead=el("p","dc-feedback-lede","Found a bug or have an idea? Send it straight to our review queue.");
  const form=el("form");form.method="dialog";
  const label1=el("label",null,"What's this about?"),category=el("select");
  category.required=true;for(const [value,text]of [["bug","Report a bug"],["feature","Request a feature"]]){const op=el("option",null,text);op.value=value;category.append(op)};label1.append(category);
  const label2=el("label",null,"Tell us what happened or what you'd like to see"),message=el("textarea");
  message.required=true;message.minLength=15;message.maxLength=2000;message.rows=5;message.placeholder="What were you doing? What did you expect? What would make the site better?";label2.append(message);
  const sub=el("p","dc-feedback-helper","No account or email required. Reports are stored privately for site review.");
  widgetRoot=el("div","dc-feedback-turnstile");
  const status=el("p","dc-feedback-status");status.setAttribute("role","status");status.setAttribute("aria-live","polite");
  const send=el("button","dc-feedback-send","SEND FEEDBACK ↗");send.type="submit";
  form.append(label1,label2,sub,widgetRoot,status,send);dlg.append(close,heading,lead,form);
  document.body.append(open,dlg);
  async function present(kind){
    if(kind)category.value=kind;
    status.textContent="";challengeToken="";dlg.showModal();
    try{
      await loadTurnstile();
      if(widget!==null){window.turnstile.reset(widget);return}
      widget=window.turnstile.render(widgetRoot,{sitekey:key,theme:"light",callback:token=>{challengeToken=token}, "expired-callback":()=>{challengeToken=""},"error-callback":()=>{challengeToken=""}});
    }catch(e){status.textContent=e.message+" Feedback needs Cloudflare Turnstile enabled."}
  }
  open.addEventListener("click",()=>present());
  close.addEventListener("click",()=>dlg.close());
  dlg.addEventListener("click",e=>{if(e.target===dlg)dlg.close()});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    if(!form.reportValidity())return;
    if(!challengeToken){status.textContent="Complete human verification first.";return}
    send.disabled=true;status.textContent="Sending securely…";
    try{
      const response=await fetch("/api/feedback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({category:category.value,message:message.value.trim(),page:location.pathname+location.search,token:challengeToken})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Could not submit feedback.");
      status.textContent=data.message;message.value="";challengeToken="";if(widget!==null)window.turnstile.reset(widget);
    }catch(error){status.textContent=error.message;challengeToken="";if(widget!==null)window.turnstile.reset(widget)}
    finally{send.disabled=false}
  });
  window.DeepCutsFeedback={open:present};
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();