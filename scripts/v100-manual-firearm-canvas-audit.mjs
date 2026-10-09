export function installManualFirearmCanvasAudit(){
 const original=CanvasRenderingContext2D.prototype.drawImage;
 const audit={records:[],captures:{},ignoredDraws:0};window.__V100_MANUAL_FIREARM_QA__=audit;
 CanvasRenderingContext2D.prototype.drawImage=function(...args){
  const result=original.apply(this,args),[image,sx,sy,sw,sh,dx,dy,dw,dh]=args;
  if(args.length!==9||image.naturalWidth!==1536||image.naturalHeight!==1024||sw!==512||sh!==512||dw!==dh)return result;
  const path=new URL(image.currentSrc||image.src,location.href).pathname;
  const type=path.endsWith('/combat-vfx/muzzle-six-frames-r1.webp')?'muzzle':path.endsWith('/combat-vfx/contact-six-frames-r1.webp')?'contact':null;
  if(!type)return result;
  const snapshot=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.();if(!snapshot)return result;
  const frame=sx/512+sy/512*3,matrix=this.getTransform(),c=this.canvas;
  const scale=Number(c.dataset.worldScale)*Number(c.dataset.dpr);
  const x=(matrix.e-Number(c.dataset.worldOffsetX)*Number(c.dataset.dpr))/scale,y=(matrix.f-Number(c.dataset.worldOffsetY)*Number(c.dataset.dpr))/scale;
  if(![frame,scale,x,y,dx,dy,matrix.a,matrix.b,matrix.c,matrix.d].every(Number.isFinite)||scale<=0||matrix.a*matrix.d-matrix.b*matrix.c===0)return result;
  const receipts=type==='muzzle'?snapshot.v100ManualMuzzles:snapshot.v100SkillContacts;
  const matches=(receipts??[]).filter(entry=>{
   const duration=type==='contact'?.2:entry.kind==='gunner'?.085:.1,age=snapshot.time-entry.startedAt;
   const expectedSize=type==='contact'?48:entry.kind==='babayaga'?52:48;
   const anchor=type==='contact'?[228,270]:[112,246];
   return ['ranger','babayaga','gunner'].includes(entry.kind)&&[snapshot.time,entry.startedAt,entry.x,entry.y].every(Number.isFinite)
    &&age>=0&&age<duration&&Math.min(5,Math.floor(age/duration*6))===frame&&dw===expectedSize
    &&Math.abs(dx+anchor[0]/512*dw)<.001&&Math.abs(dy+anchor[1]/512*dw)<.001&&Math.hypot(x-entry.x,y-entry.y)<.02
    &&(type==='muzzle'||entry.hpBefore>0&&entry.hpAfter<entry.hpBefore)
    &&snapshot.manualAbilityReceipts.some(actual=>actual.ownerId===entry.ownerId&&actual.activationId===entry.activationId&&actual.kind===entry.kind
     &&actual.eventType===(type==='muzzle'&&entry.kind==='gunner'?'muzzle':'impact')&&actual.at===entry.startedAt
     &&(entry.kind!=='gunner'||(actual.salvoIndex??0)===entry.shotIndex));
  });
  if(matches.length!==1){audit.ignoredDraws++;return result;}
  const entry=matches[0],key=entry.kind+'-'+type;
  if(audit.records.length<2000)audit.records.push({type,kind:entry.kind,frame,time:snapshot.time,pageSeconds:performance.now()/1000,x,y,alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadowBlur:this.shadowBlur,receipt:{...entry}});
  if(!audit.captures[key]){audit.captures[key]='pending';queueMicrotask(()=>{audit.captures[key]=c.toDataURL('image/png');});}
  return result;
 };
}
