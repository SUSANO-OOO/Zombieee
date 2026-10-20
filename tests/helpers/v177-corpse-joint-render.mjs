import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { ENEMY_DEATH_CONFIG } from '../../app/combatLifecycle.js';
import { animationClipFor } from '../../app/combatPresentation.js';
import { spriteFrameFor } from '../../app/spriteManifest.js';
import { v100HumanWalkFrame } from '../../app/v100HumanWalk.js';
import { V177_JOINT_ATLASES, v177JointPose } from '../../app/v177JointPresentation.js';
import { V177_CORPSE_JOINT_DATA } from '../../app/v177CorpseJointData.js';
import { rememberV177CorpseJointPose, v177CorpseJointPresentation, drawV177CorpseJointPresentation } from '../../app/v177CorpseJointPresentation.js';
import { v177HumanCorpsePresentation } from '../../app/v177HumanCorpsePresentation.js';
import { beginV102GoreStep, noteV102GoreImpact, finishV102GoreStep, getV102GoreSnapshot } from '../../app/v102CombatGore.js';

const source=fs.readFileSync(new URL('../../app/AshfallGame.tsx',import.meta.url),'utf8');
const parsed=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),loops=[];
function visit(node){if(ts.isForOfStatement(node)&&node.expression.getText(parsed)==='g.corpses'
  &&node.getText(parsed).includes('recordCorpseRenderAudit'))loops.push(node);ts.forEachChild(node,visit);}
visit(parsed);assert.equal(loops.length,1);
const code=ts.transpileModule(`(g,ctx,sprites,sequence)=>{fighterRenderSequence=sequence-1;${loops[0].getText(parsed)}}`,
  {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],
  a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];

// Exercise the saved production corpse loop only. No component, game loop,
// browser or audio device is started; this is controlled unit-fixture state.
export function jointCorpseRenderFixture(form,{kind=form,flipX=true,fallDirection=-1,style=null}={}){
  const atlas=V177_JOINT_ATLASES[form],data=V177_CORPSE_JOINT_DATA[form];assert.ok(atlas&&data);
  const frame=v100HumanWalkFrame(spriteFrameFor(form,'walk-a','right'),flipX?'left':'right');
  const live={kind:form,plan:v177JointPose(form,{requestedState:'idle'},{locomotionPhase:.371,locomotionSettle:0}),
    frame,width:atlas.referenceFrame.width*.2,height:atlas.referenceFrame.height*.2,
    root:{x:500,y:285,angle:0,scaleX:1,scaleY:1,flipX}};
  const actor={id:7,kind,side:'zombie',hp:150,maxHp:150,x:500,y:285};
  const corpse={id:7,kind,renderKind:form,side:'zombie',x:500,y:285,state:'dying',deathClass:'boss',
    phaseElapsed:0,deathAge:0,life:2,variant:fallDirection===-1?0:1};
  const world={definition:{missionConfig:{v100StageNumber:3}},time:4,fighters:[actor],corpses:[]};
  rememberV177CorpseJointPose(world,7,form,live.plan,{frame,width:live.width,height:live.height,...live.root});
  const step=beginV102GoreStep(world,{heightFor:()=>live.height});
  noteV102GoreImpact(world,actor,{weapon:style==='cut'?'miyamoto-musashi':style==='blast'?'mrs-chiha':style==='crush'?'takuya':'ranger',originX:450,damage:150});
  actor.hp=0;assert.equal(finishV102GoreStep(world,step),1);world.fighters=[];world.corpses=[corpse];
  const histories=new Map(),image={complete:true,naturalWidth:data.atlasSize.width,naturalHeight:data.atlasSize.height};
  let receipt;
  const render=vm.runInNewContext(code,{ENEMY_DEATH_CONFIG,v177CorpseJointPresentation,drawV177CorpseJointPresentation,v177HumanCorpsePresentation,
    bossRenderKind:c=>c.renderKind,fighterRenderAuditEnabled:true,fighterRenderSequence:1,corpseRenderAuditHistory:histories,stageObjects:{},
    recordCorpseRenderAudit(id,value){receipt=value;const rows=histories.get(id)??[];rows.push(value);histories.set(id,rows);}});
  return {world,corpse,live,image,effects:()=>getV102GoreSnapshot(world),render(progress,sequence=10){
    corpse.phaseElapsed=progress===1?Math.max(.5,animationClipFor(form,'death').durationSeconds+.05,ENEMY_DEATH_CONFIG.timings.boss.dyingSeconds)
      :progress*ENEMY_DEATH_CONFIG.timings.boss.dyingSeconds;corpse.deathAge=corpse.phaseElapsed;
    world.time=4+corpse.phaseElapsed;let matrix=[1,0,0,1,0,0];const stack=[],draws=[];
    const target={globalAlpha:1,filter:'none',
      save(){stack.push({matrix:[...matrix],alpha:this.globalAlpha,filter:this.filter});},
      restore(){const previous=stack.pop();matrix=previous.matrix;this.globalAlpha=previous.alpha;this.filter=previous.filter;},
      translate(x,y){matrix=multiply(matrix,[1,0,0,1,x,y]);},rotate(a){matrix=multiply(matrix,[Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},
      scale(x,y){matrix=multiply(matrix,[x,0,0,y,0,0]);},transform(...m){matrix=multiply(matrix,m);},
      drawImage(img,...rects){assert.equal(img,image);draws.push({rects,matrix:[...matrix]});}};
    const ctx=new Proxy(target,{get(object,key){return key in object?object[key]:()=>{};}});
    render(world,ctx,{[atlas.key]:image},sequence);assert.ok(receipt?.corpseJointPose,'the actual source loop must use its remembered rig');
    assert.equal(draws.length,atlas.parts.length,'body and fragment draw every owned source part exactly once');
    assert.equal(stack.length,0);
    return {receipt:structuredClone(receipt),draws};
  }};
}
