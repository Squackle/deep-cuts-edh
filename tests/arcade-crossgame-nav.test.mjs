import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const code=read("arcade-crossgame.js");
const css=read("arcade-crossgame.css");
const pages=[
  ["games/cold-case.html","/games/cold-case"],
  ["games/obscurity-ladder.html","/games/obscurity-ladder"],
  ["games/arcane-cipher.html","/games/arcane-cipher"],
  ["games/conspiracy-board.html","/games/conspiracy-board"],
  ["games/hive-run/index.html","/games/hive-run/"],
  ["games/mana-heist/index.html","/games/mana-heist/"],
  ["games/stackbreaker.html","/games/stackbreaker"]
];
const paths=pages.map(([,url])=>url);

class Node {
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.parentElement=null;this.hidden=false;this.open=false;this.id="";this.href="";}
  append(...nodes){for(const node of nodes){if(node.parentElement){const old=node.parentElement.children;old.splice(old.indexOf(node),1)}this.children.push(node);node.parentElement=this}}
  setAttribute(name,value){this.attributes[name]=value}
  contains(node){return node===this||this.children.some(child=>child.contains(node))}
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
function setup(path,{victory=false}={}){
  const listeners={};
  const observers=[];
  const body=new Node("body");
  if(victory){const overlay=new Node("section");overlay.id="victoryOverlay";overlay.hidden=true;body.append(overlay)}
  const document={
    readyState:"complete",body,fullscreenElement:null,
    createElement:tag=>new Node(tag),
    getElementById:id=>descendants(body).find(node=>node.id===id)||null,
    addEventListener:(event,listener)=>{listeners[event]=listener}
  };
  class MutationObserver {
    constructor(callback){this.callback=callback;observers.push(this)}
    observe(target,options){this.target=target;this.options=options}
  }
  vm.runInNewContext(code,{window:{location:{pathname:path}},document,MutationObserver});
  return {document,listeners,observers,body,drawer:document.getElementById("dcCrossGameNav")};
}

test("all seven playable main-site pages load the shared switcher",()=>{
  for(const [file] of pages){
    const html=read(file);
    assert.match(html,/href="\/arcade-crossgame.css"/,file);
    assert.match(html,/src="\/arcade-crossgame.js"/,file);
  }
});

test("every game links directly to exactly the other six playable games",()=>{
  for(const [,url] of pages){
    const {drawer}=setup(url);
    assert.ok(drawer,"missing drawer on "+url);
    const links=descendants(drawer).filter(el=>el.tagName==="a"&&el.className==="dc-cross-game-link");
    assert.equal(links.length,6,url);
    assert.equal(new Set(links.map(link=>link.href)).size,6,url);
    assert.deepEqual(links.map(link=>link.href).sort(),paths.filter(path=>path!==url).sort(),url);
    const summary=descendants(drawer).find(el=>el.tagName==="summary");
    assert.match(summary.textContent,/PLAY ANOTHER GAME/);
    const nav=descendants(drawer).find(el=>el.tagName==="nav");
    assert.equal(nav.attributes["aria-label"],"Other playable Deep Cuts EDH games");
    assert.ok(descendants(drawer).some(el=>el.tagName==="a"&&el.href==="/games"),"optional hub remains discoverable");
  }
});

test("canonical aliases and unrecognized pages behave safely",()=>{
  for(const path of ["/games/cold-case.html","/games/mana-heist/index.html","/games/hive-run/index.html"]){
    const {drawer}=setup(path);assert.ok(drawer,path);
  }
  for(const path of ["/games","/profile","/"]){
    const {drawer}=setup(path);assert.equal(drawer,null,path);
  }
});

test("drawer persists through gameplay and finished screens and closes on Escape",()=>{
  const {drawer,document,listeners,body,observers}=setup("/games/hive-run/",{victory:true});
  assert.equal(drawer.parentElement,body);
  // Browsers display only descendants of the native fullscreen element.
  const fullscreen=new Node("section");document.fullscreenElement=fullscreen;
  listeners.fullscreenchange();assert.equal(drawer.parentElement,fullscreen);
  document.fullscreenElement=null;listeners.fullscreenchange();
  assert.equal(drawer.parentElement,body);
  const overlay=document.getElementById("victoryOverlay");overlay.hidden=false;
  assert.deepEqual(observers[0].options.attributeFilter,["hidden"]);
  observers[0].callback();assert.equal(drawer.parentElement,overlay);
  overlay.hidden=true;observers[0].callback();assert.equal(drawer.parentElement,body);
  drawer.open=true;listeners.keydown({key:"Escape"});assert.equal(drawer.open,false);
  drawer.open=true;listeners.pointerdown({target:body});assert.equal(drawer.open,false);
});

test("mobile and immersive styles preserve a usable launcher",()=>{
  assert.match(css,/position:fixed/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/@media\(max-width:440px\)/);
  assert.match(css,/body\.in-heist/);
  assert.match(css,/body\.game-only/);
  assert.match(css,/\.dominion-victory/);
  assert.match(css,/:focus-visible/);
});
