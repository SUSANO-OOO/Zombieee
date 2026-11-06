import assert from 'node:assert/strict';
import test from 'node:test';
import {decideAllyIntent} from '../app/allyAi.js';

const options={missionType:'timed-defense',defenseAnchor:325,forwardAnchor:555,defenseLeash:245};
const defender={id:'guard',kind:'frontline',x:555,y:180,lane:1,range:30,bodyRadius:12,ranged:false};
const enemy=(id,x,extra={})=>({id,x,y:180,lane:1,hp:100,bodyRadius:12,...extra});

test('defenders cannot chain pursuit into the enemy side or keep an unreachable previous lock',()=>{
  let unit={...defender},previousIntent={targetId:'far',moveDirection:1};
  for(const x of [760,890,1010]) {
    const intent=decideAllyIntent({...options,unit,previousIntent,enemies:[enemy('far',x)]});
    assert.equal(intent.targetId,null);assert.ok(intent.destinationX<=570);
    unit={...unit,x:intent.destinationX};previousIntent=intent;
  }
  const returning=decideAllyIntent({...options,unit:{...unit,x:736},enemies:[enemy('far',890)],previousIntent:{targetId:'far'}});
  assert.equal(returning.targetId,null);assert.equal(returning.destinationX,555);
  const local=decideAllyIntent({...options,unit:defender,enemies:[enemy('far',760),enemy('near',565)],previousIntent:{targetId:'far'}});
  assert.equal(local.targetId,'near');assert.equal(local.attackable,true);
});

test('a ranged defender uses real reach across the perimeter without pursuing beyond it',()=>{
  const unit={...defender,kind:'ranger',range:220,ranged:true};
  const target=enemy('distant',790);
  const intent=decideAllyIntent({...options,unit,enemies:[target]});
  assert.equal(intent.targetId,'distant');assert.ok(intent.desiredX<=570);
  const firing=decideAllyIntent({...options,unit:{...unit,x:570},enemies:[target],previousIntent:intent});
  assert.equal(firing.attackable,true);assert.equal(firing.moveDirection,0);
});

test('contact and crawler rescue remain valid, while assault pursuit is unchanged',()=>{
  const contact=decideAllyIntent({...options,unit:{...defender,x:736},enemies:[enemy('contact',752)]});
  assert.equal(contact.targetId,'contact');assert.equal(contact.attackable,true);
  const breach=decideAllyIntent({...options,unit:defender,enemies:[enemy('far',760),enemy('breach',180,{attackingCrawler:true})]});
  assert.equal(breach.targetId,'breach');assert.equal(breach.emergencyDefense,true);assert.equal(breach.moveDirection,-1);
  const assault=decideAllyIntent({...options,missionType:'assault',unit:defender,enemies:[enemy('far',760)]});
  assert.equal(assault.targetId,'far');assert.ok(assault.destinationX>570);
});

test('melee and ranged defenders finish the final step when the perimeter consumes range padding',()=>{
  for(const [range,ranged,x,targetX] of [[30,false,565,610],[220,true,564,803],[30,false,568.5,614],[220,true,568.5,804]]) {
    const unit={...defender,range,ranged,x};const target=enemy('edge',targetX);
    const approaching=decideAllyIntent({...options,unit,enemies:[target]});
    assert.equal(approaching.attackable,false);assert.equal(approaching.moveDirection,1);
    assert.equal(approaching.destinationX,570);
    assert.equal(approaching.precisionApproach,true);
    const reached=decideAllyIntent({...options,unit:{...unit,x:570},enemies:[target],previousIntent:approaching});
    assert.equal(reached.attackable,true);assert.equal(reached.moveDirection,0);
  }
});
