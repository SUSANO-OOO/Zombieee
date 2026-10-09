// Observe the real Canvas renderer. No game state, clock, actors or inputs
// are changed. The saved frame is taken after the normal render completes.
export function installMuzzleCanvasAudit(){
 const original=CanvasRenderingContext2D.prototype.drawImage;
 const audit={draws:[],frameCounts:[0,0,0,0,0,0],image:null,pending:false};
 window.__V100_MUZZLE_QA__=audit;
 CanvasRenderingContext2D.prototype.drawImage=function(...args){
  const result=original.apply(this,args);
  const [image,sx,sy,sw,sh,dx,dy,dw,dh]=args;
  if(args.length===9&&this.globalCompositeOperation==='lighter'&&image.naturalWidth===1536&&image.naturalHeight===1024&&sw===512&&sh===512&&dw===dh&&[42,44,48,52,90].includes(dw)){
   const frame=sx/512+sy/512*3;
   if(Number.isInteger(frame)&&frame>=0&&frame<6){
    audit.frameCounts[frame]++;
    const m=this.getTransform();
    if(audit.draws.length<120)audit.draws.push({at:performance.now(),frame,size:dw,composite:this.globalCompositeOperation,alpha:this.globalAlpha,shadowBlur:this.shadowBlur,rect:[dx,dy,dw,dh],transform:[m.a,m.b,m.c,m.d,m.e,m.f]});
    if(frame===2&&!audit.image&&!audit.pending){
     audit.pending=true;const canvas=this.canvas;
     queueMicrotask(()=>{audit.image=canvas.toDataURL('image/png');audit.pending=false});
    }
   }
  }
  return result;
 };
}
