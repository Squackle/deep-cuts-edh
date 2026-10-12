// Username/password accounts retired. The previous endpoint is permanently disabled.
// A recovery-key vault remains available at /api/vault.
// Password data was never stored in browser localStorage by the retired UI.
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
function retired(){return new Response(JSON.stringify({error:"Username/password accounts have been retired. Use the recovery-key cloud vault in the Deck Workshop.",migrateTo:"/deck.html#save"}),{status:410,headers});}
export function onRequestGet(){return retired();}
export function onRequestPost(){return retired();}
