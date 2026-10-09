// Read-only sampling of the actual production canvas. It does not create
// actors, change time, apply damage or manufacture impact events.
export function installContactCanvasAudit(){
 const original=CanvasRenderingContext2D.prototype.drawImage;
 const audit={draws:[],frames:{contact:[0,0,0,0,0,0],ground:[0,0,0,0,0,0]},captures:{},comboContacts:{},ambiguousDraws:0};window.__V100_CONTACT_QA__=audit;
 CanvasRenderingContext2D.prototype.drawImage=function(...args){
  const result=original.apply(this,args),[image,sx,sy,sw,sh,dx,dy,dw,dh]=args;
  if(args.length!==9||image.naturalWidth!==1536||image.naturalHeight!==1024||sw!==512||sh!==512||dw!==dh||this.globalCompositeOperation!=='source-over')return result;
  const kind=Math.abs(dx+228/512*dw)<.001&&Math.abs(dy+270/512*dw)<.001?'contact':Math.abs(dx+256/512*dw)<.001&&Math.abs(dy+360/512*dw)<.001?'ground':null;
  const assetPath=new URL(image.currentSrc||image.src,window.location.href).pathname;
  if(!kind||!assetPath.endsWith('/art/v100/combat-vfx/'+(kind==='contact'?'contact':'ground-impact')+'-six-frames-r1.webp'))return result;
  const frame=sx/512+sy/512*3;if(!kind||!Number.isInteger(frame)||frame<0||frame>=6)return result;
  audit.frames[kind][frame]++;const m=this.getTransform();
  if(kind==='contact'&&[52,70].includes(dw)){
   const s=window.__ASHFALL_BATTLE_QA__?.getSnapshot?.(),candidates=[];
   for(const e of s?.manualAbilityReceipts??[]){
    if(!Number.isFinite(s.time)||!Number.isFinite(e.at)||!Number.isInteger(e.salvoIndex)||e.salvoIndex<0||e.salvoIndex>4)continue;
    const age=s.time-e.at;
    // Native rendering may skip the first 33ms cell. Match whichever authored
    // cell was really drawn against its exact combat-clock phase instead.
    if(e.kind!=='brawler'||e.eventType!=='impact'||age<0||age>=.2||Math.floor(age/.2*6)!==frame||((e.salvoIndex===4)!==(dw===70)))continue;
    const owner=s.fighters.find(f=>f.id===e.ownerId),targetId=owner?.manualAbility?.target?.targetId;
    const target=s.fighters.find(f=>String(f.id)===String(targetId));if(!owner?.manualAbility?.sequentialBrawler||owner.manualAbility.activationId!==e.activationId||!target)continue;
    // This observer intentionally proves surviving-target contacts only. A
    // dead actor removed before drawing cannot supply a trustworthy snapshot.
    const direction=Number(owner.manualAbility.target.direction)||1;
    if(owner.side!=='human'||!(owner.hp>0)||owner.combatReady!==true||owner.contained||owner.stunned>0||target.side!=='zombie'||!(target.hp>0)||target.combatReady!==true||target.contained||target.targetable===false)continue;
    const reach=Math.hypot(target.x-owner.x,(target.y-owner.y)*1.25);
    if(!Number.isFinite(reach)||!Number.isFinite(target.bodyRadius)||(target.x-owner.x)*direction<0||reach>target.bodyRadius+34)continue;
    const canvas=this.canvas,scale=Number(canvas.dataset.worldScale)*Number(canvas.dataset.dpr),offsetX=Number(canvas.dataset.worldOffsetX)*Number(canvas.dataset.dpr),offsetY=Number(canvas.dataset.worldOffsetY)*Number(canvas.dataset.dpr);
    const expectedX=target.x-Math.sign(target.x-owner.x)*target.bodyRadius*.45,expectedY=target.y-30+(e.salvoIndex%2?3:-3);
    if(![scale,offsetX,offsetY,expectedX,expectedY,m.e,m.f].every(Number.isFinite)||scale<=0)continue;
    // Tolerance covers the bounded camera shake, not a second actor's remote effect.
    if(Math.hypot(m.e-(offsetX+expectedX*scale),m.f-(offsetY+expectedY*scale))>12*scale)continue;
    candidates.push({at:performance.now(),battleTime:s.time,impactTime:e.at,frame,ownerId:e.ownerId,activationId:e.activationId,index:e.salvoIndex,targetId:target.id,targetHp:target.hp,size:dw,point:[m.e,m.f],reach,ownerPosition:[owner.x,owner.y],targetPosition:[target.x,target.y]});
   }
   // One rendered burst can never satisfy two simultaneous activations.
   if(candidates.length===1){const hit=candidates[0],key=hit.ownerId+':'+hit.activationId+':'+hit.index;audit.comboContacts[key]??=hit;}
   else if(candidates.length>1)audit.ambiguousDraws++;
  }
  if(audit.draws.length<3000)audit.draws.push({at:performance.now(),kind,frame,size:dw,point:[m.e,m.f],alpha:this.globalAlpha,composite:this.globalCompositeOperation,shadowBlur:this.shadowBlur});
  if(frame===2&&!audit.captures[kind]){audit.captures[kind]='pending';const canvas=this.canvas;queueMicrotask(()=>{audit.captures[kind]=canvas.toDataURL('image/png')});}
  return result;
 };
}
