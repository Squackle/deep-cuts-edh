/** Per-visit score records, keyed by selected game mode and expedition. */
export function createSessionBest(){
 const scores=new Map();
 return Object.freeze({
  get:key=>scores.get(key)||0,
  record(key,score){
   const safe=Number.isFinite(score)?Math.max(0,Math.floor(score)):0;
   const best=Math.max(scores.get(key)||0,safe);
   scores.set(key,best);return best;
  }
 });
}
