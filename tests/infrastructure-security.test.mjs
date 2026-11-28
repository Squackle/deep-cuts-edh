import test from "node:test";
import assert from "node:assert/strict";
import {navigationLabel,isAccessRedirect} from "../scripts/infrastructure-security.mjs";
test("navigation labels accept normal text and inline formatting but reject malformed nesting and unknown elements",()=>{
 assert.equal(navigationLabel(' <span class="label">TOOLS &amp; RESOURCES</span> '),"TOOLS & RESOURCES");
 assert.equal(navigationLabel('<SPAN class="label active"><em>AR</em><strong>CADE</strong></SPAN>'),"ARCADE");
 assert.equal(navigationLabel("MEMBERS' LOUNGE"),"MEMBERS' LOUNGE");
 for(const x of ["<scr<script>ipt>ARCADE","<span<em>>ARCADE","<script>ARCADE</script>","ARCADE <","<img src=x>ARCADE","<span>ARCADE</em>","<strong>ARCADE","</span>ARCADE",'<span onclick="alert(1)">ARCADE</span>','<span ONCLICK="x">ARCADE</span>','<span style="color:red">ARCADE</span>','<span class="label" class="other">ARCADE</span>','<strong class="label">ARCADE</strong>','<span>ARCADE</span class="label">',"<span><em>ARCADE</span></em>","<span/>ARCADE","<!--x-->ARCADE"])assert.throws(()=>navigationLabel(x));
});
test("Access redirect requires HTTPS, exact host boundary and Access path",()=>{
 const base="https://deep-cuts-edh.pages.dev";
 for(const x of ["/cdn-cgi/access/login/site","https://team.cloudflareaccess.com/cdn-cgi/access/login/site","https://deep-cuts-edh.pages.dev/cdn-cgi/access/login/site"])assert.equal(isAccessRedirect(x,base),true,x);
 for(const x of ["https://evil.invalid/?next=cloudflareaccess.com","https://cloudflareaccess.com.evil.invalid/cdn-cgi/access/login","https://evil.invalid/cdn-cgi/access/login","https://team.cloudflareaccess.com@evil.invalid/cdn-cgi/access/login","http://team.cloudflareaccess.com/cdn-cgi/access/login","https://team.cloudflareaccess.com/not-access","https://team.cloudflareaccess.com:444/cdn-cgi/access/login","/other?next=/cdn-cgi/access/login","https://team.cloudflareaccess.com\\@evil.invalid/cdn-cgi/access/login",""])assert.equal(isAccessRedirect(x,base),false,x);
});
