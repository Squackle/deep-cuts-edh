/* Deep Cuts EDH sitewide Google Analytics 4 bootstrap.
 * Loaded once from the shared header on public pages (or directly on a
 * standalone page). Do not track private account/owner routes or URL
 * query strings, which can contain personal or recovery parameters.
 */
(() => {
  "use strict";
  const MEASUREMENT_ID="G-7SGFYBRH9H";
  if(window.__deepCutsGa4Loaded)return;
  const pathname=window.location.pathname;
  const EXCLUDED=/^\/(?:profile|members|member-operations|diagnostics|api)(?:\b|\/|\.html$)/;
  if(EXCLUDED.test(pathname))return;
  // Honor a browser's explicit Global Privacy Control signal.
  if(navigator.globalPrivacyControl===true)return;

  window.__deepCutsGa4Loaded=true;
  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function gtag(){window.dataLayer.push(arguments);};

  const stripParameters=raw=>{
    try{
      const u=new URL(raw,window.location.href);
      return /^https?:$/.test(u.protocol)?u.origin+u.pathname:"";
    }catch{return "";}
  };
  window.gtag("js",new Date());
  window.gtag("config",MEASUREMENT_ID,{
    page_location:window.location.origin+pathname,
    page_referrer:stripParameters(document.referrer||"")
  });

  const tag=document.createElement("script");
  tag.async=true;
  tag.src="https://www.googletagmanager.com/gtag/js?id="+MEASUREMENT_ID;
  document.head.append(tag);
})();
