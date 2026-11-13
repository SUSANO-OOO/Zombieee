import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {V177_JOINT_ATLASES, v177JointPose, drawV177JointPose} from '../app/v177JointPresentation.js';
import {sampleAnimationClip, createCombatAnimationRuntime} from '../app/combatPresentation.js';
import {spriteFrameFor} from '../app/spriteManifest.js';
import {v177ClearHeadHealthBarY} from '../app/v177HeadLabelPlacement.js';
import {layoutV100AllyHealthBars} from '../app/v100BattleStatusLayout.js';

const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const pointY = (m,x,y) => m[1]*x+m[3]*y+m[5];

function tracingContext(root) {
  const calls=[],stack=[];
  let matrix=[root.cos*root.scaleX,root.sin*root.scaleX,-root.sin*root.scaleY,root.cos*root.scaleY,300,root.y];
  return {calls,save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
    translate(x,y){matrix=multiply(matrix,[1,0,0,1,x,y]);},
    scale(x,y){matrix=multiply(matrix,[x,0,0,y,0,0]);},
    transform(...m){matrix=multiply(matrix,m);},
    drawImage(_image,...rects){calls.push({rects,matrix:[...matrix]});},
    beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){}};
}

const kinds=['brawler','scout','ranger','medic','brute','crazy-king','kumaverson','babayaga',
  'gunner','guardian','engineer','zakimiya','tky','mrs-chiha','miyamoto-musashi'];

test('head clearance follows the head rectangles actually painted by each humanoid rig',()=>{
  for(const kind of kinds)for(const facing of [-1,1])for(const phase of [0,.25,.5,.75]){
    const atlas=V177_JOINT_ATLASES[kind];
    const parts=(atlas.type==='rigid-parts'?atlas.parts:atlas.upperRig.parts).filter(p=>p.bone==='head');
    assert.ok(parts.length,kind);
    const runtime={...createCombatAnimationRuntime(),locomotionPhase:phase,locomotionSettle:1};
    const plan=v177JointPose(kind,sampleAnimationClip(kind,'move',phase),runtime,{grounded:true});
    const root={y:212-18,scaleX:facing,scaleY:1,sin:Math.sin(.12*facing),cos:Math.cos(.12*facing)};
    const ctx=tracingContext(root),receipt={headRoot:root};
    const width=96,height=atlas.height/atlas.width*width;
    const frame=spriteFrameFor(kind,'walk-a','right');
    assert.equal(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,
      -width*frame.anchorX,-height*frame.anchorY,width,height,{paintReceipt:receipt}),true,kind);
    const unchanged=tracingContext(root);
    assert.equal(drawV177JointPose(unchanged,{naturalWidth:atlas.decodedWidth},kind,plan,
      -width*frame.anchorX,-height*frame.anchorY,width,height),true,kind);
    assert.deepEqual(ctx.calls,unchanged.calls,`${kind}: recording the head must not change body/weapon paint`);
    const headCalls=ctx.calls.filter(c=>parts.some(p=>Object.values(p.source).every((v,i)=>v===c.rects[i])));
    assert.ok(headCalls.length,kind);
    const actualTop=Math.min(...headCalls.flatMap(c=>{
      const [x,y,w,h]=c.rects.slice(4);
      return [pointY(c.matrix,x,y),pointY(c.matrix,x+w,y),pointY(c.matrix,x,y+h),pointY(c.matrix,x+w,y+h)];
    }));
    assert.ok(Math.abs(receipt.headTopY-actualTop)<1e-7,`${kind}/${facing}/${phase}`);
    const barY=v177ClearHeadHealthBarY(132,receipt.headTopY,6);
    assert.ok(barY+6<=actualTop-4+1e-7,`${kind}: bar covers head`);
    assert.ok(barY<=132,`${kind}: unchanged anchor must not be lowered`);
  }
});

test('the production health-bar function uses the current painted head and preserves fallback actors',()=>{
  const source=readFileSync(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8').replaceAll('\r\n','\n');
  const start=source.indexOf('function fighterStatusAnchorWorldY(');
  const end=source.indexOf('\nfunction manualAbilityObstacleRects',start);
  assert.ok(start>0&&end>start);
  const code=source.slice(start,end).replace(/fighter: Pick<Fighter, [^>]+>/g,'fighter');
  const fighter={kind:'brawler',y:212},tops=new WeakMap();
  const context={fighterPaintedHeadTops:tops,v177ClearHeadHealthBarY,
    compactBattleViewport:()=>true,activeBattlefieldDepthScale:()=>1,
    bossDefinitionForEnemyKind:()=>null,isKuromeClone:()=>false,V100_KUROME_CLONE_TUNING:{bodyScale:1}};
  vm.createContext(context);new vm.Script(code+';this.place=fighterHealthBarWorldY;').runInContext(context);
  const legacy=context.place(fighter);
  tops.set(fighter,legacy+2);
  assert.equal(context.place(fighter),legacy-8,'moving head must clear the full bar and gap');
  assert.equal(context.fighterStatusAnchorWorldY(fighter),legacy,'interactive skill anchor must not follow the head bob');
  tops.set(fighter,legacy+30);
  assert.equal(context.place(fighter),legacy,'a lower head must not pull the bar down');
  tops.delete(fighter);
  assert.equal(context.place(fighter),legacy,'missing head receipt retains the previous layout');
  assert.ok(source.includes('fighterPaintedHeadTops.delete(f);'),'stale draws must be cleared');
  assert.ok(source.includes('paintReceipt:headPaintReceipt'),'production draw must collect the actual head');
  assert.ok(source.includes('screenY: transform.offsetY + (fighterStatusAnchorWorldY(fighter) - 10) * transform.scale'),
    'native skill buttons must keep the stable preexisting anchor');
});

test('overlay avoidance does not relocate an anchored bar back down over its owner head',()=>{
  const bounds={left:0,top:0,right:300,bottom:300};
  const obstacle={x:80,y:90,width:40,height:10};
  const row={x:100,y:100,width:28,height:6};
  const oldActor=layoutV100AllyHealthBars([row],{bounds,obstacles:[obstacle]})[0];
  assert.equal(oldActor.y,104,'actors without a painted-head anchor keep their old placement');
  const anchored=layoutV100AllyHealthBars([{...row,maxY:100}],{bounds,obstacles:[obstacle]})[0];
  assert.equal(anchored.y,80,'move above the obstacle instead of through the face');
  assert.equal(anchored.x,row.x,'the combat owner is not moved');
  const crowded=layoutV100AllyHealthBars([{...row,maxY:100},{...row,maxY:100}],{bounds});
  assert.ok(crowded.every(bar=>bar.y<=100));
  assert.ok(Math.abs(crowded[0].y-crowded[1].y)>=10);
});
