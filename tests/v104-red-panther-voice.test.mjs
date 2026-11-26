import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {createAudioRequestGate,runGuardedAudioRequest} from '../app/audioMixer.js';
import {PRODUCTION_AUDIO_MANIFEST,V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,INSTALL_AUDIO_ASSETS,enemyVoiceCue,humanVoiceCueForUnit,unitAudioCueFor} from '../app/productionAudio.js';
import {PWA_PAN_GUARD_FILE} from '../app/pwaPanGuardFile.js';
import {shortHeavyHurtPool,withRecordedHurtTakes} from '../app/v100RecordedHurtTakes.js';
import {v177JointActorKey} from '../app/v177JointActorHistory.js';
import {playV104FighterVoice,queueV104HumanHurt,v104EnemyContactAudio,v104MonsterVoiceEvent,v104SupplementalEnemyVoice} from '../app/v104CombatAudio.js';
import {createBattleAudioRuntime,scheduleDelayedBattleAudioCue,takeDueBattleAudioCues} from '../app/battleAudioRuntime.js';
const kinds=['red-panther-knife','red-panther-shield','red-panther-smg','red-panther-commander'];
const events=['attack','hurt','death'];
const shortDeathTake = { 'crazy-king': '02', kumaverson: '01', 'red-panther-shield': '02', 'red-panther-commander': '01' };

function assertRecordedVoiceSource(source, kind, event) {
  const take = event === 'death' && shortDeathTake[kind];
  if (take) {
    const extension = { 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg' }[source.type];
    assert.ok(extension);
    const folder = extension === 'wav' ? '/audio/quality-20261125/voices/' : '/audio/v060/sfx/';
    assert.equal(source.src, folder + 'human-male-heavy-death-' + take + '.' + extension);
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
   assert.deepEqual(asset.sources.map(s=>s.type),take?['audio/wav','audio/mpeg','audio/ogg']:['audio/mpeg','audio/ogg']);
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
test('generic heavy voice reactions prefer the matching short recording and retain the installed formats', () => {
  for (const take of ['01','02']) {
    const id = 'human-male-heavy-death-' + take;
    for (const manifest of [GAMEPLAY_PRODUCTION_AUDIO_MANIFEST, V100_AUDIO_MANIFEST]) {
      const [source, ...fallback] = manifest.assetById[id].sources;
      assert.equal(source.src, '/audio/quality-20261125/voices/' + id + '.wav');
      assert.deepEqual(fallback.map(item => item.src), ['/audio/v060/sfx/' + id + '.mp3', '/audio/v060/sfx/' + id + '.ogg']);
      const data = fs.readFileSync('public' + source.src);
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.readUInt16LE(22), 1);
      assert.equal(data.readUInt32LE(24), 44100);
    }
  }
});
test('four distinct light hurt performances retain the same voice and both original fallback formats', () => {
  const folder = 'assets/source/quality-20261126/recorded-light-hurt';
  const evidence = JSON.parse(fs.readFileSync(folder + '/provenance.json', 'utf8'));
  for (const manifest of [GAMEPLAY_PRODUCTION_AUDIO_MANIFEST,V100_AUDIO_MANIFEST]) {
    const pool = manifest.poolById['human-male-light-hurt'];
    assert.deepEqual(pool.assetIds, ['01','02','03','04'].map(take => 'human-male-light-hurt-' + take));
    assert.ok(pool.avoidImmediateRepeat);
    for (const [index, recording] of evidence.performances.entries()) {
      const asset = manifest.assetById[pool.assetIds[index + 2]];
      assert.equal(asset.sources[0].src, recording.runtime);
      assert.deepEqual(asset.sources.slice(1), manifest.assetById[pool.assetIds[index]].sources);
      assert.equal(createHash('sha256').update(fs.readFileSync(folder + '/' + recording.master)).digest('hex'), recording.masterSha256);
      assert.equal(createHash('sha256').update(fs.readFileSync('public' + recording.runtime)).digest('hex'), recording.runtimeSha256);
      assert.equal(INSTALL_AUDIO_ASSETS.filter(entry => entry.sources[0].src === recording.runtime).length, 1);
    }
  }
});

test('the game served under the Pages base still picks the short defeat recordings and the matching fallbacks', () => {
  const prefix = source => source.replaceAll('/audio/', '/Zombieee/audio/');
  const moduleSource = fs.readFileSync('app/v104CombatAudio.js', 'utf8');
  // The Pages build prefixes absolute audio paths in the emitted JavaScript.
  const compiled = ts.transpileModule(prefix(moduleSource), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const imports = { './pwaPanGuardFile.js': {PWA_PAN_GUARD_FILE}, './v177JointActorHistory.js': {v177JointActorKey},
    './v100RecordedHurtTakes.js': {shortHeavyHurtPool,withRecordedHurtTakes} };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require(id) {
    assert.ok(Object.hasOwn(imports, id), id);
    return imports[id];
  }});
  const scopedAssets = PRODUCTION_AUDIO_MANIFEST.assets.map(asset => ({
    ...asset,
    sources: asset.sources.map(source => ({ ...source, src: prefix(source.src) })),
  }));
  const manifest = exports.withV104CombatAudio({ assets: scopedAssets });
  const takes = [
    ['human-male-heavy-death-01', '01'],
    ['human-male-heavy-death-02', '02'],
    ...Object.entries(shortDeathTake).map(([kind, take]) => ['voice-' + kind + '-death', take]),
    ['voice-red-panther-shield-death-alternate', '01'],
    ['voice-red-panther-commander-death-alternate', '02'],
  ];
  for (const [id, take] of takes) {
    const actual = manifest.assets.find(asset => asset.id === id).sources;
    const name = 'human-male-heavy-death-' + take;
    assert.deepEqual(plain(actual.map(source => source.src)), [
      '/Zombieee/audio/quality-20261125/voices/' + name + '.wav',
      '/Zombieee/audio/v060/sfx/' + name + '.mp3',
      '/Zombieee/audio/v060/sfx/' + name + '.ogg',
    ], id);
  }
});
test('Red Panther combat cues alternate recordings from the same voice family at the original intensity', () => {
  const installed = new Set(INSTALL_AUDIO_ASSETS.flatMap(asset => asset.sources.map(source => source.src)));
  for (const kind of kinds) for (const event of events) {
    const voice = v104SupplementalEnemyVoice(enemyVoiceCue(kind, event));
    for (const manifest of [GAMEPLAY_PRODUCTION_AUDIO_MANIFEST, V100_AUDIO_MANIFEST]) {
      const pool = manifest.poolById[voice.cueId];
      const [first, second] = pool.assetIds.map(id => manifest.assetById[id]);
      assert.equal(pool.strategy, 'round-robin');
      const extraHurt = event === 'hurt' && ['red-panther-knife', 'red-panther-smg'].includes(kind);
      assert.equal(pool.assetIds.length, extraHurt ? 4 : 2);
      if (extraHurt) {
        const takes = pool.assetIds.slice(2).map(id => manifest.assetById[id]);
        const expected = kind === 'red-panther-smg' ? ['04','03'] : ['03','04'];
        for (const [index, asset] of takes.entries()) {
          const src = '/audio/quality-20261126/voices/human-male-light-hurt-' + expected[index] + '.mp3';
          assert.equal(asset.sources[0].src, src);
          assert.ok(installed.has(src));
          assert.deepEqual(asset.sources.slice(1), [first,second][index].sources);
          assert.equal(asset.gain, first.gain);
        }
      }
      assert.equal(first.id, voice.asset.id);
      assert.deepEqual(first.sources, voice.asset.sources);
      assert.equal(pool.cooldownMs, voice.asset.cooldownMs);
      const firing = kind === 'red-panther-smg' || kind === 'red-panther-commander';
      if (event === 'attack') assert.equal(pool.cooldownMs, firing ? 5000 : 1400);
      assert.equal(pool.priority, voice.asset.priority);
      assert.equal(pool.maxInstances, voice.asset.maxInstances);
      assert.equal(second.gain, first.gain);
      assert.deepEqual(second.sources.map(s => s.type), first.sources.map(s => s.type));
      for (const [index, source] of first.sources.entries()) {
        const take = /0([12])(?=\.\w+$)/.exec(source.src);
        assert.ok(take);
        const alternate = second.sources[index].src;
        assert.equal(alternate, source.src.replace(/0[12](?=\.\w+$)/, take[1] === '1' ? '02' : '01'));
        assert.ok(installed.has(source.src) && installed.has(alternate));
      }
    }
  }
});
test('named allies vary recorded hurt reactions while keeping the fighter and first take', async () => {
  const roles = [
    ['kumaverson', 'heavy', ['01', '02']],
    ['crazy-king', 'heavy', ['02', '01']],
    ['babayaga', 'light', ['02', '01', '03', '04']],
  ];
  const installed = new Set(INSTALL_AUDIO_ASSETS.flatMap(asset => asset.sources.map(source => source.src)));
  for (const [kind, family, takes] of roles) {
    const cue = humanVoiceCueForUnit(kind, 'hurt');
    for (const external of [true, false]) {
      const manifest = external ? V100_AUDIO_MANIFEST : GAMEPLAY_PRODUCTION_AUDIO_MANIFEST;
      const player = actualPlayer({external});
      player.play(cue, 640, {ownerId: 12, semantic: 'battle-hurt', receiptId: 'injury:12', volume: .8});
      await flush();
      assert.equal(player.requests.length, 1);
      const request = player.requests[0];
      const pool = manifest.poolById[request.cueId];
      assert.equal(pool.strategy, 'round-robin');
      assert.equal(pool.assetIds[0], cue);
      assert.equal(request.options.instanceKey, 'fighter-voice:5:12');
      assert.equal(request.options.volume, .8);
      assert.equal(request.options.maxInstances, 1);
      assert.equal(pool.assetIds.length, takes.length);
      for (const [i, id] of pool.assetIds.entries()) {
        const asset = manifest.assetById[id];
        assert.equal(asset.sources[0].src.split('/').pop(), 'human-male-' + family + '-hurt-' + takes[i] + '.mp3');
        assert.ok(asset.sources.every(source => installed.has(source.src)));
        assert.equal(asset.gain, manifest.assetById[cue].gain);
      }
      for (const event of ['attack', 'death']) assert.equal(manifest.poolById['voice-' + kind + '-' + event + '-takes'], undefined);
    }
  }
});
test('a rapid series of minor injuries selects short takes for the same fighter only', async () => {
  const world = {time:0, battleAudioGeneration:0};
  const fighter = {id:17, kind:'guardian', hp:90, maxHp:100, x:640};
  const cue = humanVoiceCueForUnit(fighter.kind,'hurt');
  const brief = 'human-male-heavy-hurt-brief';
  function hit(time,damage,who=fighter,battle=world) {
    battle.time=time;
    const accepted=queueV104HumanHurt(battle,who,who.hp+damage,cue);
    return accepted ? battle.pendingBattleAudioCues.at(-1) : null;
  }
  assert.equal(hit(0,10).hurtVoiceCueId,undefined);
  assert.equal(hit(.6,10),null);
  assert.equal(hit(1,0),null);
  const repeat=hit(1.4,5,{...fighter});
  assert.equal(repeat.hurtVoiceCueId,brief);
  assert.equal(hit(2.9,25).hurtVoiceCueId,undefined);
  assert.equal(hit(5.1,5).hurtVoiceCueId,undefined);
  assert.equal(hit(5.9,5,{...fighter,id:19}).hurtVoiceCueId,undefined);
  assert.equal(hit(6,5,fighter,{time:6,battleAudioGeneration:0}).hurtVoiceCueId,undefined);
  assert.equal(hit(7,5,{...fighter,hp:0}),null);
  const runtime=createBattleAudioRuntime();
  assert.equal(scheduleDelayedBattleAudioCue(runtime,repeat),true);
  const [due]=takeDueBattleAudioCues(runtime,{simulationTime:2,resolveOwner:()=>({alive:true,retreat:false,activationId:0})});
  assert.equal(due.hurtVoiceCueId,brief);
  const dispatch=nodes.filter(n=>ts.isForOfStatement(n) && n.expression.getText(tree)==='dueBattleAudioCues');
  assert.equal(dispatch.length,1);
  for(const external of [true,false]) {
    const player=actualPlayer({external});
    vm.runInNewContext(dispatch[0].getText(tree),{dueBattleAudioCues:[due],playProductionCue:player.play});
    await flush();
    assert.equal(player.requests.length,1);
    assert.equal(player.requests[0].cueId,brief);
    assert.equal(player.requests[0].options.instanceKey,'fighter-voice:0:17');
  }
});

test('each brief pool retains its original performer, gain and offline fallback', () => {
  const log=JSON.parse(fs.readFileSync('assets/source/quality-20261127/recorded-heavy-hurt/provenance.json'));
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  for(const take of log.performances) {
    assert.equal(hash('assets/source/quality-20261127/recorded-heavy-hurt/'+take.master),take.masterSha256);
    assert.equal(hash('public'+take.runtime),take.runtimeSha256);
  }
  const cues=['human-male-heavy-hurt','voice-kumaverson-hurt','voice-crazy-king-hurt',
    'voice-red-panther-shield-hurt','voice-red-panther-commander-hurt'];
  for(const manifest of [V100_AUDIO_MANIFEST,GAMEPLAY_PRODUCTION_AUDIO_MANIFEST]) for(const cue of cues) {
    const original=manifest.poolById[cue+'-takes']??manifest.poolById[cue];
    const brief=manifest.poolById[shortHeavyHurtPool(cue)];
    assert.deepEqual({...brief,id:original.id,assetIds:original.assetIds},original);
    assert.equal(brief.assetIds.length,log.performances.length);
    for(const [i,id] of brief.assetIds.entries()) {
      const asset=manifest.assetById[id], full=manifest.assetById[original.assetIds[i]];
      assert.deepEqual(asset.sources[0],{src:log.performances[i].runtime,type:'audio/mpeg'});
      assert.deepEqual(asset.sources.slice(1),full.sources);
      assert.equal(asset.gain,full.gain);
    }
  }
});

test('rapid Panther injuries shorten the voice while armor, fatal contacts and other voice families keep their own behavior', async () => {
  for(const kind of kinds) {
    const actor={id:13,kind,side:'zombie',hp:80,maxHp:120};
    const world={time:1}, cue=enemyVoiceCue(kind,'hurt');
    assert.equal(v104EnemyContactAudio(world,actor,8,cue).hurtVoiceCueId,undefined);
    world.time=2.4;
    assert.equal(v104EnemyContactAudio(world,actor,0,cue).voiceAllowed,false);
    const options=v104EnemyContactAudio(world,actor,7,cue);
    const expected=shortHeavyHurtPool('voice-'+kind+'-hurt');
    assert.equal(options.hurtVoiceCueId,expected);
    const player=actualPlayer();
    player.play(cue,640,options);
    await flush();
    assert.deepEqual(player.requests.map(row=>row.cueId),[cue,expected??'voice-'+kind+'-hurt-takes']);
    assert.equal(player.requests[1].options.instanceKey,'rp-voice:13');
    world.time=3.5;
    assert.equal(v104EnemyContactAudio(world,actor,30,cue).hurtVoiceCueId,undefined);
    world.time=5;
    assert.equal(v104EnemyContactAudio(world,{...actor,hp:0},20,cue),null);
  }
});

test('the actual game keeps the weapon request unchanged and adds one independently controlled actor voice',async()=>{
 for(const kind of kinds)for(const event of events){
  const player=actualPlayer(),cueId=enemyVoiceCue(kind,event);
  player.play(cueId,640,{ownerId:91,priority:17,volume:.3,playbackRate:.66,durationSeconds:.05,maxInstances:3,dedupeKey:'contact:91'});
  await flush();assert.equal(player.requests.length,2);assert.equal(player.requests[0].cueId,cueId);
  assert.deepEqual(plain(player.requests[0].options),{pan:0,priority:17,volume:.3,playbackRate:.66,maxInstances:3,durationSeconds:.05,dedupeKey:'contact:91'});
  const expected = `voice-${kind}-${event}-takes`;
  assert.equal(player.requests[1].cueId,expected);
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
