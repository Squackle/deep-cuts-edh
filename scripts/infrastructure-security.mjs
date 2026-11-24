// Verification helpers: reject ambiguous markup and parse redirect destinations.
export function navigationLabel(markup){
 // Allow only text and simple inline formatting tags; never repair malformed HTML.
 if(!/^(?:[^<>]|<\/?(?:span|strong|em|b|i)(?:\s+[a-zA-Z][\w-]*="[^"<>]*")*\s*>)*$/i.test(markup))
  throw new Error("Unexpected navigation label markup");
 const text=markup.replace(/<\/?(?:span|strong|em|b|i)(?:\s+[a-zA-Z][\w-]*="[^"<>]*")*\s*>/gi,"");
 if(/[<>]/.test(text))throw new Error("Unexpected navigation label delimiters");
 return text.replace(/\s+/g," ").trim().replaceAll("&amp;","&");
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
