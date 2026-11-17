// A native outward swipe at the edge of this deck can be interpreted as browser
// history navigation. Keep only that gesture here; inward pans and taps stay native.
// React19 invokes the returned cleanup when its callback ref is retired.
export function bindV100BattleCardPanGuard(pane){
 if(!pane)return;
 let start=null;
 const clear=()=>{start=null;};
 const onStart=event=>{
  if(event.touches.length!==1||!pane.closest('.v100-shell .game-frame[data-battle-hud-layout="mobile"]')){clear();return;}
  const touch=event.touches[0],end=Math.max(0,pane.scrollWidth-pane.clientWidth);
  start={x:touch.clientX,y:touch.clientY,left:pane.scrollLeft<=1,right:pane.scrollLeft>=end-1};
 };
 const onMove=event=>{
  if(event.touches.length!==1){clear();return;}
  if(!start)return;
  const touch=event.touches[0],dx=touch.clientX-start.x,dy=touch.clientY-start.y;
  if(Math.abs(dx)<6||Math.abs(dx)<=Math.abs(dy))return;
  if(((start.left&&dx>0)||(start.right&&dx<0))&&event.cancelable)event.preventDefault();
 };
 pane.addEventListener('touchstart',onStart,{passive:true});
 pane.addEventListener('touchmove',onMove,{passive:false});
 pane.addEventListener('touchend',clear,{passive:true});
 pane.addEventListener('touchcancel',clear,{passive:true});
 return()=>{clear();pane.removeEventListener('touchstart',onStart);pane.removeEventListener('touchmove',onMove);pane.removeEventListener('touchend',clear);pane.removeEventListener('touchcancel',clear);};
}
