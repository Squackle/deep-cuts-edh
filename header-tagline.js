/* Home navigation uses one page for Rescue Report and Commander Archive tabs. */
(() => {
 const label=document.querySelector(".site-header .wordmark-copy small");
 if(!label)return;
 const update=()=>{
  const words={"#latest":"TODAY'S RESCUE REPORT","#archive":"THE FORGOTTEN CASE FILES"};
  label.textContent=words[location.hash]||"OLD LEGENDS · NEW PURPOSE";
 };
 addEventListener("hashchange",update);
 update();
})();