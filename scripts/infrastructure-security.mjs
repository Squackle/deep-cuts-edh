// Strict verifier for the site's small editorial navigation-label grammar.
// Not a general HTML parser or a sanitizer for rendering untrusted content.
export function navigationLabel(markup){
 if(typeof markup!=="string"||markup.length>4096||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(markup))
  throw new Error("Unexpected navigation label markup");
 const stack=[],parts=[];
 const token=/<(\/?)(span|strong|em|b|i)(?:\s+class="([A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*)")?\s*>|[^<>]+/giy;
 let pos=0;
 while(pos<markup.length){
  token.lastIndex=pos;
  const match=token.exec(markup);
  if(!match)throw new Error("Unexpected navigation label markup");
  pos=token.lastIndex;
  if(!match[2]){
   parts.push(match[0]);
   continue;
  }
  const tag=match[2].toLowerCase();
  if(match[1]){
   if(match[3]!==undefined||stack.pop()!==tag)throw new Error("Mismatched navigation label tag");
  }else{
   if(match[3]!==undefined&&tag!=="span")throw new Error("Unexpected navigation label attribute");
   stack.push(tag);
  }
 }
 if(stack.length)throw new Error("Unclosed navigation label tag");
 // Decode only the existing editorial ampersand representation; no recursive decode.
 return parts.join("").replace(/\s+/g," ").trim().replaceAll("&amp;","&");
}
export function isAccessRedirect(location,base){
 if(typeof location!=="string"||!location||/[\u0000-\u0020\u007f\\]/.test(location))return false;
 try{
  const origin=new URL(base),url=new URL(location,origin);
  if(url.protocol!=="https:"||url.username||url.password||url.port)return false;
  const teamHost=/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/i.test(url.hostname);
  return (teamHost||url.origin===origin.origin)&&url.pathname.startsWith("/cdn-cgi/access/");
 }catch{return false}
}
