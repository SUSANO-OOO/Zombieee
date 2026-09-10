// Observe only real draws from the production canvas. No gameplay setters or
// manufactured contact events. Each accepted draw is tied to the expiring
// contact queued by the real incoming-damage consumer, not merely a nearby body.
export function installMetalCanvasAudit(){
 const draw=CanvasRenderingContext2D.prototype.drawImage;
 const audit={frames:[0,0,0,0,0,0],draws:[],captures:{},captureTimings:[],unmatched:0};window.__V100_METAL_QA__=audit;
 const capturedCanvases=new Map();
 // PNG encoding blocks Windows WebKit for about 50ms, longer than one metal
 // phase. Copy each real completed frame once; encode only after the battle.
 window.__V100_METAL_EXPORT_CAPTURES__=()=>{
  for(const [frame,copy]of capturedCanvases){
   const started=performance.now();audit.captures[frame]=copy.toDataURL('image/png');
   audit.captureTimings.push({frame,phase:'encode-after-battle',elapsedMs:performance.now()-started});
   copy.width=copy.height=0;
  }
  capturedCanvases.clear();
 };
 CanvasRenderingContext2D.prototype.drawImage=function(...args){
  const result=draw.apply(this,args),[image,sx,sy,sw,sh,dx,dy,dw,dh]=args;
  if(args.length!==9||image.naturalWidth!==1536||image.naturalHeight!==1024||sw!==512||sh!==512||dw!==54||dh!==54)return result;
  const path=new URL(image.currentSrc||image.src,window.location.href).pathname;
  if(!path.endsWith('/art/v100/combat-vfx/metal-impact-six-r1.webp'))return result;
  const frame=sx/512+sy/512*3;if(![1,2,4,5].includes(frame))return result;
  const snapshotStart=performance.now(),snapshot=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.(),snapshotMs=performance.now()-snapshotStart,matrix=this.getTransform(),canvas=this.canvas;
  const scale=Number(canvas.dataset.worldScale)*Number(canvas.dataset.dpr),offsetX=Number(canvas.dataset.worldOffsetX)*Number(canvas.dataset.dpr),offsetY=Number(canvas.dataset.worldOffsetY)*Number(canvas.dataset.dpr);
  const x=(matrix.e-offsetX)/scale,y=(matrix.f-offsetY)/scale;
  const matches=[];
  for(const contact of snapshot?.v100MetalContacts??[]){
   const age=snapshot.time-contact.startedAt,owner=snapshot.fighters.find(f=>f.id===contact.ownerId);
   if(![snapshot.time,contact.startedAt,contact.x,contact.y,contact.incomingDamage,contact.ownerHp,scale,x,y,dx,dy,matrix.a,matrix.b,matrix.c,matrix.d].every(Number.isFinite)||matrix.a*matrix.d-matrix.b*matrix.c===0||scale<=0||contact.incomingDamage<=0||contact.ownerHp<=0||contact.duration!==.16||age<0||age>=.16)continue;
   if([1,2,4,5][Math.min(3,Math.floor(age/.16*4))]!==frame)continue;
   if(!owner||owner.side!=='human'||!['kumaverson','guardian'].includes(owner.kind)||!(owner.hp>0)||owner.manualAbility?.phase!=='active'||owner.manualAbility.activationId!==contact.activationId)continue;
   if(contact.ownerKind!==owner.kind||contact.resolvedSocket!==true)continue;
   if(Math.abs(dx+180/512*dw)>.001||Math.abs(dy+256/512*dh)>.001||Math.hypot(x-contact.x,y-contact.y)>12)continue;
   matches.push({contact:{...contact,key:contact.ownerId+':'+contact.activationId+':'+contact.startedAt+':'+contact.x+':'+contact.y},owner:{id:owner.id,hp:owner.hp,x:owner.x,y:owner.y,phase:owner.manualAbility.phase,pose:owner.animationPresentation,render:owner.renderAudit}});
  }
  const matched=matches.length===1?matches[0]:null;
  audit.frames[frame]++;if(!matched)audit.unmatched++;
  if(audit.draws.length<2000)audit.draws.push({time:snapshot?.time,pageSeconds:performance.now()/1000,snapshotMs,frame,x,y,alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadowBlur:this.shadowBlur,anchor:[dx,dy],contact:matched?.contact??null,owner:matched?.owner??null});
  if(matched&&!audit.captures[frame]){audit.captures[frame]='pending';queueMicrotask(()=>{
   const started=performance.now(),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
   draw.call(copy.getContext('2d'),canvas,0,0);capturedCanvases.set(frame,copy);
   audit.captureTimings.push({frame,phase:'copy',elapsedMs:performance.now()-started});
  });}
  return result;
 };
}
