import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {createAudioRequestGate,runGuardedAudioRequest} from '../app/audioMixer.js';
import {V100_AUDIO_MANIFEST,enemyVoiceCue} from '../app/productionAudio.js';
import {v104SupplementalEnemyVoice} from '../app/v104CombatAudio.js';
const kinds=['red-panther-knife','red-panther-shield','red-panther-smg','red-panther-commander'];
const events=['attack','hurt','death'];
const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
const tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes=[];
function visit(node){nodes.push(node);ts.forEachChild(node,visit);}visit(tree);
const declaration=nodes.filter(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='playProductionCue');
assert.equal(declaration.length,1);
const body=declaration[0].initializer.arguments[0].getText(tree);
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function actualPlayer({muted=false,consume=true,cancelAfterMaterial=false}={}){
 const requests=[],stops=[],gate=createAudioRequestGate();
 const mixer={unlocked:true,play(cueId,options){requests.push({cueId,options});
  if(cancelAfterMaterial&&!cueId.startsWith('voice-'))queueMicrotask(()=>gate.cancelPending());
  return Promise.resolve({cueId});},stopInstance(key,options){stops.push({key,options});}};
 const bindings={productionMixerRef:{current:mixer},battleAudioRuntimeRef:{current:{}},
  tryConsumeSemanticReceipt:()=>consume,sfxMutedRef:{current:muted},externalSessionActive:false,
  SFX_CUES:{},W:1280,productionCueQaLogRef:{current:[]},sfxRequestGateRef:{current:gate},
  runGuardedAudioRequest,v104SupplementalEnemyVoice};
 return {requests,stops,play:vm.runInNewContext(ts.transpile('('+body+')',{target:ts.ScriptTarget.ES2022}),bindings)};
}
test('four RED PANTHER roles own twelve new utterances while every material alias remains intact',()=>{
 const rows=JSON.parse(fs.readFileSync('assets/source/v104/combat-audio/voices.json')).cast.filter(row=>kinds.includes(row.kind));
 assert.equal(rows.length,12);assert.equal(new Set(rows.map(row=>row.source)).size,12);assert.equal(new Set(rows.map(row=>row.sha256)).size,12);
 const materials={
  'red-panther-knife':['weapon-crowbar','weapon-melee-impact','v100-body-fall'],
  'red-panther-shield':['v104-armor-hit','v104-armor-hit','v100-body-fall'],
  'red-panther-smg':['weapon-gunner','weapon-melee-impact','v100-body-fall'],
  'red-panther-commander':['v104-handgun','weapon-melee-impact','v100-body-fall'],
 };
 for(const kind of kinds)for(const [i,event]of events.entries()){
  const original=enemyVoiceCue(kind,event),voice=v104SupplementalEnemyVoice(original);
  assert.equal(V100_AUDIO_MANIFEST.aliasById[original].targetId,materials[kind][i]);
  assert.equal(voice.asset.id,`voice-${kind}-${event}`);assert.equal(V100_AUDIO_MANIFEST.assetById[voice.asset.id].category,'humanVoices');
  const row=rows.find(row=>row.kind===kind&&row.event===event);assert.equal(row.styleId,52);assert.equal(row.credit,'VOICEVOX:雀松朱司');
  assert.equal(createHash('sha256').update(fs.readFileSync(row.source)).digest('hex'),row.sha256);
  for(const s of voice.asset.sources)assert.ok(fs.existsSync('public'+s.src));
 }
 for(const cue of ['enemy-takuya-attack','weapon-pan-hit','voice-babayaga-hurt',null])assert.equal(v104SupplementalEnemyVoice(cue),null);
});
test('the actual game keeps the weapon request unchanged and adds one independently controlled actor voice',async()=>{
 for(const kind of kinds)for(const event of events){
  const player=actualPlayer(),cueId=enemyVoiceCue(kind,event);
  player.play(cueId,640,{ownerId:91,priority:17,volume:.3,playbackRate:.66,durationSeconds:.05,maxInstances:3,dedupeKey:'contact:91'});
  await flush();assert.equal(player.requests.length,2);assert.equal(player.requests[0].cueId,cueId);
  assert.deepEqual(plain(player.requests[0].options),{pan:0,priority:17,volume:.3,playbackRate:.66,maxInstances:3,durationSeconds:.05,dedupeKey:'contact:91'});
  assert.equal(player.requests[1].cueId,`voice-${kind}-${event}`);
  assert.deepEqual(plain(player.requests[1].options),{pan:0,instanceKey:'rp-voice:91',maxInstances:1,dedupeKey:'contact:91:voice'});
  assert.deepEqual(plain(player.stops),event==='attack'?[]:[{key:'rp-voice:91',options:{fadeMs:20}}]);
 }
});
test('mute, consumed semantics and navigation cancellation cannot start a supplemental voice',async()=>{
 const cueId=enemyVoiceCue(kinds[0],'attack');
 for(const settings of [{muted:true},{consume:false}]){
  const p=actualPlayer(settings);p.play(cueId,600,{ownerId:12,semantic:'fighter-defeat',receiptId:'fighter:12'});
  await flush();assert.equal(p.requests.length,0);assert.equal(p.stops.length,0);
 }
 const cancelled=actualPlayer({cancelAfterMaterial:true});cancelled.play(cueId,600,{ownerId:12});await flush();
 assert.equal(cancelled.requests.length,1);assert.equal(cancelled.requests[0].cueId,cueId);
 const anonymous=actualPlayer();anonymous.play(cueId,600);await flush();assert.equal(anonymous.requests.length,1);
 const blocked=actualPlayer();blocked.play(enemyVoiceCue(kinds[0],'hurt'),600,{ownerId:12,voiceAllowed:false});await flush();assert.equal(blocked.requests.length,1);assert.equal(blocked.stops.length,0);
 const unrelated=actualPlayer();unrelated.play('enemy-takuya-attack',600,{ownerId:12});await flush();assert.equal(unrelated.requests.length,1);
});
