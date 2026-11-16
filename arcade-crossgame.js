/* Deep Cuts EDH — shared in-game navigation. No game state, score, or account access. */
(()=>{
  "use strict";
  const games=[
    {path:"/games/cold-case",name:"Cold Case",kind:"Daily puzzle"},
    {path:"/games/obscurity-ladder",name:"Obscurity Ladder",kind:"Daily puzzle"},
    {path:"/games/arcane-cipher",name:"Arcane Cipher",kind:"Daily puzzle"},
    {path:"/games/conspiracy-board",name:"Conspiracy Board",kind:"Daily puzzle"},
    {path:"/games/hive-run/",name:"Hive Run",kind:"Arcade adventure"},
    {path:"/games/mana-heist/",name:"Mana Heist",kind:"Solo mana puzzles"},
    {path:"/games/stackbreaker",name:"Daily Stackbreaker",kind:"Stack puzzle"}
  ];
  const normalize=path=>path.replace(/\/index\.html$/i,"/").replace(/\.html$/i,"").replace(/\/+$/,"");
  const current=games.find(game=>normalize(game.path)===normalize(window.location.pathname));
  if(!current)return;

  const element=(tag,className,text)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(text!==undefined)node.textContent=text;
    return node;
  };

  function mount(){
    if(document.getElementById("dcCrossGameNav"))return;
    const drawer=element("details","dc-cross-game");
    drawer.id="dcCrossGameNav";
    const summary=element("summary","dc-cross-game-toggle","PLAY ANOTHER GAME");
    const panel=element("nav","dc-cross-game-panel");
    panel.setAttribute("aria-label","Other playable Deep Cuts EDH games");
    panel.append(
      element("span","dc-cross-game-kicker","THE ARCADE / KEEP EXPLORING"),
      element("h2","dc-cross-game-heading","Pick your next game")
    );
    const links=element("div","dc-cross-game-links");
    for(const game of games){
      if(game===current)continue;
      const link=element("a","dc-cross-game-link");
      link.href=game.path;
      link.append(element("strong","",game.name),element("small","",game.kind));
      links.append(link);
    }
    panel.append(links);
    const hub=element("a","dc-cross-game-hub","View the complete Arcade");
    hub.href="/games";
    panel.append(hub);
    drawer.append(summary,panel);
    document.body.append(drawer);

    // Hive Run can enter native fullscreen and has a separate earned-victory
    // dialog. Dock inside the active top layer so the links stay reachable.
    const victory=document.getElementById("victoryOverlay");
    const dock=()=>{
      const fullscreen=document.fullscreenElement;
      const target=fullscreen || (victory&&!victory.hidden?victory:document.body);
      if(drawer.parentElement!==target)target.append(drawer);
    };
    document.addEventListener("fullscreenchange",dock);
    if(victory&&typeof MutationObserver!=="undefined"){
      new MutationObserver(dock).observe(victory,{attributes:true,attributeFilter:["hidden"]});
    }
    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&drawer.open)drawer.open=false;
    });
    document.addEventListener("pointerdown",event=>{
      if(drawer.open&&!drawer.contains(event.target))drawer.open=false;
    });
    dock();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});
  else mount();
})();
