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
   const badges=await gameBadges(state.me.handle);
   if(badges.length)appendGameBling(my,badges);
  }else my.replaceChildren(el("p","Sign in to see your personal achievements. Public standings appear below.","cm-note"));
 }catch(e){showFieldError(my,e)}
}
// Daily puzzle achievements are earned only from authenticated, validated
// daily game results. They decorate public investigator dossiers but never add
// paid perks or inflate contribution-reputation points.
async function gameBadges(handle){
 if(!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(handle||""))return [];
 try{
  const u=new URL("/api/daily-games",location.href);
  u.searchParams.set("action","badges");u.searchParams.set("handle",handle);
  const res=await fetch(u,{cache:"no-store",credentials:"same-origin"});
  if(!res.ok)return [];
  const d=await res.json();
  return Array.isArray(d.badges)?d.badges:[];
 }catch{return []}
}
function appendGameBling(host,badges){
 const section=el("section",null,"game-profile-bling");
 section.append(el("h3","🎮 DAILY GAME TROPHIES"));
 const grid=el("div",null,"game-profile-badges");
 for(const b of badges){
  const tag=el("span",b.title,"game-profile-badge");
  tag.title=b.detail||"Daily MTG game achievement";
  grid.append(tag);
 }
 section.append(grid);
 const link=el("a","EARN MORE IN DAILY MTG GAMES ↗","game-profile-game-link");
 link.href="/games.html";section.append(link);host.append(section);
}
export async function attachProfileReputation(target,handle){
 if(!target||!/^[a-z][a-z0-9_]{2,23}$/i.test(handle))return;
 const wrapper=el("div",null,"field-profile-reputation");
 wrapper.append(el("p","Loading investigator credentials…","cm-note"));target.append(wrapper);
 try{
  const {profile}=await fieldGet("reputation",{handle});
  if(!target.contains(wrapper))return;
  wrapper.replaceChildren(card(profile));
  const badges=await gameBadges(handle);
  if(target.contains(wrapper)&&badges.length)appendGameBling(wrapper,badges);
 }catch{
  if(target.contains(wrapper))wrapper.replaceChildren(el("p","Investigator credentials are temporarily unavailable.","cm-note"));
 }
}
