// Snapshot an explicit local asset set before listening. Request text never
// becomes a filesystem path; symlinks, hidden files and dependency trees stay out.
import {createServer} from 'node:http';
import {readdirSync,readFileSync} from 'node:fs';
import {join,extname} from 'node:path';
const mime={'.js':'application/javascript','.mjs':'application/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.ico':'image/x-icon'};
const excluded=new Set(['node_modules','functions','tests','scripts','docs']);
export function createAssetServer(mounts){
 const assets=new Map();
 function walk(directory,url){
  for(const entry of readdirSync(directory,{withFileTypes:true})){
   if(entry.name.startsWith('.')||excluded.has(entry.name)||entry.isSymbolicLink())continue;
   const filename=join(directory,entry.name),key=url+entry.name;
   if(entry.isDirectory())walk(filename,key+'/');
   else if(entry.isFile()&&mime[extname(entry.name)]){
    const asset={type:mime[extname(entry.name)],body:readFileSync(filename)};
    assets.set(key,asset);
    if(entry.name==='index.html')assets.set(url,asset);
   }
  }
 }
 for(const {directory,url='/'}of mounts)walk(directory,url);
 return createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method))return res.writeHead(405).end();
  let key;try{key=new URL(req.url,'http://local').pathname}catch{return res.writeHead(400).end();}
  const asset=assets.get(key);
  if(!asset)return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
  res.end(req.method==='HEAD'?undefined:asset.body);
 });
}
