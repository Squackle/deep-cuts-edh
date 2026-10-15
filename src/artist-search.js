/* Ranked artist matching against Scryfall's canonical catalog.
 * Keep display names intact; normalize only for matching, never for output.
 */
export function foldArtist(value){
 return String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
function editDistance(a,b,max){
 if(Math.abs(a.length-b.length)>max)return max+1;
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const next=[i];
  for(let j=1;j<=b.length;j++)
   next[j]=Math.min(prev[j]+1,next[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
  if(Math.min(...next)>max)return max+1;
  prev=next;
 }
 return prev[b.length];
}
export function artistSuggestions(catalog,input,limit=8){
 const q=foldArtist(input);
 if(q.length<2||q.length>80||!Array.isArray(catalog))return [];
 const max= Math.max(1,Math.min(8,Math.floor(Number(limit)||8)));
 const found=[];
 for(const name of catalog){
  if(typeof name!=="string")continue;
  const value=foldArtist(name);
  if(!value)continue;
  const words=value.split(" ");
  let tier=Infinity,dist=0;
  if(value===q)tier=0;
  else if(value.startsWith(q))tier=1;
  else if(words.some(w=>w.startsWith(q)))tier=2;
  else if(value.includes(q))tier=3;
  else if(q.includes(" ")&&q.split(" ").every(piece=>words.some(w=>w.startsWith(piece))))tier=4;
  else if(q.length>=4){
   const maxEdit=q.length<=5?1:2;
   const candidates=[value,...words];
   for(const candidate of candidates){
    if(Math.abs(candidate.length-q.length)>maxEdit)continue;
    const n=editDistance(q,candidate,maxEdit);
    if(n<=maxEdit&&n>=1){tier=5;dist=n;break}
   }
  }
  if(Number.isFinite(tier))found.push({name,tier,dist,size:value.length});
 }
 found.sort((a,b)=>a.tier-b.tier||a.dist-b.dist||a.size-b.size||a.name.localeCompare(b.name));
 return [...new Map(found.map(x=>[foldArtist(x.name),x.name])).values()].slice(0,max);
}
