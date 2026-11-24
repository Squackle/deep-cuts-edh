// Browser-only JSON requests for the public discovery tools.
// Bound both the network request and body read, and propagate caller cancellation.
export async function requestJson(url,{signal,timeoutMs=20000,...options}={},fetchImpl=fetch){
 const controller=new AbortController();
 const cancel=()=>controller.abort(signal?.reason);
 if(signal?.aborted)cancel();
 else signal?.addEventListener('abort',cancel,{once:true});
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
 try{
  const response=await fetchImpl(url,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});
  let data;
  try{data=await response.json()}catch(error){
   if(controller.signal.aborted)throw error;
   throw Error('Card service returned an unreadable response.');
  }
  if(!response.ok)throw Error(typeof data?.error==='string'?data.error:typeof data?.details==='string'?data.details:'Lookup failed ('+response.status+').');
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Card service returned an incomplete response.');
  return data;
 }catch(error){
  if(timedOut)throw Error('The lookup timed out. Please try again.');
  throw error;
 }finally{
  clearTimeout(timer);
  signal?.removeEventListener('abort',cancel);
 }
}
