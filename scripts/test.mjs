// Local-only default. Discover new suites automatically; preserve existing
// side-effect suite imports without executing their tests twice.
import {readdirSync,readFileSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const mode=process.argv[2]||'all';
if(!['all','unit','browser','workers'].includes(mode))throw Error('Use all, unit, browser or workers');
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(dir,e.name)):[resolve(dir,e.name)]);
const files=['tests','games/hive-run/tests'].flatMap(walk).filter(f=>f.endsWith('.test.mjs')&&!f.endsWith('/owner-access-smoke.test.mjs')).sort();
const source=new Map(files.map(f=>[f,readFileSync(f,'utf8')]));
const dependencies=f=>[...source.get(f).matchAll(/import\s+["'](\.[^"']+\.test\.mjs)["']/g)].map(m=>resolve(dirname(f),m[1]));
function group(f){
 if(f.endsWith('-workers.test.mjs'))return 'workers';
 if(/from ["'](?:playwright-core|\.\/helpers\/browser.mjs)["']/.test(source.get(f)))return 'browser';
 return dependencies(f).some(d=>group(d)==='browser')?'browser':'unit';
}
let failed=false;
for(const kind of mode==='all'?['unit','workers','browser']:[mode]){
 const selected=files.filter(f=>group(f)===kind);
 const imported=new Set(selected.flatMap(dependencies));
 const entries=selected.filter(f=>!imported.has(f));
 if(!entries.length)throw Error('No tests discovered for '+kind);
 console.log(`\n${kind}: ${selected.length} suites, ${entries.length} entrypoints (no production requests)`);
 const flags=kind==='workers'?[]:['--import',resolve('tests/helpers/offline.mjs')];
 const result=spawnSync(process.execPath,[...flags,'--test','--test-concurrency=2',...entries.map(f=>relative(root,f))],{stdio:'inherit'});
 if(result.status!==0)failed=true;
}
process.exitCode=failed?1:0;
