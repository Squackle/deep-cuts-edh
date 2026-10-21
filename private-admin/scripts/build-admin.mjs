// Branch-specific build for a *synthetic-only* test preview.
// Shared Cloudflare Pages root=private-admin, command=node scripts/build-admin.mjs,
// output=public. This branch may NEVER be promoted as live admin production.
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const repo=path.resolve(root,"..");
const output=path.join(root,"public");
const entries=[
 "functions/api/security-staging-harness.js",
 "functions/api/profile-recovery.js",
 "functions/api/profile-device.js",
 "functions/api/community.js",
 "functions/api/arcane-games.js",
 "functions/api/kofi-webhook.js"
];
await Promise.all([path.join(root,"functions"),path.join(root,"src"),output].map(x=>fs.rm(x,{recursive:true,force:true})));
const seen=new Set();
async function copyFile(relative){
 if(seen.has(relative))return;
 seen.add(relative);
 if(!/^(functions|src)\//.test(relative)||!relative.endsWith(".js"))throw Error("Unexpected runtime file "+relative);
 const inPath=path.join(repo,relative);
 let contents=await fs.readFile(inPath,"utf8");
 const outPath=path.join(root,relative);
 await fs.mkdir(path.dirname(outPath),{recursive:true});
 await fs.writeFile(outPath,contents);
 for(const match of contents.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g)){
  const dependency=path.relative(repo,path.resolve(path.dirname(inPath),match[1]));
  if(!/^(functions|src)\//.test(dependency))throw Error("Unexpected source import: "+dependency);
  await copyFile(dependency);
 }
}
for(const name of entries)await copyFile(name);
const write=async(name,data)=>{
 const target=path.join(output,name);
 await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,data,"utf8");
};
await write("security-staging-acceptance.html",await fs.readFile(path.join(repo,"security-staging-acceptance.html"),"utf8"));
await write("index.html",'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><title>Private Security Tests</title></head><body><p>Protected synthetic security testing environment.</p><a href="/security-staging-acceptance.html">Open the staging acceptance runner</a></body></html>');
await write("_routes.json",JSON.stringify({version:1,include:["/*"],exclude:[]},null,2)+"\n");
await write("_headers","/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n  X-Frame-Options: DENY\n");
await fs.writeFile(path.join(root,"functions/_middleware.js"),[
 '// Defense in depth: the owner-only Cloudflare Access app remains mandatory.',
 'export async function onRequest({request,env,next}){',
 ' const host=new URL(request.url).hostname;',
 ' if(env.SECURITY_STAGING!=="true")return new Response("Disabled",{status:503});',
 ' if(host!=="security-isolated-test-lane-20261020.deepcuts-edh-security-staging.pages.dev")',
 '  return new Response("Not found",{status:404});',
 ' if(!request.headers.get("Cf-Access-Jwt-Assertion"))return new Response("Access required",{status:403});',
 ' return next();',
 '}',''
].join("\n"));
if(!seen.has("functions/api/security-staging-harness.js"))throw Error("Harness not included");
console.log("Synthetic-only security preview bundle built with "+seen.size+" imported JavaScript modules; zero production assets copied.");
