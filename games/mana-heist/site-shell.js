/* Public-site header height is not constant: responsive nav and supporter
 * ticker can change height. This is layout-only and never touches game state. */
(()=>{'use strict';
 const header=document.querySelector('.site-header');
 if(!header)return;
 const measure=()=>{
  const height=Math.max(0,Math.ceil(header.getBoundingClientRect().height));
  if(height>0)document.documentElement.style.setProperty('--mana-site-header-h',height+'px');
 };
 measure();
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(measure).observe(header);
 window.addEventListener('resize',measure,{passive:true});
})();
