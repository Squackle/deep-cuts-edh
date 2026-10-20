// Exact bounded state graph: incomplete search never receives a rating.
export function analyze(adapter,{maxStates=3000,maxEdges=60000}={}){
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
 return {status:'complete',states:nodes.length,edges,shortestActions:route.length,route:route.reverse(),criticalChoices:decisions.length,meanBits:mean,peakBits:peak,pressure:Math.round(100*(1-Math.exp(-(.65*mean+.35*peak)/3))),decisions:decisions.reverse()};
}
