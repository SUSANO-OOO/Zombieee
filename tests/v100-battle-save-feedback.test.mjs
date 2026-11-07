import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {createDefaultV100Save,applyV100SaveMutation} from '../app/v100Save.js';
import {V100_STAGE_IDS} from '../app/v100Registry.js';
import {createV100StoryFlowState,v100StoryFlowCheckpoint,finishV100Battle,leaveV100Battle} from '../app/v100StoryFlow.js';
import {createV100BattleResult,recordV100PendingResult} from '../app/v100Transactions.js';

// Execute the real component callbacks with only React setters and durable I/O
// replaced. The browser regression separately exercises native IndexedDB/quota.
const source=fs.readFileSync(new URL('../app/V100Campaign.tsx',import.meta.url),'utf8');
function between(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);}
const callbacks=[
 between('  const runStorage = useCallback(', '  const loadSave = useCallback('),
 between('  const updateFlow = useCallback(', '  const applySaveTransaction = useCallback('),
 between('  const handleProductionBattleResult = useCallback(', '  const handleProductionSettingsChange = useCallback('),
].join('\n');
const compiled=ts.transpileModule(callbacks,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function harness(mode='success',{busy=false,unsaved=null}={}){
 const save={...createDefaultV100Save({playerName:'保存確認'}),campaignStarted:true};
 const flow=createV100StoryFlowState({...save,flowState:{phase:'battle',stageId:V100_STAGE_IDS[0],stageNumber:1,destination:'battle'}});
 const state={notice:'previous notice',notices:[],writes:0,published:null,flow,unsaved};
 const setters={setNotice:value=>{state.notice=value;state.notices.push(value);},setFlow:value=>{state.flow=value;},
  setUnsavedBattleResult:value=>{state.unsaved=value;},setSaveBusy:()=>{},setFormationRequestedUnitId:()=>{},
  setBattleRunId:()=>{},setStoryIndex:()=>{},setSurface:()=>{},setSelectedStageId:()=>{}};
 const bindings={useCallback:fn=>fn,save,flow,hydrated:true,saveOwnerId:'test-owner',battleRunId:'test-battle',unsavedBattleResult:unsaved,
  saveBusyRef:{current:busy},document:{documentElement:{dataset:{}}},publishSave:value=>{state.published=value;},
  storageFailureMessage:reason=>`storage:${reason}`,formatReason:reason=>`reason:${reason}`,
  persistV100BrowserSave:async next=>{state.writes++;if(mode==='throw')throw new Error('storage denied');if(mode==='primary-failure')return{ok:false,save:null,reason:'blocked'};return{ok:true,save:next,mirrorSaved:mode!=='mirror-failure'};},
  applyV100SaveMutation,v100StoryFlowCheckpoint,createV100BattleResult,finishV100Battle,recordV100PendingResult,leaveV100Battle,
  v100BattleReportFor:()=>null,V100_STAGE_IDS,...setters};
 const create=new Function(...Object.keys(bindings),`${compiled}\nreturn {updateFlow,handleProductionBattleResult,handleProductionBattleAction};`);
 return {...create(...Object.values(bindings)),state,save,flow};
}
const rawResult={resultId:'test-battle',stageId:V100_STAGE_IDS[0],won:false,baseHp:0,baseMaxHp:680,time:45,unitsLost:0,bossDefeated:false};
for(const action of ['result','loadout']){
 const invoke=h=>action==='result'?h.handleProductionBattleResult(rawResult):h.handleProductionBattleAction('loadout');
 test(`${action}: mirror-only failure retains export warning after durable commit`,async()=>{
  const h=harness('mirror-failure');await invoke(h);
  assert.equal(h.state.writes,1);assert(h.state.published);assert.match(h.state.notice,/予備コピーを最新にできなかった/u);
  assert.equal(h.state.notices[0],'');assert.equal(h.state.notices.length,2);
  assert.equal(h.state.flow.phase,action==='result'?'result':'formation');
  for(const key of ['caps','unitLevels','equipment','formationSlots','receipts'])assert.deepEqual(h.state.published[key],h.save[key]);
 });
 test(`${action}: successful primary and mirror commit clears the previous notice`,async()=>{
  const h=harness();await invoke(h);assert.equal(h.state.notice,'');assert.deepEqual(h.state.notices,['']);assert.equal(h.state.writes,1);
 });
 test(`${action}: primary failure keeps failure feedback and the battle checkpoint`,async()=>{
  const h=harness('primary-failure');await invoke(h);assert.equal(h.state.notice,'storage:blocked');assert.deepEqual(h.state.notices,['storage:blocked']);assert.equal(h.state.published,null);assert.equal(h.state.flow.phase,'battle');
  if(action==='result')assert.deepEqual(h.state.unsaved,rawResult);
 });
 test(`${action}: an exception cannot be followed by a success clear`,async()=>{
  const h=harness('throw');await invoke(h);assert.match(h.state.notice,/保存を確認できなかった/u);assert.equal(h.state.notices.length,1);assert.equal(h.state.published,null);
 });
 test(`${action}: an already busy save leaves existing feedback untouched`,async()=>{
  const h=harness('success',{busy:true});await invoke(h);assert.equal(h.state.writes,0);assert.equal(h.state.notice,'previous notice');assert.deepEqual(h.state.notices,[]);
 });
}
test('stale results and rejected menu actions leave existing feedback untouched',async()=>{
 const h=harness();await h.handleProductionBattleResult({...rawResult,resultId:'stale-battle'});
 assert.equal(await h.handleProductionBattleAction('unknown'),false);assert.equal(h.state.writes,0);assert.deepEqual(h.state.notices,[]);
 const held=harness('success',{unsaved:rawResult});assert.equal(await held.handleProductionBattleAction('loadout'),false);assert.equal(held.state.writes,0);assert.deepEqual(held.state.notices,[]);
});
test('other flow callers retain their existing notice policy by default',async()=>{
 const h=harness();await h.updateFlow(leaveV100Battle(h.flow,'loadout').state);assert.equal(h.state.notice,'previous notice');assert.deepEqual(h.state.notices,[]);assert.equal(h.state.writes,1);
});
