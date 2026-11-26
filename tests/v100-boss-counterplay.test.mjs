import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_DEFINITIONS,bossTelegraphSnapshot} from '../app/bossFoundation.js';
import {v100BossWarningText,v100BossCounterplayTapObstacles} from '../app/v100BossCounterplay.js';
import {layoutManualAbilityIcons} from '../app/manualAbilities.js';
const ally=(kind='kumaverson',changes={})=>({id:1,kind,side:'human',hp:100,maxHp:100,combatReady:true,x:200,y:282,lane:1,
 bodyRadius:12,manualAbility:{kind,phase:'ready'},...changes});
const warning=kind=>({id:9,kind,side:'zombie',hp:100,maxHp:100,combatReady:true,x:400,y:282,
 abilityWindup:1.4,stationAbility:{phase:kind==='kurome'?'tracking':kind==='gate-eater'?'windup':'warning',
 remainingSeconds:1.4,targetId:1,targetX:200,targetY:282,targetIds:[]}});
const hint=(boss,fighters=[])=>v100BossWarningText({boss,telegraph:bossTelegraphSnapshot(boss),fighters,
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

for (const definition of BOSS_DEFINITIONS) {
 test(definition.id + ': warning names the attack with any party, without prescribing a skill', () => {
  const boss = warning(definition.enemyKind);
  for (const party of [[], [ally()], [ally('medic')], [ally('scout', {hp: 0})]]) {
   const before = structuredClone({boss, party});
   const name = bossTelegraphSnapshot(boss).displayName;
   const text = hint(boss, party);
   if (boss.kind === 'kurome' && party.some(member => member.hp > 0)) assert.ok(text.startsWith(name) && text.includes('タップして回避'));
   else assert.equal(text, name);
   assert.deepEqual({boss, party}, before);
   assert.equal(Object.isFrozen(boss.stationAbility.targetIds), false);
  }
 });
}

test('Kurome uses the actual targeted ally and beam: safe, dead and missing targets are not urged to evade again',()=>{
 const boss=warning('kurome'),owner=ally();
 assert.match(hint(boss,[owner]),/タップして回避/u);
 boss.stationAbility.phase='locked';
 assert.match(hint(boss,[owner]),/タップして回避/u);
 owner.y=212;owner.lane=0;
 assert.match(hint(boss,[owner]),/射線外/u);
 owner.hp=0;assert.doesNotMatch(hint(boss,[owner]),/タップ/u);
 assert.doesNotMatch(hint(boss,[]),/タップ/u);
 assert.equal(v100BossWarningText(),null);
});

test('clear-ray advice uses the painted eye position and is withheld when that origin is unavailable',()=>{
 const boss=warning('kurome'),owner=ally('scout',{x:330,y:265});
 boss.stationAbility.phase='locked';
 const options={boss,telegraph:bossTelegraphSnapshot(boss),fighters:[owner]};
 assert.match(v100BossWarningText({...options,beamOrigin:{x:400,y:150}}),/射線外/u);
 assert.match(v100BossWarningText({...options,beamOrigin:{x:400,y:218}}),/タップして回避/u);
 assert.match(v100BossWarningText(options),/タップして回避/u);
});
