import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import {MANUAL_ABILITY_REGISTRY} from '../app/manualAbilities.js';
import {queueV100GuardActivation,clearV100GuardActivations,getV100GuardActivationsSnapshot,drawV100GuardActivations} from '../app/v100GuardActivationVfx.js';
import {clearV100AdvancedAbilityEffects,getV100AdvancedAbilityEffectsSnapshot} from '../app/v100AdvancedAbilityVfx.js';

const kinds=['kumaverson','guardian','crazy-king','miyamoto-musashi'];
function fixture(kind='kumaverson',v1=true){
  const owner={id:7,kind,side:'human',hp:120,x:200,y:280,manualAbility:{activationId:4,phase:kind==='miyamoto-musashi'?'guard':'active'}};
  return {owner,world:{time:3,definition:{missionConfig:v1?{v100StageNumber:3}:{}},fighters:[owner]}};
}
const images={
  'v100-dust':{complete:true,naturalWidth:128,naturalHeight:128},
  'v100-ground-impact':{complete:true,naturalWidth:1536,naturalHeight:1024},
};
function context(){
  const rows=[],stack=[];
  const c={rows,globalAlpha:.7,globalCompositeOperation:'lighter',shadowBlur:4,
    save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]);},
    restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur]=stack.pop();},
    translate(x,y){rows.push(['translate',x,y]);},scale(x,y){rows.push(['scale',x,y]);},rotate(v){rows.push(['rotate',v]);},
    drawImage(...args){rows.push(['raster',args,this.globalAlpha]);},
    ellipse(){throw Error('Geometric activation substitute');},arc(){throw Error('Geometric activation substitute');},
  };return c;
}

test('real living V1 owner gets one finite material beat, including after expiry; reset permits a new run',()=>{
  const {owner,world}=fixture();const before=structuredClone(world);
  assert.equal(queueV100GuardActivation(world,owner),true);
  assert.equal(queueV100GuardActivation(world,owner),false);
  assert.deepEqual(world,before,'presentation does not change HP, ability, targets or resources');
  assert.equal(getV100AdvancedAbilityEffectsSnapshot(world).filter(e=>e.type==='guard-material').length,1);
  world.time+=1;
  assert.equal(getV100GuardActivationsSnapshot(world).length,0);
  assert.equal(queueV100GuardActivation(world,owner),false,'an expired activation cannot replay');
  clearV100AdvancedAbilityEffects(world);
  assert.equal(queueV100GuardActivation(world,owner),true,'the existing scene reset clears guard material receipts');
  clearV100GuardActivations(world);
  assert.deepEqual(getV100GuardActivationsSnapshot(world),[]);
});

test('a new actual actor instance reusing an ID is not blocked by the previous actor activation',()=>{
  const {owner,world}=fixture();assert.equal(queueV100GuardActivation(world,owner),true);
  const replacement=structuredClone(owner);world.fighters=[replacement];
  assert.equal(queueV100GuardActivation(world,owner),false);
  assert.equal(queueV100GuardActivation(world,replacement),true);
  assert.equal(getV100GuardActivationsSnapshot(world).length,1);
});

test('legacy, dead, stale, unsupported, inactive and non-finite owners cannot create new effects',()=>{
  for(const mutate of [
    ({world})=>{world.definition.missionConfig={};},({owner})=>{owner.hp=0;},
    ({world})=>{world.fighters=[];},({owner})=>{owner.kind='tky';},
    ({owner})=>{owner.manualAbility.phase='idle';},({owner})=>{owner.x=NaN;},
    ({owner})=>{owner.manualAbility.activationId=0;},({owner})=>{owner.side='zombie';},
  ]){const f=fixture();mutate(f);assert.equal(queueV100GuardActivation(f.world,f.owner),false);}
});

test('all four use distinct, deterministic grounded rasters, expire, and restore the incoming canvas state',()=>{
  const signatures=[];
  for(const kind of kinds){
    const {owner,world}=fixture(kind);assert.equal(queueV100GuardActivation(world,owner),true);world.time+=.13;
    const a=context(),b=context();drawV100GuardActivations(a,images,world);drawV100GuardActivations(b,images,world);
    assert.deepEqual(a.rows,b.rows);assert.ok(a.rows.some(r=>r[0]==='raster'));
    assert.deepEqual([a.globalAlpha,a.globalCompositeOperation,a.shadowBlur],[.7,'lighter',4]);
    assert.ok(a.rows.filter(r=>r[0]==='translate').every(r=>r[2]>260&&r[2]<=282),'material stays near planted soles');
    signatures.push(JSON.stringify(a.rows));
    world.time+=1;const expired=context();drawV100GuardActivations(expired,images,world);assert.deepEqual(expired.rows,[]);
  }
  assert.equal(new Set(signatures).size,4);
});

test('actual event-handler branches preserve legacy effects but replace only the four V1 activation emitters',async()=>{
  const source=await readFile(new URL('../app/AshfallGame.tsx',import.meta.url),'utf8');
  const ast=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const branches=[];
  const visit=node=>{if(ts.isIfStatement(node)){
    const condition=node.expression.getText(ast);
    if(condition.includes('event.type === "active-start"')&&condition.includes('"kumaverson"')
      ||condition==='event.type === "guard-start" && event.kind === "miyamoto-musashi"')branches.push(node.getText(ast));
  }ts.forEachChild(node,visit);};visit(ast);assert.equal(branches.length,2);
  const executable=ts.transpileModule(`for(const event of events){${branches.join('\n')}}`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  for(const v1 of [true,false])for(const kind of kinds){
    const {owner,world}=fixture(kind,v1);let particles=0;
    const event={type:kind==='miyamoto-musashi'?'guard-start':'active-start',kind,target:{targetIds:[]}};
    world.flashOverlay=0;
    vm.runInNewContext(executable,{events:[event],owner,g:world,MANUAL_ABILITY_REGISTRY,
      queueV100GuardActivation,addParticles:()=>{particles++;},playManualAbilityTimelineCue(){},Set,Math});
    assert.equal(particles,v1?0:1,`${kind} legacy/V1 particle routing`);
    assert.equal(getV100GuardActivationsSnapshot(world).length,v1?1:0,`${kind} actual handler emits material`);
    if(kind!=='miyamoto-musashi'){assert.equal(owner.cooldown,0);assert.equal(world.flashOverlay,.08);}
  }
});
