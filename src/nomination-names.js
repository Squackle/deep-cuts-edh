// Canonicalize community nominations against active candidates only.
// Never silently merge ambiguous commanders, retired entries or unrelated cards.
export const nominationKey=value=>String(value||"").normalize("NFKD")
 .replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
const shortName=name=>String(name||"").split(",")[0].trim();
export function editDistance(a,b,max=3){
 if(Math.abs(a.length-b.length)>max)return max+1;
 let prev=Array.from({length:b.length+1},(_,j)=>j);
 for(let i=1;i<=a.length;i++){
  const row=[i];let best=i;
  for(let j=1;j<=b.length;j++){
   const d=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
   row[j]=d;if(d<best)best=d;
  }
  if(best>max)return max+1;
  prev=row;
 }
 return prev[b.length];
}
export function findExistingNomination(input,rows=[]){
 const submitted=nominationKey(input);
 if(submitted.length<5)return null;
 const active=rows.filter(x=>x&&["approved","pending"].includes(x.status));
 const exact=active.filter(x=>nominationKey(x.name)===submitted||nominationKey(x.slug)===submitted);
 if(exact.length===1)return {record:exact[0],method:"exact"};
 if(exact.length>1)return null;
 const shorter=active.filter(x=>x.name.includes(",")&&nominationKey(shortName(x.name))===submitted);
 if(shorter.length===1)return {record:shorter[0],method:"short-name"};
 if(shorter.length>1)return null;
 // Very small typos only, against the full name or the part before the comma.
 // A tie or near tie is ambiguous and must go through the owner review queue.
 const limit=submitted.length<8?1:submitted.length<15?2:3;
 const candidates=[];
 for(const x of active){
  const names=[nominationKey(x.name)];
  if(x.name.includes(","))names.push(nominationKey(shortName(x.name)));
  const dist=Math.min(...names.filter(Boolean).map(v=>editDistance(submitted,v,limit)));
  if(dist<=limit&&dist/Math.max(submitted.length,5)<=0.18)candidates.push({record:x,dist});
 }
 candidates.sort((a,b)=>a.dist-b.dist);
 if(candidates.length===0)return null;
 if(candidates.length>1&&candidates[1].dist-candidates[0].dist<2)return null;
 return {record:candidates[0].record,method:"minor-spelling"};
}
