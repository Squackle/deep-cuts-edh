/* Deep Cuts UX — task-based Deck Workshop without discarding any existing feature.
   DOM nodes are moved (not recreated) so the current modules' handlers/state survive. */
(() => {
  const $=id=>document.getElementById(id);
  const page=document.querySelector(".tool-page");
  if(!page||!$("deckGenerator")||!$("deckInput"))return;
  const wrap=page.querySelector(".wrap"),intro=wrap.querySelector(".tool-intro"),
    cols=wrap.querySelector(".deck-columns");
  if(!cols||cols.children.length<2)return;

  const shell=document.createElement("div");shell.className="workbench-shell";
  shell.id="workbench";intro.after(shell);
  const welcome=document.createElement("div");welcome.className="workbench-welcome";
  welcome.innerHTML='<div><span class="retro-eyebrow">YOUR WORKBENCH</span><p>Choose what you want to do. The rest stays out of your way.</p></div><div class="workbench-live"><span aria-hidden="true">●</span> Autosaves in your browser</div>';
  shell.append(welcome);

  const specs=[
    {key:"build",label:"Build",description:"Start a new 100-card draft",icon:"✦"},
    {key:"deck",label:"My Deck",description:"Import and edit cards",icon:"▤"},
    {key:"improve",label:"Improve",description:"Mana, bracket and cuts",icon:"⚒"},
    {key:"research",label:"Combos & Rules",description:"Find synergies and rulings",icon:"✧"},
    {key:"save",label:"Save & Buy",description:"Collection and exports",icon:"↗"}
  ];
  const nav=document.createElement("div");nav.className="workbench-tabs";nav.setAttribute("role","tablist");nav.setAttribute("aria-label","Deck Workshop sections");
  const viewWrap=document.createElement("div");viewWrap.className="workbench-views";
  shell.append(nav,viewWrap);
  const views=new Map(),buttons=new Map();
  for(const x of specs){
    const button=document.createElement("button");
    button.type="button";button.className="workbench-tab";button.id="tab-"+x.key;
    button.setAttribute("role","tab");button.setAttribute("aria-controls","view-"+x.key);
    button.setAttribute("aria-selected","false");button.setAttribute("tabindex","-1");
    button.innerHTML='<span class="workbench-tab-icon" aria-hidden="true">'+x.icon+'</span><span class="workbench-tab-label"><strong>'+x.label+'</strong><small>'+x.description+'</small></span>';
    nav.append(button);buttons.set(x.key,button);
    const view=document.createElement("section");view.className="workbench-view";view.id="view-"+x.key;
    view.setAttribute("role","tabpanel");view.setAttribute("aria-labelledby",button.id);view.hidden=true;
    viewWrap.append(view);views.set(x.key,view);
    button.addEventListener("click",()=>activate(x.key,true));
  }
  nav.addEventListener("keydown",e=>{
    const i=specs.findIndex(x=>buttons.get(x.key)===document.activeElement);
    if(i<0)return;
    let next=i;
    if(e.key==="ArrowRight")next=(i+1)%specs.length;
    else if(e.key==="ArrowLeft")next=(i+specs.length-1)%specs.length;
    else if(e.key==="Home")next=0;
    else if(e.key==="End")next=specs.length-1;
    else return;
    e.preventDefault();buttons.get(specs[next].key).focus();activate(specs[next].key,true);
  });
  function activate(key,hash){
    if(!views.has(key))key="deck";
    for(const x of specs){
      const active=x.key===key,v=views.get(x.key),b=buttons.get(x.key);
      v.hidden=!active;
      b.setAttribute("aria-selected",String(active));
      b.setAttribute("tabindex",active?"0":"-1");
      b.classList.toggle("active",active);
    }
    try{localStorage.setItem("deepcuts-workbench-tab",key)}catch{}
    if(hash&&window.history?.replaceState)history.replaceState(null,"","#"+key);
    if(key==="improve")syncCutSetting();
    if(hash&&window.matchMedia?.("(max-width:700px)")?.matches)nav.scrollIntoView({behavior:"smooth",block:"start"});
  }
  function fold(element,label,open=false){
    if(!element)return null;
    const details=document.createElement("details");details.className="workbench-fold";details.open=open;
    const summary=document.createElement("summary");
    summary.innerHTML='<span>'+label+'</span><small>Expand <span aria-hidden="true">⌄</span></small>';
    element.before(details);details.append(summary,element);return details;
  }
  // Build
  const generator=$("deckGenerator");views.get("build").append(generator);generator.classList.add("workbench-main");
  const builderControls=generator.querySelector(".tool-controls");
  const advance=document.createElement("details");advance.className="workbench-fold workbench-advanced";
  const advanceHead=document.createElement("summary");advanceHead.textContent="Optional build settings — partners, tribes and restrictions";
  advance.append(advanceHead);
  const inside=document.createElement("div");inside.className="tool-controls";advance.append(inside);
  for(const id of ["genPartner","genTribe","genFinish","genInteraction"]){
    const input=$(id);if(input?.parentElement)inside.append(input.parentElement);
  }
  const checkboxes=generator.querySelector(".tool-actions:has(.studio-check)");
  if(checkboxes){advance.append(checkboxes);advance.style.marginBottom="18px"}
  if(builderControls)builderControls.after(advance);

  // Edit deck: only one comfortable-width panel, not two massive parallel columns.
  const edit=cols.children[0],improve=cols.children[1];
  views.get("deck").append(edit);
  edit.classList.add("workbench-main");
  views.get("improve").append(improve);
  improve.classList.add("workbench-main");
  cols.remove();
  const hosted=$("hostedImport");
  if(hosted)fold(hosted,"Import a public Moxfield, Archidekt or other deck URL");
  const brew=$("saveBrew")?.closest(".diagnosis-group");
  if(brew)fold(brew,"Saved decklists on this device");
  const deckRows=$("deckRows");if(deckRows)deckRows.classList.add("compact-deck-rows");

  const diagnostics=page.querySelector('.workshop-summary[aria-label="Expanded analysis and deck tools"]');
  if(diagnostics){
    const enclosed=fold(diagnostics,"More diagnostics — mana curve, opening hands and deck roles");
    views.get("improve").append(enclosed);
  }
  const cutMode=$("cutMode")?.closest(".tool-controls");
  function syncCutSetting(){
    const isCut=document.querySelector('.deck-tab.active')?.dataset.tab==="cut";
    if(cutMode)cutMode.hidden=!isCut;
  }
  document.querySelectorAll(".deck-tab").forEach(b=>b.addEventListener("click",syncCutSetting));
  syncCutSetting();

  // Research — combo analyzer visible, optional rules lookup behind one control.
  const forecast=$("turnForecast");if(forecast)views.get("improve").append(fold(forecast,"Goldfish simulation — commander casting probability"));
  const combos=$("comboPanel"),rulings=$("rulesDesk");
  if(combos)views.get("research").append(combos);
  if(rulings)views.get("research").append(fold(rulings,"Card rulings and official rules references"));

  // Shop & cloud tools: fast links first; the longer workflows are opt-in.
  const research=page.querySelector('.workshop-summary[aria-labelledby="researchHeading"]'),
        collection=$("collectionPanel"),cloud=$("cloudShare"),vault=$("vaultPanel");
  if(research)views.get("save").append(research);
  if(collection)views.get("save").append(fold(collection,"My collection and missing cards"));
  if(cloud)views.get("save").append(fold(cloud,"Create a shareable deck link"));
  if(vault)views.get("save").append(fold(vault,"Save a cloud deck with a recovery key"));

  const foot=wrap.querySelector(".tool-footer");if(foot)views.get("save").append(foot);

  function jumpToView(eventKey){
    activate(eventKey,true);
    if(eventKey==="improve"&&window.innerWidth<950)nav.scrollIntoView({behavior:"smooth",block:"start"});
  }
  window.addEventListener("deepcuts:analyzed",()=>jumpToView("improve"));
  window.addEventListener("deepcuts:loadsnapshot",()=>jumpToView("deck"));
  const fragment=location.hash.slice(1);
  const nested={
    deckGenerator:"build",commanderField:"deck",deckInput:"deck",hostedImport:"deck",
    analysisPanel:"improve",deckRows:"deck",comboPanel:"research",rulesDesk:"research",
    cloudShare:"save",vaultPanel:"save",turnForecast:"improve",collectionPanel:"save",researchLinks:"save"
  };
  let defaultView;
  try{defaultView=localStorage.getItem("deepcuts-workbench-tab")}catch{}
  if(!defaultView){
    try{
      const d=JSON.parse(localStorage.getItem("deepcuts-deck-v1"));
      defaultView=d?.cards?.length?"deck":"build"
    }catch{defaultView="build"}
  }
  const desired=views.has(fragment)?fragment:nested[fragment]||defaultView;
  activate(desired,false);
  if(nested[fragment]){
    const focusEl=$(fragment),parent=focusEl?.closest(".workbench-fold");
    if(parent)parent.open=true;
  }
  function headerOffset(){
    const h=document.querySelector(".site-header")?.offsetHeight||76;
    nav.style.setProperty("--workbench-top",h+"px");
  }
  headerOffset();window.addEventListener("resize",headerOffset);
})();