import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const shared=readFileSync(new URL("../../../header-profile.js",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const game=readFileSync(new URL("../src/main.js",import.meta.url),"utf8");

function element(tag){
 const attrs=new Map(),classes=new Set(),listeners={};
 const node={
  tagName:tag.toUpperCase(),style:{},children:[],className:"",classList:{
   add:k=>classes.add(k),remove:k=>classes.delete(k),
   toggle:(k,v)=>{if(v===true)classes.add(k);else if(v===false)classes.delete(k);else if(classes.has(k))classes.delete(k);else classes.add(k)},
   contains:k=>classes.has(k)
  },
  append:(...children)=>node.children.push(...children),setAttribute:(k,v)=>attrs.set(k,String(v)),
  getAttribute:k=>attrs.get(k)||null,removeAttribute:k=>attrs.delete(k),
  addEventListener:(type,listener)=>{listeners[type]=listener},querySelector:()=>null,
  get naturalWidth(){return 150},get complete(){return true},listeners
 };
 return node;
}

test("game top-right avatar reuses the actual site-wide account component",async()=>{
 const header=element("header"),events={};
 let checks=0;
 const profile={handle:"Squackle",avatar:"Chainer, Dementia Master",focus_zoom:3.1,focus_x:42,focus_y:22};
 const document={
  readyState:"complete",
  querySelector:q=>q===".lab-header[data-profile-header]"?header:null,
  createElement:element,createElementNS:(_ns,tag)=>element(tag),
  addEventListener:(k,listener)=>{events["document:"+k]=listener}
 };
 const window={addEventListener:(k,listener)=>{events[k]=listener}};
 vm.runInNewContext(shared,{document,window,encodeURIComponent,Date,
  sessionStorage:{getItem:()=>null},localStorage:{getItem:()=>null},
  fetch:async(url,options)=>{
   checks++;
   assert.equal(url,"/api/community?action=me");
   assert.equal(options.credentials,"same-origin");
   return{ok:true,json:async()=>({profile})};
  }
 });
 await new Promise(done=>setImmediate(done));
 const button=header.children.find(el=>el.className==="header-profile-button");
 assert.ok(button,"shared component renders in arcade header");
 assert.equal(button.href,"/community.html#account");
 assert.equal(button.title,"Open @Squackle's investigator dossier");
 assert.ok(button.classList.contains("is-signed-in"));
 const image=button.children[0].children[1];
 assert.match(image.src,/api\.scryfall\.com\/cards\/named/);
 assert.match(image.style.transform,/scale\(3\.10\)/);
 assert.equal(checks,1);
 events["deepcuts:profile-change"]({detail:{profile:null}});
 assert.equal(button.title,"Sign in or create a Field Network profile");
 assert.equal(button.classList.contains("is-signed-in"),false);
});
test("signed-in leaderboard box is hidden, guests still have a sign-in link",()=>{
 assert.match(html,/<header class="lab-header" data-profile-header>/);
 assert.match(html,/id="gameProfileBridge"[^>]*hidden/);
 assert.match(html,/id="gameSignInLink"/);
 assert.doesNotMatch(html,/id="gameProfileLink"/);
 assert.match(game,/\$\("gameProfileBridge"\)\.hidden=!!data\.profile/);
 assert.match(game,/\$\("gameProfileBridge"\)\.hidden=true/);
 assert.match(css,/\.field-network-bridge\[hidden\]\{display:none!important\}/);
 assert.match(css,/@media\(max-width:580px\)/);
 assert.match(html,/href="\/header-profile\.css"/);
 assert.match(html,/src="\/header-profile\.js"/);
});
