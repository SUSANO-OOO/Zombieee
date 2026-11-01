import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_DEFINITIONS,bossTelegraphSnapshot} from '../app/bossFoundation.js';
import {v100BossCounterplayHint,v100BossCounterplayTapObstacles,V100_BOSS_COUNTERPLAY_FALLBACK} from '../app/v100BossCounterplay.js';
import {MANUAL_ABILITY_REGISTRY,layoutManualAbilityIcons} from '../app/manualAbilities.js';
const ally=(kind='kumaverson',changes={})=>({id:1,kind,side:'human',hp:100,maxHp:100,combatReady:true,x:200,y:282,lane:1,
 bodyRadius:12,manualAbility:{kind,phase:'ready'},...changes});
const warning=kind=>({id:9,kind,side:'zombie',hp:100,maxHp:100,combatReady:true,x:400,y:282,
 abilityWindup:1.4,stationAbility:{phase:kind==='kurome'?'tracking':kind==='gate-eater'?'windup':'warning',
 remainingSeconds:1.4,targetId:1,targetX:200,targetY:282,targetIds:[]}});
const hint=(boss,fighters=[],readyAbilities=[])=>v100BossCounterplayHint({boss,telegraph:bossTelegraphSnapshot(boss),fighters,readyAbilities,
 beamOrigin:{x:boss.x,y:boss.y-64}});

test('the targeted ally retains a clear tap area without shrinking nearby native skill buttons',()=>{
 const boss=warning('kurome'),target=ally('scout',{x:350,y:292}),transform={scale:844/960,offsetX:0,offsetY:-67.38};
 const protectedRects=v100BossCounterplayTapObstacles({fighters:[boss,target],transform});
 assert.equal(protectedRects.length,1);
 const point={x:target.x*transform.scale,y:(target.y-30)*transform.scale+transform.offsetY};
 const icons=layoutManualAbilityIcons({fighters:[{id:target.id,kind:target.kind,screenX:point.x,screenY:point.y-50}],
  obstacles:[{ownerId:null,x:252,y:58,width:340,height:27},...protectedRects],displayWidth:844,displayHeight:340});
 assert.equal(icons.length,1);assert.equal(icons[0].hitSize,44);
 const icon=icons[0],dx=Math.max(icon.x-point.x,point.x-icon.x-icon.hitSize,0),
  dy=Math.max(icon.y-point.y,point.y-icon.y-icon.hitSize,0);
 assert.ok(Math.hypot(dx,dy)>=20,'body tap stays away from the full interactive button');
 for(const phase of ['firing','recovery','idle']){
  boss.stationAbility.phase=phase;
  assert.deepEqual(v100BossCounterplayTapObstacles({fighters:[boss,target],transform}),[]);
 }
 boss.stationAbility.phase='tracking';target.hp=0;
 assert.deepEqual(v100BossCounterplayTapObstacles({fighters:[boss,target],transform}),[]);
 assert.deepEqual(v100BossCounterplayTapObstacles({fighters:[boss,ally()]}),[]);
});

for(const definition of BOSS_DEFINITIONS){
 test(definition.id+': no usable skill never advertises unavailable defense, healing or artillery',()=>{
  const boss=warning(definition.enemyKind),owner=ally();
  const before=structuredClone({boss,owner});
  const actual=hint(boss,[owner],[{id:1,kind:owner.kind,available:false}]);
  if(boss.kind==='kurome')assert.match(actual,/タップして回避/u);
  else assert.equal(actual,V100_BOSS_COUNTERPLAY_FALLBACK);
  assert.deepEqual({boss,owner},before);
  assert.equal(Object.isFrozen(boss.stationAbility.targetIds),false,'read-only guidance must not freeze live runtime arrays');
 });
 if(definition.enemyKind!=='kurome')test(definition.id+': ready defense becomes advice only before its wind-up deadline',()=>{
  const boss=warning(definition.enemyKind),owner=ally(),ready=[{id:1,kind:owner.kind,available:true}];
  assert.match(hint(boss,[owner],ready),/クマバーソン/u);
  boss.abilityWindup=.2;boss.stationAbility.remainingSeconds=.2;
  assert.equal(hint(boss,[owner],ready),V100_BOSS_COUNTERPLAY_FALLBACK);
 });
}
test('dead, stunned, entering, contained, cooling-down, missing and wrong owners cannot retain a stale ready hint',()=>{
 const boss=warning('takuya'),row={id:1,kind:'kumaverson',available:true};
 for(const change of [{hp:0},{side:'zombie'},{combatReady:false},{stunned:1},{gateEntering:true},{contained:true},
  {manualAbility:{kind:'kumaverson',phase:'cooldown'}},{kind:'guardian'},{id:2}]){
  assert.equal(hint(boss,[ally('kumaverson',change)],[row]),V100_BOSS_COUNTERPLAY_FALLBACK);
 }
 assert.equal(hint(boss,[],[row]),V100_BOSS_COUNTERPLAY_FALLBACK);
});
test('healing needs an available native target; ready attack skills produce timing advice instead of imaginary protection',()=>{
 const boss=warning('gairen'),medic=ally('medic');
 assert.equal(hint(boss,[medic],[{id:1,kind:'medic',available:false}]),V100_BOSS_COUNTERPLAY_FALLBACK);
 assert.match(hint(boss,[medic],[{id:1,kind:'medic',available:true}]),/ナオ.*回復/u);
 const gunner=ally('babayaga');
 assert.match(hint(boss,[gunner],[{id:1,kind:'babayaga',available:true}]),/外殻が開いたら/u);
 assert.match(hint(warning('mother'),[ally('zakimiya')],[{id:1,kind:'zakimiya',available:true}]),/増える敵.*範囲技/u);
});
test('each defensive suggestion uses its own real wind-up and returns to neutral after activation',()=>{
 for(const kind of ['guardian','kumaverson','miyamoto-musashi']){
  const boss=warning('takuya'),owner=ally(kind),ready=[{id:1,kind,available:true}];
  boss.abilityWindup=MANUAL_ABILITY_REGISTRY[kind].windupSeconds+.09;
  assert.equal(hint(boss,[owner],ready),V100_BOSS_COUNTERPLAY_FALLBACK);
  boss.abilityWindup+=.02;assert.notEqual(hint(boss,[owner],ready),V100_BOSS_COUNTERPLAY_FALLBACK);
  owner.manualAbility.phase='windup';assert.equal(hint(boss,[owner],ready),V100_BOSS_COUNTERPLAY_FALLBACK);
 }
});
test('Kurome uses the actual targeted ally and beam: safe, dead and missing targets are not urged to evade again',()=>{
 const boss=warning('kurome'),owner=ally();
 assert.match(hint(boss,[owner]),/タップして回避/u);
 boss.stationAbility.phase='locked';
 assert.match(hint(boss,[owner]),/タップして回避/u);
 owner.y=212;owner.lane=0;
 assert.match(hint(boss,[owner]),/照準線を外れた/u);
 owner.hp=0;assert.doesNotMatch(hint(boss,[owner]),/タップ/u);
 assert.doesNotMatch(hint(boss,[]),/タップ/u);
 assert.equal(v100BossCounterplayHint(),null);
});

test('clear-ray advice uses the painted eye position and is withheld when that origin is unavailable',()=>{
 const boss=warning('kurome'),owner=ally('scout',{x:330,y:265});
 boss.stationAbility.phase='locked';
 const options={boss,telegraph:bossTelegraphSnapshot(boss),fighters:[owner]};
 assert.match(v100BossCounterplayHint({...options,beamOrigin:{x:400,y:150}}),/照準線を外れた/u);
 assert.match(v100BossCounterplayHint({...options,beamOrigin:{x:400,y:218}}),/タップして回避/u);
 assert.match(v100BossCounterplayHint(options),/タップして回避/u);
});
