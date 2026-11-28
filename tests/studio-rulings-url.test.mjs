import test from "node:test";
import assert from "node:assert/strict";
import {rulingsUrl,publicCardUrl} from "../src/studio-rulings-url.mjs";
const id="12345678-1234-1234-1234-123456789abc";
const canonical="https://api.scryfall.com/cards/"+id+"/rulings";
test("CodeQL #5: legitimate rulings URLs and absent URI fallback",()=>{
 assert.equal(rulingsUrl({id,rulings_uri:canonical}),canonical);
 assert.equal(rulingsUrl({id}),canonical);
 assert.equal(rulingsUrl({id,rulings_uri:""}),canonical);
 assert.equal(rulingsUrl({id:id.toUpperCase()}),canonical);
});
test("CodeQL #5: reject malformed and misleading rulings destinations",()=>{
 for(const value of [
 "https://evilscryfall.com/cards/"+id+"/rulings",
 "https://api.scryfall.com.example.test/cards/"+id+"/rulings",
 "https://scryfall.com/cards/"+id+"/rulings",
 "https://api.scryfall.com@evil.test/cards/"+id+"/rulings",
 "https://user:secret@api.scryfall.com/cards/"+id+"/rulings",
 canonical.replace("https:","http:"),
 canonical.replace(".com/",".com:444/"),
 canonical+"?next=https://evil.test",canonical+"#fragment",
 canonical.replace(id,"00000000-0000-0000-0000-000000000000"),
 canonical.replace("/rulings","/other"),
 canonical.replace("/cards/","/cards/%2f"),
 "/cards/"+id+"/rulings","not a URL", "javascript:alert(1)",
 canonical+"\n",canonical.replace("https://","https:\\\\"),
 {},false,0
 ])assert.throws(()=>rulingsUrl({id,rulings_uri:value}),/Unexpected rulings source/);
 for(const invalid of [undefined,null,123,"../../other","x"])
  assert.throws(()=>rulingsUrl({id:invalid}),/Unexpected rulings source/);
});
test("CodeQL #5: public card links preserve printing and reject foreign navigation",()=>{
 const legitimate="https://scryfall.com/card/mh3/123/example-card?utm_source=api";
 assert.equal(publicCardUrl(legitimate),legitimate);
 assert.equal(publicCardUrl("https://scryfall.com/card/abc/123a/example-card#foo"),"https://scryfall.com/card/abc/123a/example-card");
 for(const value of ["javascript:alert(1)","https://evilscryfall.com/card/mh3/123/test","https://scryfall.com.evil.test/card/mh3/123/test","https://user@scryfall.com/card/mh3/123/test","http://scryfall.com/card/mh3/123/test","https://scryfall.com:444/card/mh3/123/test","https://scryfall.com/search?q=test","/card/mh3/123/test","not a URL",null])
  assert.equal(publicCardUrl(value),"https://scryfall.com");
});