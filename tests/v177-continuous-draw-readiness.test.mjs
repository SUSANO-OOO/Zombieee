import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {hasV177ContinuousDraw} from '../scripts/v177-continuous-draw-readiness.mjs';

function fixture() {
  const proof = {fighterId:105,kind:'ooguchi',renderKind:'ooguchi',v100TwinPart:null};
  const snapshot = {running:true,paused:false};
  const audit = {fighter:{id:105,kind:'ooguchi',renderKind:'ooguchi',hp:3400,x:620},renderHistory:[]};
  const browser = {window:{__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot,getEnemyFacingRuntimeAudit:id=>{
    assert.equal(id,proof.fighterId);return audit;
  }}},document:{visibilityState:'visible'},location:{pathname:'/v100'},proof};
  const ready = () => vm.runInNewContext(`(${hasV177ContinuousDraw.toString()})(proof)`,browser);
  const paint = () => audit.renderHistory.push({renderKind:'ooguchi',assetReady:true,renderWidth:362.88,renderHeight:338.688,renderSequence:4627});
  return {proof,snapshot,audit,browser,ready,paint};
}

test('a new actor stays pending until its own first native draw, even after the observation timer fires',()=>{
  const f=fixture();
  assert.equal(f.ready(),false);
  f.audit.fighter.x=614.1666666666669;
  assert.equal(f.ready(),false,'simulation movement alone is not drawing evidence');
  f.paint();
  assert.equal(f.ready(),true);
});

test('missing art, another actor/body, a hidden page and paused battle cannot start continuous capture',()=>{
  for(const mutate of [
    f=>{f.audit.fighter.id=104;},f=>{f.audit.fighter.kind='tank';},
    f=>{f.audit.fighter.renderKind='tank';},f=>{f.audit.fighter.v100TwinPart='a';},
    f=>{f.audit.fighter.hp=0;},f=>{f.audit.fighter.x=NaN;},
    f=>{f.audit.renderHistory[0].renderKind='tank';},
    f=>{f.audit.renderHistory[0].assetReady=false;},
    f=>{f.audit.renderHistory[0].renderWidth=0;},
    f=>{f.audit.renderHistory[0].renderSequence=0;},
    f=>{f.snapshot.running=false;},f=>{f.snapshot.paused=true;},
    f=>{f.browser.document.visibilityState='hidden';},f=>{f.browser.location.pathname='/';},
    f=>{delete f.browser.window.__ASHFALL_BATTLE_QA__;},
  ]){const f=fixture();f.paint();mutate(f);assert.equal(f.ready(),false);}
});

test('readiness keeps the spawned twin part identity when evaluated without module closures',()=>{
  const f=fixture();f.proof.kind='futago';f.proof.renderKind='futago-separated-b';f.proof.v100TwinPart='b';
  Object.assign(f.audit.fighter,{kind:'futago',renderKind:'futago-separated-b',v100TwinPart:'b'});
  f.paint();f.audit.renderHistory[0].renderKind='futago-separated-b';
  assert.equal(f.ready(),true);
  f.audit.fighter.v100TwinPart='a';assert.equal(f.ready(),false);
});
