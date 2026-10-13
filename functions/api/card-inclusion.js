// EDHREC inclusion is not Scryfall rarity or edhrec_rank. Uses fixed upstream host
// and a throttled client; no claims when the unofficial API cannot be verified.
function reply(data,seconds){
 return new Response(JSON.stringify(data),{status:200,headers:{
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"public, max-age="+seconds+", s-maxage="+seconds,
  "X-Content-Type-Options":"nosniff"
 }});
}
export async function onRequestGet({request}){
 const input=new URL(request.url).searchParams.get("name")||"";
 if(input.length<2||input.length>110||input.includes("//")||/[<>\\]/.test(input))
  return reply({available:false},600);
 const simplify=value=>String(value).normalize("NFKD").toLowerCase()
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
 const slug=simplify(input);
 if(!slug||slug.length>110)return reply({available:false},600);
 const key=new Request(new URL("/api/card-inclusion?name="+encodeURIComponent(slug),request.url).toString());
 const edge=typeof caches!=="undefined"?caches.default:null;
 try{const cached=edge?await edge.match(key):null;if(cached)return cached}catch{}
 let response=reply({available:false},600);
 try{
  const upstream=await fetch("https://json.edhrec.com/pages/cards/"+slug+".json",{
   headers:{"Accept":"application/json"},
   signal:AbortSignal.timeout(4500),
   cf:{cacheTtl:86400,cacheEverything:true}
  });
  if(upstream.ok){
   const size=Number(upstream.headers.get("content-length")||0);
   if(size<=2000000){
    const raw=await upstream.text();
    if(raw.length<=2000000){
     const card=JSON.parse(raw)?.container?.json_dict?.card;
     const num=Number(card?.num_decks),den=Number(card?.potential_decks);
     if(simplify(card?.sanitized||card?.name||"")===slug
      &&Number.isInteger(num)&&Number.isInteger(den)
      &&num>=0&&den>=1000&&num<=den){
      const percent=Math.round(num/den*1000000)/10000;
      response=reply({available:true,percent,num_decks:num,
       potential_decks:den,underplayed:percent<=1,
       url:"https://edhrec.com/cards/"+slug,source:"EDHREC"},86400);
     }
    }
   }
  }
 }catch{}
 try{if(edge)await edge.put(key,response.clone())}catch{}
 return response;
}
