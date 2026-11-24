// An AUTHORING gate, not a player skill rating. Never increases a score for
// extra moves. Adequate search coverage and distinct reviewed decision families
// are required before declaring an increasing reasoning curriculum.
export function checkProgression(rows,{bands=5,minCoverage=.9,minRise=3}={}){
 const groups=Array.from({length:bands},(_,i)=>rows.filter(r=>r.band===i+1));
 const summary=groups.map((group,i)=>{
  const known=group.filter(r=>r.analysis.status==='complete');
  const values=known.map(r=>r.analysis.pressure).sort((a,b)=>a-b);
  const median=values.length?(values[Math.floor((values.length-1)/2)]+values[Math.ceil((values.length-1)/2)])/2:null;
  return {band:i+1,total:group.length,measured:known.length,coverage:known.length/Math.max(1,group.length),median};
 });
 const reasons=[];
 if(rows.some(r=>r.analysis.status==='unsolvable'))reasons.push('At least one puzzle is proven unsolvable');
 for(const b of summary)if(!b.total||b.coverage<minCoverage)reasons.push(`Band ${b.band}: insufficient exact search coverage`);
 for(let i=1;i<summary.length;i++){
  const a=summary[i-1],b=summary[i];
  if(a.median!==null&&b.median!==null&&b.median<a.median+minRise)reasons.push(`Band ${b.band}: measured choice pressure does not rise by ${minRise}`);
 }
 if(rows.some(r=>r.reference?.shortcut))reasons.push('Recorded solution lengths overstate necessary responses');
 return {accepted:reasons.length===0,reasons,bands:summary,
  caveat:'Passing is an authoring signal only: independent human playtesting, rule review and family/strategy diversity review remain required.'};
}
