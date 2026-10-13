// Owner-only: no local/session storage, cookies, URL credentials or diagnostic logs for keys.
(()=>{const form=document.getElementById("opsForm"),status=document.getElementById("operatorStatus"),section=document.getElementById("issuedKeySection"),code=document.getElementById("issuedKey");
const say=(text)=>{status.textContent=text};const clear=()=>{code.textContent="";section.hidden=true};document.getElementById("clearIssued").addEventListener("click",clear);
document.getElementById("copyIssued").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(code.textContent);say("Key copied; deliver only to the independently verified subscriber.")}catch{say("Copy the one-time credential manually.")}});
form.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",async()=>{const action=button.dataset.action;clear();
const email=form.elements.email.value.trim(),operatorKey=form.elements.operatorKey.value.trim();
if(!form.elements.email.reportValidity()||!operatorKey){say("Enter the owner key and subscriber email.");return}
const confirmedKoFi=form.elements.verifiedPayment.checked,confirmedOwnership=form.elements.verifiedOwnership.checked;
if(action!=="lookup"&&(!confirmedKoFi||!confirmedOwnership)){say("Confirm both real-payment verification and subscriber ownership first.");return}
if(["replace","revoke"].includes(action)&&!confirm(action==="revoke"?"Revoke this subscriber's Field Office access? This does NOT cancel their Ko-fi billing.":"Replace the old member key and sign out all previously activated devices?"))return;
button.disabled=true;say("Checking securely…");
try{const r=await fetch("/api/kofi-member-issue",{method:"POST",headers:{"Authorization":"Bearer "+operatorKey,"Content-Type":"application/json"},body:JSON.stringify({action,email,confirmedKoFi,confirmedOwnership}),cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Operation refused.");
if(action==="lookup")say(data.verifiedPaymentRecorded?"Verified paid-through: "+new Date(data.paidUntil*1000).toLocaleDateString()+" · Tier: "+data.tier+" · Key issued: "+(data.keyIssued?"yes":"no")+(data.revoked?" · REVOKED":""):"No currently qualifying payment appears in the authenticated Ko-fi ledger. Do not issue a key.");
else if(data.key){code.textContent=data.key;section.hidden=false;say(data.tier+" key issued · paid-through "+new Date(data.paidUntil*1000).toLocaleDateString()+". Save and deliver privately; no email was sent automatically.");}
else say(action==="revoke"?"Access revoked. Billing must be handled separately.":"Operation saved.");
}catch(e){say(e.message)}finally{button.disabled=false}
}));})();