import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'js-yaml';
import {r9StoryPlan,assertR9PageGeometry} from '../scripts/v100-r9-story-plan.mjs';
import {V100_STORY_EVENTS} from '../app/v100StoryEvents.js';
import {ciChangeScope} from '../scripts/ci-change-scope.mjs';
import {assertBuildEventHead} from '../scripts/v177-native-allunit-build.mjs';
import {nativeCaseSelection} from '../scripts/v177-native-allunit-selection.mjs';

test('R9 page coverage retains every original node and explicitly accounts for credits and finalizers',()=>{
 const plan=r9StoryPlan('確認者');assert.equal(plan.events.length,62);
 const counted=[];
 for(const event of plan.events){
  assert.deepEqual(event.pages.flatMap(p=>p.sourceIndices),V100_STORY_EVENTS[event.eventId].nodes.map((_,i)=>i));
  assert.ok(event.pages.every(p=>!p.texts.some(t=>t.includes('{{PLAYER_NAME}}'))));
  counted.push(event.eventId);
 }
 assert.equal(plan.events.reduce((n,e)=>n+e.nodeCount,0)+plan.credits.nodes,plan.totalSourceNodes);
 assert.equal(plan.totalSourceNodes,1126);assert.equal(plan.credits.nodes,11);assert.equal(plan.finalizers.length,31);
 assert.deepEqual([...counted,...plan.finalizers,plan.credits.eventId].sort(),Object.keys(V100_STORY_EVENTS).sort());
});

test('real page validation rejects omitted text, wrong cursor, clipping, occluded Next and inactive or wrong audio',()=>{
 const page=r9StoryPlan().events.flatMap(e=>e.pages).find(p=>p.presentation.cueId),p=page.presentation;
 const state={nodeIndex:page.nodeIndex,text:page.texts.join(' '),viewport:{width:844,height:340},
  bounds:{x:10,y:240,right:800,bottom:320,width:790,height:80},button:{x:801,y:240,right:840,bottom:320,width:39,height:80},
  blocks:[{x:20,y:245,right:700,bottom:285}],actionReachable:true,overflow:0,
  audio:{desired:{sceneId:p.sceneId},sceneState:{sceneId:p.sceneId,...page.sceneAudio},active:{sceneId:p.sceneId},diagnostics:{contextState:'running'},
   receipts:[{action:'cue-started',eventId:p.eventId,nodeIndex:page.nodeIndex,cueId:p.cueId}]}};
 assert.equal(assertR9PageGeometry(state,page),true);
 for(const mutate of [s=>s.text='',s=>s.nodeIndex++,s=>s.bounds.right=900,s=>s.actionReachable=false,
  s=>s.blocks[0].bottom=335,s=>s.overflow=8,s=>s.audio.sceneState.sceneId='title',s=>s.audio.active=null,
  s=>s.audio.sceneState.bgmAssetId=null,s=>s.audio.sceneState.ambienceAssetIds=[],
  s=>s.audio.diagnostics.contextState='suspended',s=>s.audio.receipts=[]]){
  const bad=structuredClone(state);mutate(bad);assert.throws(()=>assertR9PageGeometry(bad,page));
 }
});

test('focused Draft verification selects R9 and the capture workflow without enabling unrelated gates',()=>{
 for(const file of ['scripts/v100-r9-full-story-browser.mjs','scripts/v100-dialogue-composition-browser.mjs']){
  const scope=ciChangeScope([file],{draft:true});assert.equal(scope.full,false);assert.equal(scope.r9,true);assert.equal(scope.allunit,false);
 }
 const capture=ciChangeScope(['.github/workflows/native-allunit-capture.yml'],{draft:true});
 assert.equal(capture.full,false);assert.equal(capture.allunit,true);assert.equal(capture.normal,false);
 const ready=ciChangeScope(['AGENTS.md'],{draft:false});assert.equal(ready.r9,true);assert.equal(ready.allunit,true);
 const workflow=load(readFileSync('.github/workflows/native-allunit-capture.yml','utf8'));
 assert.equal(workflow.on.workflow_dispatch.inputs.expected_head.required,true);
 assert.ok(workflow.jobs.build.if.includes('needs.scope.outputs.allunit'));
 assert.ok(workflow.jobs.build.if.includes('!github.event.pull_request.draft'));
 assert.equal(workflow.jobs.capture.strategy.matrix.shard,'${{ fromJSON(needs.build.outputs.shards) }}');
 for(const path of ['app/manualAbilityUi.js','app/v104CombatVfx.js'])assert.ok(workflow.on.pull_request.paths.includes(path),'Changed UI/VFX must reach capture source guards');
 const allCases=nativeCaseSelection({event:{pull_request:{draft:false},inputs:{capture_mode:'full'}}});
 assert.equal(allCases.shards.length,12);assert.equal(allCases.caseIds.length,432);
 assert.equal(workflow.jobs.capture.if,"${{ !cancelled() && needs.build.result == 'success' && needs.build.outputs.shards != '[]' }}",
  'manual capture must survive the skipped PR-only scope ancestor, reject failed build and avoid an empty matrix');
 const ci=load(readFileSync('.github/workflows/ci.yml','utf8'));
 const full=ci.jobs['r9-story'].strategy.matrix.include.filter(r=>r.phase==='full-story');
 assert.equal(new Set(full.map(r=>r.engine+':'+r.viewport)).size,6);
 assert.ok(ci.jobs['r9-story'].if.includes('needs.scope.outputs.r9'));
});

test('native build binds manual input or original PR head and rejects missing, movable or mismatched source',()=>{
 const sha='a'.repeat(40),env={GITHUB_EVENT_NAME:'workflow_dispatch',V177_EXPECTED_HEAD_SHA:sha};
 assert.doesNotThrow(()=>assertBuildEventHead(env,{inputs:{expected_head:sha}}));
 assert.doesNotThrow(()=>assertBuildEventHead({...env,GITHUB_EVENT_NAME:'pull_request'},{pull_request:{head:{sha}}}));
 for(const [e,event]of [[env,{}],[env,{inputs:{expected_head:'b'.repeat(40)}}],
  [{...env,V177_EXPECTED_HEAD_SHA:'main'},{inputs:{expected_head:'main'}}],
  [{...env,GITHUB_EVENT_NAME:'push'},{inputs:{expected_head:sha}}]])assert.throws(()=>assertBuildEventHead(e,event));
});
