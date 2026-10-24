import assert from 'node:assert/strict';
import { V177_CONTINUOUS_HUMAN_CORPSE_KINDS } from '../app/v177HumanCorpsePresentation.js';

const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
export function assertContinuousHumanCorpse(form,dead,lastLive,corpse){
  if(!V177_CONTINUOUS_HUMAN_CORPSE_KINDS.includes(form))return;
  assert.ok(dead.length>=3);
  const path=lastLive.jointDrawSucceeded?lastLive.jointAtlasPath:lastLive.spritePath;
  const mode=lastLive.jointDrawSucceeded?(form==='ranger'?'weighted':'rigid'):'sprite';
  const at=lastLive.bodyPaintedAt,source=lastLive.bodyPaintRoot;
  assert.ok(Number.isFinite(at)&&source&&Object.values(source).every(v=>typeof v==='boolean'||Number.isFinite(v)),'Actual last body paint is required');
  assert.ok(dead.some(r=>r.fallProgress>0&&r.fallProgress<1&&Math.abs(r.rotationRadians-source.angle)>.01),'Continuous intermediate fall is required');
  for(const r of dead){
    assert.equal(r.corpsePaintContinuous,true,'A legacy prone fallback cannot complete this new owner');
    assert.equal(r.resolvedState,'continuous-human-death');assert.equal(r.spritePath,path);
    assert.equal(r.corpsePaintedAt,at);assert.equal(r.corpsePaintMode,mode);
    assert.deepEqual(r.sourceRect,lastLive.sourceRect);assert.equal(r.frameFlipX,lastLive.frameFlipX);
    assert.deepEqual(r.corpsePaintSourceRoot,source);
    const m=r.corpsePaintMatrix,h=r.corpsePaintOutline;
    assert.ok(m?.length===6&&m.every(Number.isFinite));
    assert.ok(h?.length>=3&&h.every(p=>p.length===2&&p.every(Number.isFinite)));
    assert.deepEqual(h,dead[0].corpsePaintOutline,'The death must retain its original painted silhouette');
    const bottom=Math.max(...h.map(p=>point(m,p)[1])),error=bottom-(r.y+5);
    assert.ok(Math.abs(error-r.corpseGroundOffsetY-r.corpseGroundSupportY)<1e-8);
    // The last live body can sit above its nominal floor. Falling retains that
    // initial gap; once settled the very same silhouette must touch the floor.
    if(r.fallProgress===1){
      assert.ok(Math.abs(error)<1e-8,'The completed source outline must reach the actual floor');
      assert.ok(Math.abs(r.rotationRadians-(corpse.variant%2===0?-1:1)*Math.PI/2)<1e-8);
    }
    if(mode==='weighted'){
      const lower=r.corpseWeightedLower;
      assert.equal(lower?.mode,'continuous-weighted-mesh');assert.equal(lower.meshVertices,130);assert.equal(lower.meshTriangles,192);
      assert.equal(lower.parts,5);assert.equal(lower.degenerate,0);assert.equal(lower.duplicateWithinPart,0);
    }
  }
}
