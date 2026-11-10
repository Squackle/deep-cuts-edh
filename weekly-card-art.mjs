// Treat a blocked/missing image as a visible card-art fallback, not an empty frame.
// "complete" handles a cached load/error that occurred before this module ran.
export function watchCardArt(figure,image){
 if(!figure||!image)return false;
 const loaded=()=>{image.hidden=false;figure.dataset.weeklyArtState='loaded'};
 const failed=()=>{image.hidden=true;figure.dataset.weeklyArtState='unavailable'};
 image.addEventListener('load',loaded,{once:true});
 image.addEventListener('error',failed,{once:true});
 if(image.complete)(image.naturalWidth>0?loaded:failed)();
 return true;
}
if(typeof document!=='undefined'){
 for(const image of document.querySelectorAll('[data-weekly-card-img]')){
  watchCardArt(image,image.closest('.weekly-commander-art'));
 }
}
