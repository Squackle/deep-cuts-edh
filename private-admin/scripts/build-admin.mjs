// Private, allowlisted Pages build. Project root: private-admin.
// Build command: node scripts/build-admin.mjs ; output directory: public.
// Only public/ is static. functions/ and src/ are runtime server modules.
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const repo=path.resolve(root,".."),pub=path.join(root,"public");
const routes=path.join(root,"functions"),server=path.join(root,"src");
const website="https://deep-cuts-edh.pages.dev";
const assets=[
 "styles.css","retro.css","theme-v2.css","members.css",
 "member-operations.js","owner-console.js","owner-evidence.js","owner-adfree.js",
 "owner-dashboard.js","owner-v2.js","owner-services.js",
 "owner-dashboard.css","owner-v2.css","owner-services.css",
 "diagnostics.js","diagnostics.css","assets/favicon.svg","assets/deep-cuts-mark.svg"
];
const adminRoutes=["owner-ops","owner-members","kofi-diagnostics","kofi-member-issue"];
const sourceMods=["owner-access.js","owner-capacity.js","member-auth.js","community-core.js",
 "kofi-adfree.js","profile-email.js","field-reputation.js","field-dispatches.js"];
const source=filename=>fs.readFile(path.join(repo,filename),"utf8");
async function put(filename,body){await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,body)}
await Promise.all([pub,routes,server].map(p=>fs.rm(p,{recursive:true,force:true})));
for(const asset of assets)await put(path.join(pub,asset),await source(asset));
for(const route of adminRoutes)await put(path.join(routes,"api",route+".js"),await source("functions/api/"+route+".js"));
for(const name of sourceMods)await put(path.join(server,name),await source("src/"+name));
const ad=(await source("functions/api/ad-entitlement.js")).replaceAll("../../src/","./");
const field=(await source("functions/api/field-expansion.js")).replaceAll("../../src/","./");
await put(path.join(server,"owner-ad-entitlement.js"),ad);
await put(path.join(server,"owner-field-expansion.js"),field);
// Presence is READ-ONLY here: the source module is imported, not exposed as a route.
await put(path.join(server,"owner-presence.js"),await source("functions/api/site-presence.js"));
let ops=await source("functions/api/owner-ops.js");
if(!ops.includes('from "./site-presence.js"'))throw Error("Unknown owner-presence import");
ops=ops.replace('from "./site-presence.js"','from "../../src/owner-presence.js"');
await put(path.join(routes,"api","owner-ops.js"),ops);
// Owner reconciliation delegates existing validated behavior, but the private
// admin route does not expose public/anonymous variants of the original API.
await put(path.join(routes,"api","ad-entitlement.js"),[
 '// Admin-only ad-free reconciliation; no anonymous status route.',
 'import {ownerAuth} from "../../src/owner-access.js";',
 'import {reply} from "../../src/member-auth.js";',
 'import {onRequestPost as run} from "../../src/owner-ad-entitlement.js";',
 'export async function onRequestPost(ctx){',
 ' const a=await ownerAuth(ctx.request,ctx.env);if(a.error)return a.error;',
 ' return run(ctx);',
 '}',
 'export function onRequestGet(){return reply({error:"Not available."},405)}',
 ''].join("\n"));
await put(path.join(routes,"api","field-expansion.js"),[
 '// Only owner evidence moderation is available here, never public collection routes.',
 'import {ownerAuth} from "../../src/owner-access.js";',
 'import {reply} from "../../src/member-auth.js";',
 'import {onRequestPost as run} from "../../src/owner-field-expansion.js";',
 'export async function onRequestPost(ctx){',
 ' const a=await ownerAuth(ctx.request,ctx.env);if(a.error)return a.error;',
 ' let d;try{d=await ctx.request.clone().json()}catch{return reply({error:"Invalid request."},400)}',
 ' if(d?.action!=="feature_evidence")return reply({error:"Unsupported action."},404);',
 ' return run(ctx);',
 '}',
 'export function onRequestGet(){return reply({error:"Not available."},405)}',
 ''].join("\n"));
await put(path.join(routes,"_middleware.js"),[
 '// Cloudflare Access policy is MANDATORY and must be verified out of band.',
 '// Checking a JWT header here does not cryptographically verify its signature.',
 'export async function onRequest({request,env,next}){',
 ' if(env.PRIVATE_ADMIN_ENABLED!=="true")return new Response("Private admin not enabled.",{status:503});',
 ' const url=new URL(request.url),host=url.hostname;',
 ' const canonical=host==="deepcuts-edh-security-staging.pages.dev";',
 ' const preview=host.endsWith(".deepcuts-edh-security-staging.pages.dev");',
 ' if(url.protocol!=="https:"||!((canonical&&env.PRIVATE_ADMIN_MODE==="live")||(preview&&env.PRIVATE_ADMIN_MODE==="synthetic")))',
 '  return new Response("Not found.",{status:404});',
 ' if(!request.headers.get("Cf-Access-Jwt-Assertion"))return new Response("Access required.",{status:403});',
 ' return next();',
 '}',
 ''].join("\n"));
let ownerPage=await source("member-operations.html");
ownerPage=ownerPage.replaceAll('href="members.html"','href="'+website+'/members.html"')
 .replaceAll('href="supporters.html"','href="'+website+'/supporters.html"')
 .replaceAll('Ko-fi Member Issuance | Deep Cuts EDH','Private Owner Command Center | Deep Cuts EDH');
await put(path.join(pub,"member-operations.html"),ownerPage);
let diag=await source("diagnostics.html");
diag=diag.replace('<link rel="stylesheet" href="/header-profile.css"><script defer src="/header-profile.js"></script>','')
 .replaceAll('href="supporters.html"','href="'+website+'/supporters.html"');
await put(path.join(pub,"diagnostics.html"),diag);
const landing='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Private DeepCutsEDH Operations</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#14251d;color:#f5eedc;margin:0}main{max-width:680px;margin:12vh auto;padding:35px;border:1px solid #876e41;border-radius:12px}a{display:block;background:#283d30;color:#f6e4b3;padding:16px 20px;margin:12px 0;border-radius:8px}h1{font:2.3rem Georgia,serif}p{color:#ddd1b8}</style></head><body><main><h1>Private Field Office</h1><p>Owner-only operations. Cloudflare Access and independent keys protect administrative functions.</p><a href="/member-operations.html">Owner Command Center</a><a href="/diagnostics.html">Webhook diagnostics</a><p>Member activities remain at the <a href="'+website+'/">public DeepCutsEDH website</a>.</p></main></body></html>';
await put(path.join(pub,"index.html"),landing);
await put(path.join(pub,"_headers"),[
 '/*','  X-Robots-Tag: noindex, nofollow, noarchive','  Referrer-Policy: no-referrer',
 '  X-Content-Type-Options: nosniff','  X-Frame-Options: DENY',
 '  Cache-Control: no-store',''].join("\n"));
await put(path.join(pub,"_routes.json"),JSON.stringify({version:1,include:["/*"],exclude:[]},null,2)+"\n");
const actual=(await fs.readdir(path.join(routes,"api"))).sort();
const expected=[...adminRoutes.map(x=>x+".js"),"ad-entitlement.js","field-expansion.js"].sort();
if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error("Unapproved Pages Function "+JSON.stringify(actual));
console.log("Private admin build OK:",assets.length+" static dependencies",actual.length+" restricted HTTP functions");
