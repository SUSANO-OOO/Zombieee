import {drawV100MedicMist} from './v100SupportAbilityVfx.js';

// A completed automatic treatment is a recipient-bound dressing, never a
// rifle projectile. Keep its existing lifetime and leave all healing to the
// simulation that emitted it.
export function drawV100NaoTreatmentShot(ctx,objects,shot,{elapsed,duration},world){
 if(shot?.side!=='human'||shot.effect!=='medic'||shot.weapon!==undefined
  ||shot.style!==undefined||shot.damageTargetId!==undefined)return false;
 if(!(shot.life>0)||!(duration>0)||elapsed<0||elapsed>=duration
  ||![shot.life,duration,elapsed,shot.sourceId,shot.targetId].every(Number.isFinite)
  ||!Array.isArray(world?.fighters))return true;
 const source=world.fighters.find(f=>f.id===shot.sourceId);
 if(source&&(source.side!=='human'||source.kind!=='medic'))return true;
 const target=world.fighters.find(f=>f.id===shot.targetId&&f.side==='human'&&f.hp>0);
 if(!target||![target.x,target.y].every(Number.isFinite))return true;
 const image=objects?.['quality-medic-gauze'];
 if(!image?.complete||image.naturalWidth!==1536||image.naturalHeight!==1024)return true;
 drawV100MedicMist(ctx,objects,{x:target.x,y:target.y-28,elapsed,duration,scale:.7});
 return true;
}
