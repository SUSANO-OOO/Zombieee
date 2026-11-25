import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {restorePreMusashiManualSource} from './helpers/guard-spectacle-source.mjs';
import {drawV100BossAftermath,drawV100BossReleaseFields} from '../app/v100BossAftermath.js';
import {V100_BOSS_ATTACK_ART as ART} from '../app/v100BossAttackArt.js';
import {BOSS_ANOMALY_TUNING} from '../app/bossAnomalies.js';
const kinds=['mother','ooguchi','gairen','futago','mugarian-president-mutated','takuya-omega'];
function fixture(kind,elapsed=.22){
 const calls=[],stack=[],ctx={globalAlpha:.7,globalCompositeOperation:'screen',shadowBlur:3,tx:0,ty:0,sx:1,
  save(){stack.push([this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.tx,this.ty,this.sx]);},
  restore(){[this.globalAlpha,this.globalCompositeOperation,this.shadowBlur,this.tx,this.ty,this.sx]=stack.pop();},
  translate(x,y){this.tx+=x;this.ty+=y;},rotate(){},scale(x){this.sx*=x;},
  drawImage(...args){calls.push({args,alpha:this.globalAlpha,composite:this.globalCompositeOperation,tx:this.tx,ty:this.ty,sx:this.sx});}};
 const image=id=>({id,complete:true,naturalWidth:1536,naturalHeight:1024});
 const objects=Object.fromEntries(['v100-ground-impact','v100-dust','v100-smoke-a','v100-smoke-b',ART[kind].id].map(id=>[id,image(id)]));
 const owner={id:21,kind,hp:140,combatReady:true,x:500,y:260,stationAbility:{phase:'active',remainingSeconds:BOSS_ANOMALY_TUNING[kind].activeSeconds-elapsed,targetX:410}};
 const world={definition:{missionConfig:{v100StageNumber:11}},fighters:[owner],battlePresentation:{generation:3}};
 return {ctx,calls,stack,objects,owner,world};
}
const viewport={viewportWidth:844,viewportHeight:340,worldScale:.88};
function assertState(f){assert.equal(f.ctx.globalAlpha,.7);assert.equal(f.ctx.globalCompositeOperation,'screen');assert.equal(f.ctx.shadowBlur,3);assert.equal(f.ctx.tx,0);assert.equal(f.ctx.ty,0);assert.equal(f.ctx.sx,1);assert.equal(f.stack.length,0);}

test('six boss ground releases retain the square camera and bound their whole spread on phone screens',()=>{
 for(const kind of kinds)for(const [w,h,scale]of [[844,340,.88],[844,390,.88],[740,340,.77]]){
  const f=fixture(kind),before=structuredClone(f.world),v={viewportWidth:w,viewportHeight:h,worldScale:scale};
  assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,v),1);
  const p=f.calls.filter(c=>c.args[0]===f.objects[ART[kind].id]);assert.ok(p.length>=2,kind);
  assert.ok(p.every(c=>c.args[7]===c.args[8]&&c.args.slice(1).every(Number.isFinite)&&c.alpha>0&&c.alpha<=1&&c.composite==='source-over'));
  const left=Math.min(...p.map(c=>c.tx+(c.sx<0?-c.args[5]-c.args[7]:c.args[5])));
  const right=Math.max(...p.map(c=>c.tx+(c.sx<0?-c.args[5]:c.args[5]+c.args[7])));
  const top=Math.min(...p.map(c=>c.ty+c.args[6])),bottom=Math.max(...p.map(c=>c.ty+c.args[6]+c.args[8]));
  assert.ok((right-left)*(bottom-top)*scale*scale<=w*h*.18+1e-6,kind+' combined painted rectangle');
  assert.deepEqual(f.world,before);assertState(f);
 }
});

test('Omega lands the painted blade impact ahead in the locked attack direction',()=>{
 for(const direction of [-1,1]){
  const f=fixture('takuya-omega');
  f.owner.stationAbility.targetX=f.owner.x+direction*90;
  assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,viewport),1);
  assert.ok(f.calls.length>0);
  for(const call of f.calls){
   const lead=(call.tx-f.owner.x)*direction;
   assert.equal(call.args[0],f.objects[ART['takuya-omega'].id]);
   assert.equal(call.sx,direction);
   assert.ok(lead>call.args[7]/2&&lead<BOSS_ANOMALY_TUNING['takuya-omega'].controlRadius);
   assert.equal(call.ty,f.owner.y+4);
  }
  assertState(f);
 }
});

test('Omega keeps the generic ground burst centered when its directional sheet is missing',()=>{
 const f=fixture('takuya-omega');
 delete f.objects[ART['takuya-omega'].id];
 assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,viewport),1);
 assert.ok(f.calls.length>0);
 for(const call of f.calls){
  assert.equal(call.args[0],f.objects['v100-ground-impact']);
  assert.equal(call.tx,f.owner.x);
  assert.equal(call.sx,1);
 }
 assertState(f);
});

test('existing active clocks own one burst and neither windup nor recovery replays it',()=>{
 for(const kind of kinds){
  for(const patch of [{hp:0},{combatReady:false},{stationAbility:{phase:'windup',remainingSeconds:.2}},{stationAbility:{phase:'recovery',remainingSeconds:.2}}]){
   const f=fixture(kind);Object.assign(f.owner,patch);assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,viewport),0);assert.equal(f.calls.length,0);
  }
  for(const age of [-.1,.9]){const f=fixture(kind,age);assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,viewport),0);assert.equal(f.calls.length,0);}
 }
});

test('foreground dust does not paint the release again after the new background pass',()=>{
 for(const kind of kinds){const f=fixture(kind);assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,viewport),1);const count=f.calls.filter(c=>c.args[0]===f.objects[ART[kind].id]).length;
  drawV100BossAftermath(f.ctx,f.objects,{kind,x:f.owner.x,y:f.owner.y,elapsed:.22,duration:BOSS_ANOMALY_TUNING[kind].activeSeconds,phase:'active',seed:f.owner.id,world:f.world,ownerId:f.owner.id,includeRelease:false});
  assert.equal(f.calls.filter(c=>c.args[0]===f.objects[ART[kind].id]).length,count);assertState(f);
 }
});

test('an unavailable optional sheet retains the existing real ground material without changing a live choice',()=>{
 const f=fixture('mother');delete f.objects[ART.mother.id];assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,viewport),1);
 assert.ok(f.calls.every(c=>c.args[0]===f.objects['v100-ground-impact']));
 f.objects[ART.mother.id]={id:'late',complete:true,naturalWidth:1536,naturalHeight:1024};f.calls.length=0;
 assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,viewport),1);assert.ok(f.calls.every(c=>c.args[0]===f.objects['v100-ground-impact']));assertState(f);
});

test('invalid viewports and non-V1 worlds draw nothing',()=>{
 for(const v of [{...viewport,viewportWidth:0},{...viewport,viewportHeight:NaN},{...viewport,worldScale:-1}]){const f=fixture('mother');assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,v),0);assert.equal(f.calls.length,0);}
 const f=fixture('mother');delete f.world.definition.missionConfig.v100StageNumber;assert.equal(drawV100BossReleaseFields(f.ctx,f.objects,f.world,viewport),0);assert.equal(f.calls.length,0);
});

test('the release pass precedes all actors and health while only four declared renderer edits are allowed',()=>{
 const file='app/AshfallGame.tsx',source=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
 const rules=JSON.parse(fs.readFileSync('tests/fixtures/boss-release-paint-source-changes.json','utf8'))[file];
 const restore=value=>{value=restorePreMusashiManualSource(file,value);for(const [before,after]of [...rules].reverse()){assert.equal(value.split(after).length,2,'boss paint edit must occur exactly once');value=value.replace(after,before);}return value;};
 const baseline=execFileSync('git',['show','740071c0bb1137648f108495fa42d03a3a5e82f4:'+file],{maxBuffer:4*1024*1024}).toString('utf8').replaceAll('\r\n','\n');
 assert.equal(restore(source),baseline);
 const protectedEdit = /phone (?:battle|boss clear banner) edit must occur exactly once/;
 const rejectedMutation = (before, after) => {
  assert.equal(source.split(before).length, 2, "the negative check must change exactly one live call");
  assert.throws(() => restore(source.replace(before, after)), protectedEdit);
 };
 rejectedMutation(': v100CorporateControlLabel(g.definition)', ': false');
 for(const [,after]of JSON.parse(fs.readFileSync('tests/fixtures/phone-boss-clear-banner-source-changes.json','utf8'))[file].filter(([,after])=>after.includes('g.banner = v100ObjectiveDamageLabel(g,'))){
  rejectedMutation(after, after.replace('v100ObjectiveDamageLabel(g,','v100ObjectiveDamageLabel({},'));
 }
 rejectedMutation('v100CorporateControlCondition(hud)','v100CorporateControlCondition({barricadeHp:hud.barricadeHp,barricadeMaxHp:1000})');
 const paint='drawV100BossReleaseFields(ctx,stageObjects,g,';assert.equal(source.split(paint).length,2);assert.ok(source.indexOf(paint)<source.indexOf('  const renderables = ['));
 assert.throws(()=>restore(source+'\n'+rules.at(-1)[1]),/boss paint edit must occur exactly once/);
 assert.throws(()=>assert.equal(restore(source.replace('drawAreaEffect(ctx, effect, g.time, stageObjects','drawAreaEffect(ctx, effect, g.time + 0.1, stageObjects')),baseline));
});
