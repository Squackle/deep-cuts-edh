(() => {
"use strict";
const $=id=>document.getElementById(id);
const input=$("diagnosticKey"),status=$("diagnosticStatus"),results=$("diagnosticResults");
function render(parent,data,label){
 parent.replaceChildren();
 if(!data.length){const p=document.createElement("p");p.className="diagnostic-empty";p.textContent="No events recorded in the last 24 hours.";parent.append(p);return}
 for(const row of data){
  const div=document.createElement("div");div.className="diagnostic-record";
  const a=document.createElement("span"),b=document.createElement("span");
  const texts=label(row);a.textContent=texts[0];b.textContent=texts[1];div.append(a,b);parent.append(div);
 }
}
$("diagnosticForm").addEventListener("submit",async e=>{
 e.preventDefault();const token=input.value.trim();
 if(!/^dcdiag1_[0-9a-f]{64}$/.test(token)){status.textContent="Enter a valid private diagnostics key.";return}
 $("checkDiagnostic").disabled=true;status.textContent="Checking Ko-fi webhook activity…";results.hidden=true;
 try{
  const response=await fetch("/api/kofi-diagnostics",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","Accept":"application/json"},body:"{}",credentials:"omit",cache:"no-store",redirect:"error"});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"Could not retrieve diagnostics.");
  $("diagnosticSummary").textContent="Last 24 hours: "+data.verifiedEvents.length+" recent verified event samples; "+data.qualifiedPayments+" qualified subscription payment records.";
  render($("diagnosticCounters"),data.counters,x=>[x.reason.replaceAll("_"," "),x.count+" · last seen "+x.lastHourUTC]);
  render($("diagnosticVerified"),data.verifiedEvents,x=>[x.type+" — "+x.classification.replaceAll("_"," "),x.receivedUTC]);
  results.hidden=false;status.textContent="Diagnostics loaded. Premium membership keys remain disabled.";
 }catch(err){status.textContent=String(err.message||"Unable to read diagnostics.");}
 finally{$("checkDiagnostic").disabled=false;input.value="";}
});
$("clearDiagnostic").addEventListener("click",()=>{input.value="";results.hidden=true;status.textContent="Results cleared.";});
})();