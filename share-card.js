/* Share panel for Case File Cards (issue #65): Copy Link, PNG download and
 * native share. The card SVG is same-origin and self-contained (no external
 * images or fonts), so drawing it to a canvas does not taint the canvas. */
(()=>{
 const status=(panel,msg)=>{const el=panel.querySelector('.share-card-status');if(el)el.textContent=msg};
 async function copy(panel){
  const url=panel.dataset.shareUrl;
  try{await navigator.clipboard.writeText(url);status(panel,'Link copied.')}
  catch{
   const t=document.createElement('textarea');t.value=url;t.setAttribute('readonly','');t.style.position='fixed';t.style.opacity='0';
   document.body.append(t);t.select();
   let ok=false;try{ok=document.execCommand('copy')}catch{}
   t.remove();status(panel,ok?'Link copied.':'Copy failed. The link is: '+url);
  }
 }
 async function png(panel){
  status(panel,'Preparing image…');
  try{
   const res=await fetch(panel.dataset.shareImage,{credentials:'omit'});
   if(!res.ok)throw Error('HTTP '+res.status);
   const svgUrl=URL.createObjectURL(new Blob([await res.text()],{type:'image/svg+xml'}));
   const img=new Image();img.decoding='async';
   await new Promise((ok,fail)=>{img.onload=ok;img.onerror=()=>fail(Error('decode'));img.src=svgUrl});
   const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630;
   canvas.getContext('2d').drawImage(img,0,0,1200,630);URL.revokeObjectURL(svgUrl);
   const blob=await new Promise(ok=>canvas.toBlob(ok,'image/png'));
   if(!blob)throw Error('encode');
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(panel.dataset.shareFile||'deep-cuts-case-file')+'.png';
   document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
   status(panel,'Image downloaded.');
  }catch{status(panel,'PNG export is not supported in this browser. Use Download SVG instead.')}
 }
 async function native(panel){
  try{await navigator.share({title:document.title,text:panel.dataset.shareText,url:panel.dataset.shareUrl})}catch{}
 }
 function init(){
  for(const panel of document.querySelectorAll('[data-share-card]')){
   const nativeBtn=panel.querySelector('[data-share-action="native"]');
   if(nativeBtn&&typeof navigator.share==='function')nativeBtn.hidden=false;
   panel.addEventListener('click',e=>{
    const action=e.target.closest('[data-share-action]')?.dataset.shareAction;
    if(action==='copy')copy(panel);else if(action==='png')png(panel);else if(action==='native')native(panel);
   });
  }
 }
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
