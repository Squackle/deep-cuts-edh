/** Single keyboard routing, shared by the browser and deterministic tests. */
export const KEY_DIRECTIONS=Object.freeze({
 ArrowUp:"up",ArrowRight:"right",ArrowDown:"down",ArrowLeft:"left",
 w:"up",a:"left",s:"down",d:"right",
 W:"up",A:"left",S:"down",D:"right"
});
export function keyboardDirection(key,repeat=false){
 return repeat?null:(KEY_DIRECTIONS[key]??null);
}

export const MUTATION_SELECTION_KEYS=Object.freeze({
 "1":0,"w":0,"W":0,"ArrowUp":0,
 "2":1,"a":1,"A":1,"ArrowLeft":1,
 "3":2,"s":2,"S":2,"ArrowDown":2
});
export function mutationSelectionIndex(key,repeat=false){
 return repeat?null:(Object.hasOwn(MUTATION_SELECTION_KEYS,key)?MUTATION_SELECTION_KEYS[key]:null);
}
export function isTouchMutationSelection(event,coarsePointer=false){
 if(event?.pointerType==="touch")return true;
 if(event?.pointerType==="mouse"||event?.pointerType==="pen")return false;
 return !!(coarsePointer&&event?.detail>0);
}
/** Invalid/reverse commands cannot release a keyboard-suspended mutation. */
export function resumeHeading(run,key,queueTurn){
 if(!run||run.status!=="running"||!Object.hasOwn(KEY_DIRECTIONS,key))return false;
 const heading=KEY_DIRECTIONS[key];
 if(heading===run.direction)return true;
 return queueTurn(heading);
}

/** Swipes share the keyboard's safe mutation-resume direction checks. */
export const SWIPE_RESUME_KEYS=Object.freeze({up:"ArrowUp",right:"ArrowRight",down:"ArrowDown",left:"ArrowLeft"});
export function swipeHeading(dx,dy,threshold=12){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.max(Math.abs(dx),Math.abs(dy))<threshold)return null;
 return Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up");
}
