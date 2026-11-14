// Five pieces of the existing approved wire-trap texture. The stakes hinge at
// the soil, the same coil takes up slack, and bitmap cable pieces join them.
// No replacement trap, diagram line, simulation timer, hit or sound is added.
const W=386,H=242,Y=65;
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const t=clamp(v);return t*t*(3-2*t);};
const rotate=(point,pivot,angle,dx=0,dy=0)=>{
 const c=Math.cos(angle),s=Math.sin(angle),x=point.x-pivot.x,y=point.y-pivot.y;
 return {x:pivot.x+x*c-y*s+dx,y:pivot.y+x*s+y*c+dy};
};
export function wireTrapRigPose(progress,phase='deploy',deploymentProgress=1){
 if(![progress,deploymentProgress].every(Number.isFinite)||!['deploy','spring'].includes(phase))return null;
 const p=clamp(progress),spring=phase==='spring';
 const left=spring?ease(p/.72):1-ease(p/.72),right=spring?ease(p/.72):1-ease((p-.08)/.78);
 const from=spring?wireTrapRigPose(deploymentProgress,'deploy'):null;
 const leftPose={pivot:{x:74,y:218},angle:spring?from.left.angle+(-.38-from.left.angle)*left:-left*.25,dx:spring?left*28:0,dy:0};
 const rightPose={pivot:{x:320,y:218},angle:spring?from.right.angle+(.43-from.right.angle)*right:right*.24,dx:spring?-right*32:0,dy:0};
 const leftEnd=rotate({x:156,y:Y},leftPose.pivot,leftPose.angle,leftPose.dx);
 const rightEnd=rotate({x:248,y:64},rightPose.pivot,rightPose.angle,rightPose.dx);
 const coil={pivot:{x:193,y:Y},angle:(leftPose.angle+rightPose.angle)*.25,
  dx:((leftEnd.x-156)+(rightEnd.x-248))*.5,
  dy:((leftEnd.y-Y)+(rightEnd.y-64))*.5+(spring?(1-ease(deploymentProgress))*24*(1-left)+left*36:(1-ease(p))*24)};
 return {progress:p,left:leftPose,right:rightPose,coil,leftEnd,rightEnd,
  coilLeft:rotate({x:166,y:Y},coil.pivot,coil.angle,coil.dx,coil.dy),
  coilRight:rotate({x:220,y:Y},coil.pivot,coil.angle,coil.dx,coil.dy)};
}
function piece(ctx,image,x,width,pose){
 ctx.save();ctx.translate(pose.pivot.x+pose.dx,pose.pivot.y+pose.dy);
 ctx.rotate(pose.angle);ctx.translate(-pose.pivot.x,-pose.pivot.y);
 ctx.drawImage(image,x,0,width,H,x,0,width,H);ctx.restore();
}
function cable(ctx,image,x,width,a,b,sourceY=Y,endY=Y){
 const dx=width,dy=endY-sourceY,length=Math.hypot(dx,dy),distance=Math.hypot(b.x-a.x,b.y-a.y);
 ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
 ctx.scale(distance/length,1);ctx.rotate(-Math.atan2(dy,dx));ctx.translate(-x,-sourceY);
 ctx.drawImage(image,x,0,width,H,x,0,width,H);ctx.restore();
}
function rig(ctx,image,pose){
 piece(ctx,image,0,156,pose.left);piece(ctx,image,248,W-248,pose.right);
 cable(ctx,image,156,10,pose.leftEnd,pose.coilLeft);
 cable(ctx,image,220,28,pose.coilRight,pose.rightEnd,Y,64);
 piece(ctx,image,166,54,pose.coil);
}
export function drawV100WireTrapMotion(ctx,objects,{x,y,width=82,progress=1,phase='deploy',alpha=1,deploymentProgress=1}={}){
 if(![x,y,width,progress,alpha,deploymentProgress].every(Number.isFinite)||width<=0||alpha<=0)return false;
 const intact=objects?.['v100-support-trap-intact'],sprung=objects?.['v100-support-trap-sprung'];
 if(!intact?.complete||intact.naturalWidth!==W||intact.naturalHeight!==H)return false;
 if(phase==='spring'&&(!sprung?.complete||sprung.naturalWidth!==404||sprung.naturalHeight!==193))return false;
 const pose=wireTrapRigPose(progress,phase,deploymentProgress);if(!pose)return false;
 ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;ctx.globalAlpha=Math.min(1,alpha);
 if(phase==='deploy'&&progress>=1){ctx.drawImage(intact,x-width/2,y-width*H/W,width,width*H/W);ctx.restore();return true;}
 const blend=phase==='spring'?ease((pose.progress-.52)/.48):0;
 if(blend<1){
  ctx.save();ctx.globalAlpha*=1-blend;ctx.translate(x-width/2,y-width*H/W);ctx.scale(width/W,width/W);
  rig(ctx,intact,pose);ctx.restore();
 }
 if(blend>0){ctx.globalAlpha*=blend;ctx.drawImage(sprung,x-width/2,y-width*193/404,width,width*193/404);}
 ctx.restore();return true;
}
