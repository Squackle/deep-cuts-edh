// Optional, route-order-invariant diagnostic across ALL shortest winning plans.
// Its two extrema are separate statistics, not a calibrated scalar difficulty
// grade or a guarantee that both extrema occur on the same strategy.
function shortestRouteRange(nodes,wins,good){
 // BFS discovery order guarantees predecessors of a shortest path are visited first.
 const distances=Array(nodes.length).fill(Infinity);distances[0]=0;
 for(let i=0;i<nodes.length;i++){
  if(!Number.isFinite(distances[i]))continue;
  for(const j of nodes[i].next)distances[j]=Math.min(distances[j],distances[i]+1);
 }
 let shortest=Infinity;
 for(const i of wins)shortest=Math.min(shortest,distances[i]);
 const remaining=Array(nodes.length).fill(Infinity),queue=[];
 for(const i of wins){remaining[i]=0;queue.push(i);}
 for(let i=0;i<queue.length;i++){
  const node=queue[i];
  for(const prev of nodes[node].prev)if(remaining[prev]>remaining[node]+1){
   remaining[prev]=remaining[node]+1;queue.push(prev);
  }
 }
 const onShortest=i=>distances[i]+remaining[i]===shortest;
 const minCritical=Array(nodes.length).fill(Infinity),maxCritical=Array(nodes.length).fill(-Infinity);
 const minPeak=Array(nodes.length).fill(Infinity),maxPeak=Array(nodes.length).fill(-Infinity);
 minCritical[0]=maxCritical[0]=minPeak[0]=maxPeak[0]=0;
 for(let i=0;i<nodes.length;i++){
  if(!onShortest(i)||!Number.isFinite(minCritical[i]))continue;
  const n=nodes[i],winning=n.next.filter(j=>good.has(j)).length;
  const critical=winning>0&&winning<n.next.length;
  const bits=critical?Math.log2(n.next.length/winning):0;
  for(const j of n.next){
   if(!onShortest(j)||distances[j]!==distances[i]+1)continue;
   minCritical[j]=Math.min(minCritical[j],minCritical[i]+Number(critical));
   maxCritical[j]=Math.max(maxCritical[j],maxCritical[i]+Number(critical));
   minPeak[j]=Math.min(minPeak[j],Math.max(minPeak[i],bits));
   maxPeak[j]=Math.max(maxPeak[j],Math.max(maxPeak[i],bits));
  }
 }
 const closestWins=wins.filter(i=>distances[i]===shortest);
 const range={
  minCriticalChoices:Math.min(...closestWins.map(i=>minCritical[i])),
  maxCriticalChoices:Math.max(...closestWins.map(i=>maxCritical[i])),
  minPeakBits:Math.min(...closestWins.map(i=>minPeak[i])),
  maxPeakBits:Math.max(...closestWins.map(i=>maxPeak[i]))
 };
 return {...range,strategiesDiffer:range.minCriticalChoices!==range.maxCriticalChoices||Math.abs(range.minPeakBits-range.maxPeakBits)>1e-12};
}
// Exact bounded state graph: incomplete search never receives a rating.
export function analyze(adapter,{maxStates=3000,maxEdges=60000,includeStrategyRange=false}={}){
 if(!Number.isSafeInteger(maxStates)||maxStates<1||!Number.isSafeInteger(maxEdges)||maxEdges<1)throw new RangeError('Search budgets must be positive safe integers');
 const start=adapter.initial(),nodes=[{state:start,next:[],prev:[],parent:-1,move:null}],seen=new Map([[adapter.key(start),0]]);let edges=0;
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i];if(adapter.won(n.state)||adapter.lost?.(n.state))continue;
  for(const [move,state] of adapter.next(n.state)){
   const key=adapter.key(state);let index=seen.get(key);
   if(index===undefined){if(nodes.length>=maxStates)return {status:'inconclusive',states:nodes.length,reason:'state-budget'};index=nodes.length;seen.set(key,index);nodes.push({state,next:[],prev:[],parent:i,move});}
   if(n.next.includes(index))continue;
   if(++edges>maxEdges)return {status:'inconclusive',states:nodes.length,reason:'edge-budget'};
   n.next.push(index);nodes[index].prev.push(i);
  }
 }
 const wins=nodes.map((n,i)=>adapter.won(n.state)?i:-1).filter(i=>i>=0),good=new Set(wins),q=[...wins];
 for(let i=0;i<q.length;i++)for(const p of nodes[q[i]].prev)if(!good.has(p)){good.add(p);q.push(p);}
 if(!good.has(0))return {status:'unsolvable',states:nodes.length,edges};
 // BFS construction gives a shortest-action winning route. No claim about human speed.
 let at=wins[0],route=[],decisions=[];
 while(nodes[at].parent>=0){route.push(nodes[at].move);const p=nodes[at].parent,n=nodes[p],winning=n.next.filter(x=>good.has(x)).length;
 if(winning>0&&winning<n.next.length)decisions.push({choices:n.next.length,winning,bits:Math.log2(n.next.length/winning),move:nodes[at].move});at=p;}
 const mean=decisions.length?decisions.reduce((s,d)=>s+d.bits,0)/decisions.length:0,peak=decisions.length?Math.max(...decisions.map(d=>d.bits)):0;
 return {status:'complete',states:nodes.length,edges,shortestActions:route.length,route:route.reverse(),criticalChoices:decisions.length,meanBits:mean,peakBits:peak,pressure:Math.round(100*(1-Math.exp(-(.65*mean+.35*peak)/3))),decisions:decisions.reverse(),...(includeStrategyRange?{strategyRange:shortestRouteRange(nodes,wins,good)}:{})};
}
