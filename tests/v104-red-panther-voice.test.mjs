import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {createAudioRequestGate,runGuardedAudioRequest} from '../app/audioMixer.js';
import {V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,INSTALL_AUDIO_ASSETS,enemyVoiceCue,humanVoiceCueForUnit,unitAudioCueFor} from '../app/productionAudio.js';
import {playV104FighterVoice,v104MonsterVoiceEvent,v104SupplementalEnemyVoice} from '../app/v104CombatAudio.js';
const kinds=['red-panther-knife','red-panther-shield','red-panther-smg','red-panther-commander'];
const events=['attack','hurt','death'];
const shortDeathTake = { 'crazy-king': '02', kumaverson: '01', 'red-panther-shield': '02', 'red-panther-commander': '01' };

function assertRecordedVoiceSource(source, kind, event) {
  const take = event === 'death' && shortDeathTake[kind];
  if (take) {
    assert.equal(source.src, '/audio/quality-20261125/voices/human-male-heavy-death-' + take + '.wav');
    assert.equal(source.type, 'audio/wav');
    return;
  }
  assert.match(source.src, /^\/audio\/v060\/sfx\/human-male-(?:heavy|light)-(?:attack|hurt|death)-0[12]\.(?:mp3|ogg)$/);
}
const source=fs.readFileSync('app/AshfallGame.tsx','utf8');
const tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes=[];
function visit(node){nodes.push(node);ts.forEachChild(node,visit);}visit(tree);
const declaration=nodes.filter(n=>ts.isVariableDeclaration(n)&&n.name.getText(tree)==='playProductionCue');
assert.equal(declaration.length,1);
const body=declaration[0].initializer.arguments[0].getText(tree);
const plain=value=>JSON.parse(JSON.stringify(value));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function actualPlayer({muted=false,consume=true,cancelAfterMaterial=false,external=true}={}){
 const requests=[],stops=[],gate=createAudioRequestGate();
 const mixer={unlocked:true,manifest:external?V100_AUDIO_MANIFEST:GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,play(cueId,options){requests.push({cueId,options});
  if(cancelAfterMaterial&&!cueId.startsWith('voice-'))queueMicrotask(()=>gate.cancelPending());
  return Promise.resolve({cueId});},stopInstance(key,options){stops.push({key,options});}};
 const bindings={productionMixerRef:{current:mixer},battleAudioRuntimeRef:{current:{}},
  tryConsumeSemanticReceipt:()=>consume,sfxMutedRef:{current:muted},externalSessionActive:external,
  externalSessionRef:{current:external?{}:null},gameRef:{current:{battleAudioGeneration:5}},
  SFX_CUES:{},W:1280,productionCueQaLogRef:{current:[]},sfxRequestGateRef:{current:gate},
  runGuardedAudioRequest,playV104FighterVoice,v104MonsterVoiceEvent,v104SupplementalEnemyVoice};
 return {requests,stops,play:vm.runInNewContext(ts.transpile('('+body+')',{target:ts.ScriptTarget.ES2022}),bindings)};
}
test('four RED PANTHER roles use recorded wordless reactions and preserve their legacy source masters',()=>{
 const rows=JSON.parse(fs.readFileSync('assets/source/v104/combat-audio/voices.json')).cast.filter(row=>kinds.includes(row.kind));
 assert.equal(rows.length,12);assert.equal(new Set(rows.map(row=>row.source)).size,12);assert.equal(new Set(rows.map(row=>row.sha256)).size,12);
 const materials={
  'red-panther-knife':['weapon-crowbar','weapon-melee-impact','v100-body-fall'],
  'red-panther-shield':['v104-armor-hit','v104-armor-hit','v100-body-fall'],
  'red-panther-smg':['weapon-smg','weapon-melee-impact','v100-body-fall'],
  'red-panther-commander':['v104-handgun','weapon-melee-impact','v100-body-fall'],
 };
 for(const kind of kinds)for(const [i,event]of events.entries()){
  const original=enemyVoiceCue(kind,event),voice=v104SupplementalEnemyVoice(original);
  assert.equal(V100_AUDIO_MANIFEST.aliasById[original].targetId,materials[kind][i]);
  assert.equal(voice.asset.id,`voice-${kind}-${event}`);assert.equal(V100_AUDIO_MANIFEST.assetById[voice.asset.id].category,'humanVoices');
  const row=rows.find(row=>row.kind===kind&&row.event===event);assert.equal(row.styleId,52);assert.equal(row.credit,'VOICEVOX:雀松朱司');
  assert.equal(createHash('sha256').update(fs.readFileSync(row.source)).digest('hex'),row.sha256);
  assert.deepEqual(voice.asset.sources, V100_AUDIO_MANIFEST.assetById[voice.asset.id].sources);
  for(const s of voice.asset.sources){assertRecordedVoiceSource(s,kind,event);assert.ok(fs.existsSync('public'+s.src));}
 }
 for(const cue of ['enemy-takuya-attack','weapon-pan-hit','voice-babayaga-hurt',null])assert.equal(v104SupplementalEnemyVoice(cue),null);
});
test('all formerly spoken human reactions are recorded performances and retain old offline recovery files',()=>{
 const named=['crazy-king','kumaverson','babayaga',...kinds];
 const installed=new Set(INSTALL_AUDIO_ASSETS.flatMap(a=>a.sources.map(s=>s.src)));
 for(const kind of named)for(const event of events){
  const id=`voice-${kind}-${event}`;
  for(const manifest of [GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,V100_AUDIO_MANIFEST]){
   const asset=manifest.assetById[id];assert.equal(asset.category,'humanVoices');
   const take = event === 'death' && shortDeathTake[kind];
   assert.deepEqual(asset.sources.map(s=>s.type),take?['audio/wav']:['audio/mpeg','audio/ogg']);
   for(const s of asset.sources){assertRecordedVoiceSource(s,kind,event);assert.ok(installed.has(s.src),'current recorded reaction is cached');}
   if (take) {
     for(const ext of ['mp3','ogg'])assert.ok(installed.has('/audio/v060/sfx/human-male-heavy-death-' + take + '.' + ext));
   } else {
     assert.equal(asset.sources[0].src.replace(/\.mp3$/, ''),asset.sources[1].src.replace(/\.ogg$/, ''),'codecs use the same performance');
   }
  }
  for(const ext of ['mp3','ogg'])assert.ok(installed.has(`/audio/v104/combat/${id}.${ext}`),'old installed speech remains available for recovery');
 }
 for(const kind of named.slice(0,3)){assert.equal(humanVoiceCueForUnit(kind,'deploy'),null);assert.equal(unitAudioCueFor(kind,'voice','deploy'),null);}
 assert.equal(humanVoiceCueForUnit('mayo-chan','deploy'),'voice-mayo-deploy','dog performance is separate from spoken human lines');
});
test('generic heavy voice reactions use the matching short recorded performance', () => {
  for (const take of ['01','02']) {
    const id = 'human-male-heavy-death-' + take;
    for (const manifest of [GAMEPLAY_PRODUCTION_AUDIO_MANIFEST, V100_AUDIO_MANIFEST]) {
      const [source] = manifest.assetById[id].sources;
      assert.equal(source.src, '/audio/quality-20261125/voices/' + id + '.wav');
      const data = fs.readFileSync('public' + source.src);
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.readUInt16LE(22), 1);
      assert.equal(data.readUInt32LE(24), 44100);
    }
  }
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
 assert.equal(unrelated.requests[0].options.instanceKey,'fighter-voice:5:12');
 const legacy=actualPlayer({external:false});legacy.play('enemy-takuya-attack',600,{ownerId:12});await flush();
 assert.equal(legacy.requests.length,1);assert.equal(legacy.requests[0].options.instanceKey,undefined);
});
