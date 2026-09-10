// Read-only observation of the real battle canvas and the expiring applied
// damage receipts. No actor, clock, damage or contact setter is installed.
export function installClawCanvasAudit(){
 const draw=CanvasRenderingContext2D.prototype.drawImage;
 const audit={frames:[0,0,0,0,0,0],draws:[],captures:{},unmatched:0};window.__V100_CLAW_QA__=audit;
 CanvasRenderingContext2D.prototype.drawImage=function(...args){
  const result=draw.apply(this,args),[image,sx,sy,sw,sh,dx,dy,dw,dh]=args;
  if(args.length!==9||image.naturalWidth!==1536||image.naturalHeight!==1024||sw!==512||sh!==512||dw!==54||dh!==54)return result;
  if(!new URL(image.currentSrc||image.src,location.href).pathname.endsWith('/art/v100/combat-vfx/claw-contact-six-r1.webp'))return result;
  const frame=sx/512+sy/512*3;if(!Number.isInteger(frame)||frame<0||frame>5)return result;
  const snapshot=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.(),matrix=this.getTransform(),canvas=this.canvas;
  const scale=Number(canvas.dataset.worldScale)*Number(canvas.dataset.dpr);
  const x=(matrix.e-Number(canvas.dataset.worldOffsetX)*Number(canvas.dataset.dpr))/scale;
  const y=(matrix.f-Number(canvas.dataset.worldOffsetY)*Number(canvas.dataset.dpr))/scale;
  const matches=(snapshot?.v100ClawContacts??[]).filter(contact=>{
   const age=snapshot.time-contact.startedAt;
   return [snapshot.time,contact.startedAt,contact.x,contact.y,contact.hpBefore,contact.hpAfter,scale,x,y,dx,dy,matrix.a,matrix.b,matrix.c,matrix.d].every(Number.isFinite)
    &&matrix.a*matrix.d-matrix.b*matrix.c!==0&&scale>0&&contact.hpBefore>0&&contact.hpAfter<contact.hpBefore&&contact.duration===.2
    &&['walker','runner','grappler','sprinter'].includes(contact.sourceKind)
    &&age>=0&&age<.2&&Math.min(5,Math.floor(age/.2*6))===frame
    &&Math.abs(dx+27)<.001&&Math.abs(dy+27)<.001&&Math.hypot(x-contact.x,y-contact.y)<.01;
  });
  const contact=matches.length===1?matches[0]:null;
  audit.frames[frame]++;if(!contact)audit.unmatched++;
  if(audit.draws.length<1200)audit.draws.push({time:snapshot?.time,pageSeconds:performance.now()/1000,frame,x,y,alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadowBlur:this.shadowBlur,
   contact:contact?{...contact,key:contact.sourceId+':'+contact.attackSequence+':'+contact.targetId+':'+contact.startedAt}:null});
  if(contact&&!audit.captures[frame]){audit.captures[frame]='pending';queueMicrotask(()=>{audit.captures[frame]=canvas.toDataURL('image/png');});}
  return result;
 };
}
