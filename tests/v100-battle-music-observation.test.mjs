import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source=await readFile('scripts/v100-battle-improvement-browser.mjs','utf8');
const parsed=ts.createSourceFile('battle.mjs',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const named=name=>parsed.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text===name);
const gate=named('assertBattleMusicGate'),reader=named('readBattleMusicObservation');
const required=parsed.statements.find(x=>ts.isVariableStatement(x)&&x.declarationList.declarations.some(d=>d.name.getText(parsed)==='requiredMusic'));
assert.ok(gate&&required);
function context(extra={}){const ctx=vm.createContext({assert,...extra});vm.runInContext(required.getText(parsed)+'\n'+gate.getText(parsed)+(reader?'\n'+reader.getText(parsed):''),ctx);return ctx;}
const sample=(id,time,battleSnapshot)=>({time,...(battleSnapshot?{battleSnapshot}:{}),audio:{activeBgm:[{assetId:id,voiceGain:.72}],contextState:'running',audioState:'running',unlocked:true,duplicateLoopInstanceKeys:[]},shellAudio:{activeBgmVoices:0}});
const naturalDefeat={time:3,bossKind:'takuya',bossDefeated:true,bossAlive:false,over:false,running:true};
const liveState=(time,bossAlive=false)=>({...naturalDefeat,time,bossAlive,bossDefeated:false});
const sameFrame=()=>({number:3,musicObservationVersion:'live-battle-mixer-v1',musicSamples:[sample('music-v100-score-normal',1,liveState(1)),sample('music-boss',2,liveState(2,true)),sample('music-v100-score-pressure',3,{...naturalDefeat})],
 boss:{firstObservedTime:2},bossDefeatedAt:3,last:{time:3.3,over:true,bossDefeated:true},lastReadableBattleSnapshot:{time:3.3,over:true,bossDefeated:true},actualResult:{won:true,loss:false},finalRequestFailures:{events:[],overflow:0},networkRequestFailures:[]});
function validate(result){const ctx=context();ctx.input=JSON.stringify(result);return vm.runInContext('assertBattleMusicGate(JSON.parse(input))',ctx);}

test('a live atomic defeated-boss snapshot proves pressure at the first observed defeat clock',()=>{
 assert.equal(validate(sameFrame()).postBossMusic,'observed-during-continuing-battle');
});
for(const [key,value]of [['bossDefeated',false],['bossAlive',true],['over',true],['running',false],['time',2.9],['bossKind','gate-eater']])test(`same-clock pressure rejects invalid atomic ${key}`,()=>{
 const result=sameFrame();result.musicSamples.at(-1).battleSnapshot[key]=value;
 assert.throws(()=>validate(result));
});
test('same-clock pressure without the native boss-state proof is still rejected',()=>{
 const result=sameFrame();delete result.musicSamples.at(-1).battleSnapshot;assert.throws(()=>validate(result));
});
test('a pre-boss pressure row cannot masquerade as post-boss evidence',()=>{
 const result=sameFrame();result.musicSamples=[result.musicSamples[0],result.musicSamples[2],result.musicSamples[1]];assert.throws(()=>validate(result));
});
test('later continuing-battle evidence and the existing terminal-win branch remain valid',()=>{
 const later=sameFrame();later.musicSamples.at(-1).time=4;delete later.musicObservationVersion;for(const s of later.musicSamples)delete s.battleSnapshot;assert.doesNotThrow(()=>validate(later));
 const terminal=sameFrame();terminal.musicSamples.pop();terminal.musicSamples.splice(1,0,sample('music-v100-score-pressure',1.5,liveState(1.5)));terminal.last.time=3;terminal.lastReadableBattleSnapshot.time=3;
 assert.equal(validate(terminal).postBossMusic,'terminal-victory-at-first-observation');
});
test('native-version evidence cannot fall back to legacy timestamps when all boss-state stamps are missing',()=>{
 const result=sameFrame();result.musicSamples.at(-1).time=4;for(const s of result.musicSamples)delete s.battleSnapshot;assert.throws(()=>validate(result));
});
test('an old same-clock row cannot gain acceptance without newly measured boss-state evidence',()=>{
 const result=sameFrame();delete result.musicObservationVersion;for(const s of result.musicSamples)delete s.battleSnapshot;assert.throws(()=>validate(result));
});
test('native boss music must show the living boss, not a late music transition',()=>{
 const result=sameFrame();result.musicSamples[1].battleSnapshot.bossAlive=false;assert.throws(()=>validate(result));
});
for(const invalid of ['gain','context','unlock','duplicate','preparation','failure','network'])test(`atomic timing cannot bypass the existing ${invalid} contract`,()=>{
 const r=sameFrame(),s=r.musicSamples.at(-1);
 if(invalid==='gain')s.audio.activeBgm[0].voiceGain=0;
 if(invalid==='context')s.audio.contextState='suspended';
 if(invalid==='unlock')s.audio.unlocked=false;
 if(invalid==='duplicate')s.audio.duplicateLoopInstanceKeys=['duplicate'];
 if(invalid==='preparation')s.shellAudio.activeBgmVoices=1;
 if(invalid==='failure')r.finalRequestFailures.events=['failure'];
 if(invalid==='network')r.networkRequestFailures=['failure'];
 assert.throws(()=>validate(r));
});

test('the browser reader binds mixer evidence to its own live battle snapshot',()=>{
 assert.ok(reader,'the actual browser collector is required');
 const snapshot={time:74.783,bossDefeated:true,over:false,running:true,fighters:[{side:'zombie',kind:'takuya',hp:0}]};
 const diagnostics={activeBgm:[{assetId:'music-v100-score-pressure',voiceGain:.72}],duplicateLoopInstanceKeys:[],contextState:'running',audioState:'running',unlocked:true,activeBgmVoices:1};
 const ctx=context({window:{__ASHFALL_BATTLE_QA__:{getSnapshot:()=>snapshot},__ASHFALL_AUDIO_QA__:{getDiagnostics:()=>diagnostics,getAudioStatus:()=>({state:'running'}),getCueRequests:()=>[]},__V100_EVENT_AUDIO_QA__:{getDiagnostics:()=>({activeBgmVoices:0})}},document:{querySelector:()=>null}});
 const result=vm.runInContext("readBattleMusicObservation('takuya')",ctx);
 assert.equal(result.time,74.783);assert.equal(result.battleSnapshot.time,result.time);assert.equal(result.battleSnapshot.bossDefeated,true);assert.equal(result.battleSnapshot.bossAlive,false);
 snapshot.fighters[0].hp=1;assert.equal(vm.runInContext("readBattleMusicObservation('takuya')",ctx).battleSnapshot.bossAlive,true);
 snapshot.over=true;assert.equal(vm.runInContext("readBattleMusicObservation('takuya')",ctx),null);
 snapshot.over=false;ctx.document.querySelector=()=>({});assert.equal(vm.runInContext("readBattleMusicObservation('takuya')",ctx),null);
});
test('the real capture loop uses the atomic reader and retains its timestamp unchanged',()=>{
 const calls=[];function visit(node){if(ts.isCallExpression(node))calls.push(node);ts.forEachChild(node,visit);}visit(parsed);
 assert.equal(calls.filter(x=>x.expression.getText(parsed)==='page.evaluate'&&x.arguments[0]?.getText(parsed)==='readBattleMusicObservation').length,1);
 const pushes=calls.filter(x=>x.expression.getText(parsed)==='(result.musicSamples??=[]).push');
 assert.equal(pushes.length,1);assert.equal(pushes[0].arguments[0].getText(parsed),'audio');
});
