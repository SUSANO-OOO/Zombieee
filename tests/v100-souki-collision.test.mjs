import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {beginSoukiBurst,advanceSoukiBurst,STATION_ENEMY_TUNING} from '../app/stationEnemyMechanics.js';
import {soukiBurstPhysicalX} from '../app/v100SoukiCollision.js';

const human=(changes={})=>({side:'human',hp:120,lane:1,x:355,bodyRadius:18,...changes});
const source=readFileSync('app/AshfallGame.tsx','utf8');

test('the real Souki consumer applies body contact to the original burst result',()=>{
 assert.match(source,/f\.x = soukiBurstPhysicalX\(f, burst\.runner\.x, g\.fighters, BASE_X \+ 28\);/u);
 assert.doesNotMatch(source,/candidate\.x >= burst\.runner\.x - 4/u);
});

test('a burst reaches a living body once and stays there without its former24px oscillation',()=>{
 let runner={kind:'sprinter',side:'zombie',hp:90,combatReady:true,lane:1,x:430,bodyRadius:11};
 let runtime=beginSoukiBurst({runner}).runtime;const target=human(),positions=[];let time=0,blocked=0;
 for(let i=0;i<150;i++){
  const before=runner.x,next=advanceSoukiBurst({runtime,runner,elapsedSeconds:1/60,crawlerRearBoundaryX:100});
  const x=soukiBurstPhysicalX(runner,next.runner.x,[target],100);
  assert.ok(x<=before+1e-9,'No backwards bounce after contacting a stationary body');
  assert.ok(x>=384-1e-9,'No overlap of the two actual body radii');
  if(x===384)blocked++;
  positions.push(x);runtime=next.runtime;runner={...next.runner,x};time+=1/60;
 }
 assert.ok(positions.some(x=>x<430)&&blocked>35,'The actual burst approaches and remains in contact');
 assert.equal(runtime.phase,'idle');assert.equal(runner.x,384);assert.equal(runner.hp,90);assert.equal(target.hp,120);
 assert.ok(time>=STATION_ENEMY_TUNING.souki.telegraphSeconds+STATION_ENEMY_TUNING.souki.burstSeconds+STATION_ENEMY_TUNING.souki.recoverySeconds);
});

test('contact uses the nearest living body and the anchored lane',()=>{
 const runner={x:430,lane:0,anchorLane:1,bodyRadius:11};
 assert.equal(soukiBurstPhysicalX(runner,340,[human(),human({x:380,bodyRadius:20})],100),411);
 assert.equal(soukiBurstPhysicalX(runner,340,[human({lane:0,anchorLane:1})],100),384);
 for(const target of [human({hp:0}),human({side:'zombie'}),human({lane:0}),human({x:500}),human({x:200})])
  assert.equal(soukiBurstPhysicalX(runner,340,[target],100),340);
});

test('removing or moving the blocker releases the original burst speed and preserves its clock',()=>{
 const runner={kind:'sprinter',side:'zombie',hp:90,combatReady:true,lane:1,x:384,bodyRadius:11};
 const runtime={phase:'burst',remainingSeconds:.5,lockedLane:1};
 const next=advanceSoukiBurst({runtime,runner,elapsedSeconds:1/60,crawlerRearBoundaryX:100});
 assert.equal(soukiBurstPhysicalX(runner,next.runner.x,[human()],100),384);
 assert.equal(soukiBurstPhysicalX(runner,next.runner.x,[],100),next.runner.x);
 assert.equal(soukiBurstPhysicalX(runner,next.runner.x,[human({x:300})],100),next.runner.x);
 assert.ok(Math.abs((384-next.runner.x)-STATION_ENEMY_TUNING.souki.burstSpeed/60)<1e-9);
 assert.ok(Math.abs(next.runtime.remainingSeconds-(.5-1/60))<1e-9);
 assert.equal(soukiBurstPhysicalX(runner,90,[],100),100);
 // A real moving body may push the runner right; retain their contact radii
 // instead of mistaking that distinct interaction for the stationary bounce.
 assert.equal(soukiBurstPhysicalX(runner,next.runner.x,[human({x:357})],100),386);
 assert.equal(soukiBurstPhysicalX(runner,next.runner.x,[human({x:353})],100),382);
 assert.equal(soukiBurstPhysicalX(runner,next.runner.x,[human({x:357,hp:0})],100),next.runner.x);
});
