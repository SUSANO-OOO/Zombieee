import {combatVariation,drawRasterPlume} from './v100RasterAtmosphere.js';

// One physical preparation beat per real activation. These are not contacts,
// projectiles, damage, or additional audio events.
const profiles=Object.freeze({
  kumaverson:{duration:.62,width:98,height:49,scatter:.68,feet:[[-12,0],[10,.065]],dust:64,lift:6},
  guardian:{duration:.68,width:108,height:44,scatter:.76,feet:[[15,0],[-12,.08]],dust:76,lift:4},
  'miyamoto-musashi':{duration:.46,width:60,height:25,scatter:.42,feet:[[10,0],[-8,.04]],dust:42,lift:3},
  'crazy-king':{duration:.64,width:83,height:38,scatter:.53,feet:[[-10,0],[12,.035]],dust:68,lift:8},
});
const effects=new WeakMap(),activations=new WeakMap();
const finite=(...values)=>values.every(Number.isFinite);
function active(world){
  const rows=(effects.get(world)??[]).filter(e=>world.time-e.startedAt<e.duration);
  effects.set(world,rows);return rows;
}

export function queueV100GuardActivation(world,owner){
  const p=profiles[owner?.kind],id=owner?.manualAbility?.activationId;
  if(!world?.definition?.missionConfig?.v100StageNumber||!p||owner.side!=='human'||!(owner.hp>0)
    ||!finite(world.time,owner.id,id,owner.x,owner.y)||id<=0
    ||!world.fighters?.includes(owner)||!['active','guard'].includes(owner.manualAbility.phase))return false;
  const seen=activations.get(world)??new WeakMap();
  if((seen.get(owner)??-1)>=id)return false;
  seen.set(owner,id);
  activations.set(world,seen);
  const rows=active(world).filter(e=>e.ownerId!==owner.id);
  rows.push({type:'guard-material',kind:owner.kind,ownerId:owner.id,activationId:id,
    startedAt:world.time,duration:p.duration,x:owner.x,y:owner.y,seed:owner.id*37+id*101});
  effects.set(world,rows.slice(-32));return true;
}
export function clearV100GuardActivations(world){effects.delete(world);activations.delete(world);}
export function getV100GuardActivationsSnapshot(world){
  return active(world).map(e=>({...e,elapsed:Math.max(0,world.time-e.startedAt)}));
}
function ready(objects,id){
  const source=objects?.[id];
  if(!source?.complete||!source.naturalWidth||!source.naturalHeight)throw Error(`Guard material must decode before battle: ${id}`);
  return source;
}

export function drawV100GuardActivations(ctx,objects,world){
  const rows=active(world);if(!rows.length)return;
  const ground=ready(objects,'v100-ground-impact'),dust=ready(objects,'v100-dust');
  const cw=ground.naturalWidth/3,ch=ground.naturalHeight/2;
  for(const e of rows){
    const p=profiles[e.kind],elapsed=world.time-e.startedAt;
    if(!p||elapsed<0)continue;
    // The debris stays at the real planted position, rather than sliding after
    // the unit as it resumes walking. Each boot leaves a different scuff.
    for(const [index,[dx,delay]] of p.feet.entries()){
      const age=elapsed-delay,life=p.duration-delay;
      if(age<0||age>=life)continue;
      const progress=age/life,frame=Math.min(5,Math.floor(progress*6));
      const fade=progress>.55?(1-progress)/.45:1;
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
      ctx.globalAlpha=p.scatter*fade;ctx.translate(e.x+dx,e.y+2);
      if(index===1)ctx.scale(-1,1);
      ctx.drawImage(ground,frame%3*cw,Math.floor(frame/3)*ch,cw,ch,
        -p.width/2,-p.height*360/512,p.width,p.height);
      ctx.restore();
      const variation=combatVariation(e.seed,index),drift=(index?-1:1)*(9+variation*9)*progress;
      drawRasterPlume(ctx,dust,{x:e.x+dx+drift,y:e.y+2-progress*p.lift,
        width:p.dust*(.45+progress*.8),height:(12+progress*9)*(index?.85:1),
        alpha:(.18+variation*.06)*(1-progress)**2,flip:index===1});
    }
  }
}
