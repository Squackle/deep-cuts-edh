import {chromium} from 'playwright-core';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

// Prefer the pinned Playwright headless browser. Existing CI can use system
// Chrome; CHROME_BIN allows an explicit local browser without changing tests.
export async function launchBrowser(){
 let executablePath=process.env.CHROME_BIN;
 if(!executablePath&&!existsSync(chromium.executablePath())){
  for(const binary of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
   try{executablePath=execFileSync('which',[binary],{encoding:'utf8'}).trim();break}catch{}
  }
 }
 return chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
}
