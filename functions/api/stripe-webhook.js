/* The previous direct-Stripe webhook has been retired.
 * Do not use a Stripe billing notification to grant Ko-fi membership access. */
export function onRequestPost(){
 return new Response(JSON.stringify({error:"Direct Stripe subscriptions are retired; use Ko-fi."}),{status:410,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
}
