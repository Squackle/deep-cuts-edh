import test from "node:test";
import assert from "node:assert/strict";
import {findExistingNomination,nominationKey} from "../src/nomination-names.js";
import {onRequestPost} from "../functions/api/nominations.js";

const rows=[
 {id:10,name:"Reveka, Wizard Savant",slug:"revekawizardsavant",status:"approved"},
 {id:17,name:"Reveka",slug:"reveka",status:"retired"},
 {id:21,name:"Gorbag of Minas Morgul",slug:"gorbagofminasmorgul",status:"pending"},
 {id:15,name:"Nephilim Epochal",slug:"nephilimepochal",status:"retired"}
];
test("Shortened and misspelled commander names resolve to approved canonical entry",()=>{
 for(const name of ["Reveka","Reveka, Wizard Savant","reveka wizard savant","Reveka, Wiard Savant","Reveka wiard savent","REVEKA!"]){
  const match=findExistingNomination(name,rows);
  assert.equal(match?.record.id,10,name);
 }
 assert.equal(nominationKey("Révéka, Wizard Savant"),"revekawizardsavant");
});
test("Retired names and unrelated/ambiguous commanders are never silently merged",()=>{
 assert.equal(findExistingNomination("Nephilim Epochal",rows),null);
 assert.equal(findExistingNomination("Reveka the Unrelated",rows),null);
 const ambiguous=[{id:1,name:"Talia, the Healer",status:"approved"},{id:2,name:"Talia, the Warrior",status:"pending"}];
 assert.equal(findExistingNomination("Talia",ambiguous),null);
 assert.equal(findExistingNomination("Taliaa",ambiguous),null);
 assert.equal(findExistingNomination("Nephilim",rows),null);
});
const uuid="11111111-1111-4111-8111-111111111111";
const URL="https://deep-cuts-edh.pages.dev/api/nominations";
function mockDatabase(){
 const recorded=new Set(),calls=[],existing=[...rows],prepared=[];
 const db={recorded,calls,prepared,
  prepare(sql){
   const q={sql,args:[],bind(...args){this.args=args;return this;},
    async first(){
     if(sql.includes("owner_feature_flags"))return {enabled:1};
     if(sql.includes("nomination_limits"))return {attempts:1};
     if(sql.includes("SELECT COUNT(*) AS votes FROM nomination_votes"))return {votes:recorded.size};
     if(sql.includes("SELECT id,name,status FROM nominations WHERE slug"))return existing.find(x=>x.slug===this.args[0])||null;
     throw Error("Unexpected first: "+sql);
    },
    async all(){
     if(sql.includes("SELECT id,slug,name,status FROM nominations WHERE status IN"))return {results:existing.filter(x=>["approved","pending"].includes(x.status))};
     throw Error("Unexpected all: "+sql);
    },
    async run(){
     calls.push({sql,args:this.args});
     if(sql.includes("INSERT OR IGNORE INTO nomination_votes")){
       const id=this.args[0],hash=this.args[1];
       assert.equal(id,10,"Every corrected Reveka variant must credit the approved nominee");
       const size=recorded.size;recorded.add(hash);return {meta:{changes:recorded.size-size}};
     }
     if(sql.includes("INSERT OR IGNORE INTO nominations"))throw Error("Alias should never create another nomination");
     throw Error("Unexpected write: "+sql);
    }
   };
   prepared.push(q);return q;
  }
 };
 return db;
}
test("Public nomination POST autocorrects an approved candidate and counts a visitor only once",{timeout:10000},async()=>{
 const oldFetch=globalThis.fetch,db=mockDatabase();let scryfall=0;
 globalThis.fetch=async(url)=>{
  if(String(url).includes("turnstile/v0/siteverify"))return {ok:true,json:async()=>({success:true,hostname:"deep-cuts-edh.pages.dev"})};
  scryfall++;throw Error("Unneeded external lookup");
 };
 try{
  const request=(name)=>new Request(URL,{method:"POST",headers:{"Origin":"https://deep-cuts-edh.pages.dev","Content-Type":"application/json","CF-Connecting-IP":"192.0.2.9"},
   body:JSON.stringify({commander:name,reason:"A special wizard with tricks",strategy:"Untap effects",cards:"Twiddle",budget:"$100",visitorId:uuid,turnstileToken:"fake-valid-fixture"})});
  const res=await onRequestPost({request:request("Reveka"),env:{DB:db,TURNSTILE_SECRET:"only-unit-test-secret"}});
  assert.equal(res.status,201);
  const data=await res.json();
  assert.equal(data.name,"Reveka, Wizard Savant");
  assert.equal(data.votes,1);assert.equal(data.corrected,true);
  assert.match(data.message,/credited to Reveka, Wizard Savant/);
  const second=await onRequestPost({request:request("Reveka, Wiard Savant"),env:{DB:db,TURNSTILE_SECRET:"only-unit-test-secret"}});
  assert.equal(second.status,200);
  assert.equal((await second.json()).recorded,false);
  assert.equal(db.recorded.size,1);
  assert.equal(scryfall,0,"Existing aliases must never need a third-party API call");
 }finally{globalThis.fetch=oldFetch}
});
