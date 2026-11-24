/* Server-side homepage feature: write the newest Weekly Rescue into the
 * homepage HTML before it reaches the browser, so visitors never see last
 * week's commander flash before the client script catches up. Every
 * replacement is exact; if the expected markup is missing, the original HTML
 * is returned unchanged. */
import {escaped} from './weekly-rescues-html.js';
import {trustedCardImage,validWeeklyDate} from '../home-weekly-feature.mjs';

export function homeFeatureModel(row){
 if(!row||typeof row!=='object'||!validWeeklyDate(row.date))return null;
 const commander=typeof row.commander==='string'?row.commander.trim():'';
 const theme=typeof row.theme==='string'?row.theme.trim():'';
 const image=trustedCardImage(row.imageUrl);
 if(!commander||commander.length>110||!theme||theme.length>130||!image)return null;
 return {date:row.date,commander,theme,image,url:'/rescues/'+row.date};
}

export function applyLatestToHomeHtml(html,row){
 const m=homeFeatureModel(row);
 if(typeof html!=='string'||!m)return html;
 const current=html.match(/id="homeWeeklyFeature" data-weekly-date="(20\d\d-\d\d-\d\d)"/)?.[1];
 if(!current||m.date<current)return html;
 const name=escaped(m.commander),short=escaped(m.commander.split(',')[0]);
 // Each replacement is a function, so report text is never read as a $-pattern.
 const swaps=[
  [/(<a class="hub-feature" id="homeWeeklyFeature" data-weekly-date=")[^"]*(" href=")[^"]*(")/,(_,a,b,c)=>a+m.date+b+m.url+c],
  [/(<span data-weekly-date-label>)[^<]*(<\/span>)/,(_,a,b)=>a+m.date+b],
  [/(<img data-weekly-image src=")[^"]*("[^>]*?alt=")[^"]*(")/,(_,a,b,c)=>a+escaped(m.image)+b+name+c],
  [/(<strong data-weekly-name>)[^<]*(<\/strong>)/,(_,a,b)=>a+name+b],
  [/(<small data-weekly-theme>)[^<]*(<\/small>)/,(_,a,b)=>a+escaped(m.theme)+b],
  [/(<a id="homeLatestWeeklyText" href=")[^"]*(">)[^<]*(<\/a>)/,(_,a,b,c)=>a+m.url+b+'LATEST: '+short+' ↗'+c]
 ];
 let out=html;
 for(const [pattern,replace] of swaps){
  if(!pattern.test(out))return html;
  out=out.replace(pattern,replace);
 }
 return out;
}
