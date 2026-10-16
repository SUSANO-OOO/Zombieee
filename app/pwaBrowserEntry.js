// Let the declined-install button acknowledge its native gesture and paint
// before mounting the game. This changes no save, download or audio owner.
export function createPaintedBrowserEntry({requestFrame,cancelFrame,onPending,onEnter}) {
  let state='idle',frame=null;
  return {
    request() {
      if(state!=='idle')return false;
      state='waiting';onPending(true);
      if(state!=='waiting')return false;
      frame=requestFrame(()=>{
        frame=null;
        if(state!=='waiting')return;
        // A frame scheduled from this callback runs after an intervening paint.
        frame=requestFrame(()=>{
          frame=null;
          if(state!=='waiting')return;
          state='entered';onPending(false);
          if(state==='entered')onEnter();
        });
      });
      return true;
    },
    dispose() {
      state='disposed';
      if(frame!==null)cancelFrame(frame);
      frame=null;
    },
  };
}
