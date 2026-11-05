import test from 'node:test';
import assert from 'node:assert/strict';
import {r9StoryPlan} from '../scripts/v100-r9-story-plan.mjs';
import {expectedStoryPortraits,assertStoryPortraitSources} from '../scripts/v100-story-portrait-contract.mjs';

const plan=r9StoryPlan();
const event=plan.events.find(e=>e.eventId==='v100:event:prologue');
const page=event.pages.find(p=>p.nodeIndex===2);
const expected=expectedStoryPortraits(event.eventId,page);
const observation=()=>({portraitCount:2,portraits:expected.map(p=>({source:'http://127.0.0.1:59152'+p.source}))});
test('opening exchange keeps both named speakers and the cooking prop',()=>{
  assert.deepEqual(expected.map(p=>p.owner),['unit-kumaverson','unit-paisen']);
  assert.match(expected[0].source,/kumaverson-cooking-warm-stage/);
  assertStoryPortraitSources(observation(),expected);
});
test('zero, missing, extra, wrong-person and wrong-expression images fail',()=>{
  assert.throws(()=>assertStoryPortraitSources({portraitCount:0,portraits:[]},expected));
  for(const mutate of [p=>p.portraits.pop(),p=>p.portraits.push(p.portraits[0]),
    p=>p.portraits[0].source='/art/v100/portraits/tky-warm-quality-r1.webp',
    p=>p.portraits[1].source=p.portraits[1].source.replace('warm','grief')]){
    const paint=observation();mutate(paint);assert.throws(()=>assertStoryPortraitSources(paint,expected));
  }
});
test('cinematic inserts intentionally omit standing portraits',()=>{
  const cut=event.pages.find(p=>p.presentation.cinematic);
  assert.ok(cut);assert.deepEqual(expectedStoryPortraits(event.eventId,cut),[]);
  assertStoryPortraitSources({portraitCount:0,portraits:[]},[]);
  assert.throws(()=>assertStoryPortraitSources(observation(),[]));
});
