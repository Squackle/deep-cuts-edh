import {body,auth,quota,originOK,fail} from "../../src/community-core.js";
import {communityRead} from "../../src/community-read.js";
import {register,socialWrite} from "../../src/community-social.js";
import {gamesWrite} from "../../src/community-games.js";
export async function onRequestGet({request,env}) {
 if(!env.DB)return fail("Community database unavailable.",503);
 try{return await communityRead(request,env.DB)}catch(e){console.error("community GET",e);return fail("Unable to load community data.",503)}
}
export async function onRequestPost({request,env}) {
 if(!env.DB||!env.TURNSTILE_SECRET)return fail("Community backend unavailable.",503);
 if(!originOK(request))return fail("Origin rejected.",403);
 try {
 const d=await body(request),action=d?.action;
 if(action==="register")return await register(request,env.DB,env,d);
 const a=await auth(request,env.DB);if(!a)return fail("Sign in with your profile recovery key.",401);
 const categories={update_profile:"profile",comment:"comment",react:"react",follow:"follow",report:"report",delete_comment:"remove",delete_deck:"remove",delete_profile:"remove",publish_deck:"publish",version:"version",playtest:"playtest",challenge_entry:"entry",challenge_submit:"publish",vote:"vote"};
 const category=categories[action];if(!category)return fail("Unknown operation.",404);
 const caps={profile:15,comment:8,react:40,follow:40,report:8,remove:20,publish:4,version:15,playtest:15,entry:8,vote:30};
 if(!(await quota(env.DB,env,request,category,caps[category],a)))return fail("Daily community limit reached.",429);
 if(["publish_deck","version","playtest","challenge_entry","challenge_submit","vote"].includes(action))return await gamesWrite(env.DB,a,d);
 return await socialWrite(env.DB,a,d);
 }catch(e){console.error("community POST",e);return fail("Unable to save change.",503)}
}