import assert from 'node:assert/strict';
import {V177_CONTINUOUS_BOSS_CORPSE_KINDS,v177BossRestAngle} from '../app/v177BossCorpsePresentation.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

const canonical=p=>p.replace(/^\/Zombieee(?=\/art\/)/,'');
const point=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
export function assertContinuousBossCorpse(form,dead,lastLive,corpse){
  if(!V177_CONTINUOUS_BOSS_CORPSE_KINDS.includes(form))return;
  assert.ok(dead.length>=3);assert.equal(lastLive.jointDrawSucceeded,true,'The controlled reaction must begin with its current painted boss rig');
  const atlas=V177_JOINT_ATLASES[form],path=lastLive.jointAtlasPath,at=lastLive.jointPaintedAt;
  assert.equal(canonical(path),canonical(atlas.path));assert.ok(Number.isFinite(at),'The last actual boss paint must own the timestamp');
  const source=dead[0].corpsePaintSourceRoot,outline=dead[0].corpsePaintOutline;
  assert.ok(source&&Object.values(source).every(v=>typeof v==='boolean'||Number.isFinite(v)));
  assert.ok(outline?.length>=3&&outline.every(p=>p.length===2&&p.every(Number.isFinite)));
  const direction=corpse.variant%2===0?-1:1,target=v177BossRestAngle({root:source,outline},form,direction);
  assert.ok(dead.some(r=>r.fallProgress>0&&r.fallProgress<1),'A real intermediate fall must be painted');
  for(const r of dead){
    assert.equal(r.corpsePaintContinuous,true,'A source-rest or legacy corpse cannot replace the actual living body');
    assert.equal(r.resolvedState,'original-boss-death');assert.equal(r.spritePath,path);assert.equal(r.corpsePaintedAt,at);assert.equal(r.corpsePaintMode,'rigid');
    assert.deepEqual(r.sourceRect,lastLive.sourceRect);assert.equal(r.frameFlipX,lastLive.frameFlipX);assert.equal(source.flipX,lastLive.frameFlipX);
    assert.equal(r.renderWidth,lastLive.renderWidth);assert.equal(r.renderHeight,lastLive.renderHeight);
    assert.deepEqual(r.corpsePaintSourceRoot,source);assert.deepEqual(r.corpsePaintOutline,outline,'The original painted silhouette cannot change at death');
    const m=r.corpsePaintMatrix;assert.ok(m?.length===6&&m.every(Number.isFinite));
    const p=r.fallProgress*r.fallProgress*(3-2*r.fallProgress),angle=source.angle+(target-source.angle)*p;
    assert.ok(Math.abs(r.rotationRadians-angle)<1e-8,'The observed fall must follow its actual source silhouette');
    const sx=source.scaleX*(source.flipX?-1:1),sy=source.scaleY,c=Math.cos(angle),s=Math.sin(angle);
    for(const [i,v]of [c*sx,s*sx,-s*sy,c*sy].entries())assert.ok(Math.abs(m[i]-v)<1e-8,'The actual matrix must preserve original body proportions and facing');
    const bottom=Math.max(...outline.map(p=>point(m,p)[1])),error=bottom-(r.y+5);
    assert.ok(Math.abs(error-r.corpseGroundOffsetY-r.corpseGroundSupportY)<1e-8);
    assert.ok(error<=1e-8,'The current original body cannot sink through the floor');
    if(r.fallProgress===1)assert.ok(Math.abs(error)<1e-8,'The settled original silhouette must reach its real floor');
  }
}
