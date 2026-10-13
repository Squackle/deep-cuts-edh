import {$,state,el,clear,msg,appendProfileMentions} from "./community.js";
import {fieldGet,emptyNotice,showFieldError} from "./field-client.js";
function card(profile,self=false){
 const p=el("article",null,"field-rank-card");
 const top=el("div",null,"field-rank-line");
 const name=el("strong");appendProfileMentions(name,"@"+profile.handle);
 top.append(name,el("span",profile.points+" reputation pts","field-score"));
 p.append(top,el("p",profile.rank,"field-rank-label"));
 const stat=el("p",profile.findings+" research findings · "+profile.endorsements+" endorsements · "+profile.decks+" decks · "+profile.games+" playtests · "+profile.comments+" case comments","cm-note");
 p.append(stat);
 const badges=el("div",null,"field-rank-badges");
 for(const title of profile.badges||[])badges.append(el("span",title,"cm-tag"));
 if(!badges.childNodes.length)badges.append(el("span","Earn a badge by contributing documented research.","cm-note"));
 p.append(badges);
 if(self)p.classList.add("field-rank-self");
 return p;
}
export async function loadReputation(){
 const my=$("reputationMine"),list=$("reputationLeaders");
 if(!my||!list)return;
 my.replaceChildren(el("p","Calculating community research reputation…","cm-note"));
 list.replaceChildren();
 try{
  const result=await fieldGet("leaderboard");
  if(!result.leaders?.length)emptyNotice(list,"No investigator rankings yet.");
  else{
   result.leaders.forEach((entry,i)=>{
    const item=card(entry);item.prepend(el("span","#"+(i+1),"field-rank-number"));
    list.append(item);
   });
  }
  if(state.me){
   const response=await fieldGet("reputation",{handle:state.me.handle});
   my.replaceChildren(el("h3","YOUR INVESTIGATOR RANK"),card(response.profile,true));
  }else my.replaceChildren(el("p","Sign in to see your personal achievements. Public standings appear below.","cm-note"));
 }catch(e){showFieldError(my,e)}
}
export async function attachProfileReputation(target,handle){
 if(!target||!/^[a-z][a-z0-9_]{2,23}$/i.test(handle))return;
 const wrapper=el("div",null,"field-profile-reputation");
 wrapper.append(el("p","Loading investigator credentials…","cm-note"));target.append(wrapper);
 try{
  const {profile}=await fieldGet("reputation",{handle});
  if(!target.contains(wrapper))return;
  wrapper.replaceChildren(card(profile));
 }catch{
  if(target.contains(wrapper))wrapper.replaceChildren(el("p","Investigator credentials are temporarily unavailable.","cm-note"));
 }
}
