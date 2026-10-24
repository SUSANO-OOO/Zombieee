import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import {V100_AUDIO_MANIFEST,LEGACY_SFX_CUE_MAP,enemyVoiceCue,enemyCombatCueFor,unitAudioCueFor,weaponCueForUnit} from '../app/productionAudio.js';
import {v104ContactIsHard} from '../app/v104CombatAudio.js';
import {V090_INFECTED_KINDS} from '../app/v090Infected.js';
import {weaponProfileForUnit} from '../app/combatPresentation.js';
const source=fs.readFileSync('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('AshfallGame.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes=[];
function visit(n){nodes.push(n);ts.forEachChild(n,visit);}visit(tree);
const one=predicate=>{const found=nodes.filter(predicate);assert.equal(found.length,1);return found[0];};
const run=(node,bindings)=>vm.runInNewContext(ts.transpile(node.getText(tree),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}),bindings);
const isCue=(node,name)=>ts.isCallExpression(node)&&node.expression.getText(tree)===name;
const globals={enemyVoiceCue,enemyCombatCueFor,unitAudioCueFor,weaponCueForUnit,v104ContactIsHard};
const imported=new Set(nodes.filter(ts.isImportSpecifier).map(n=>n.name.text));
for(const name of Object.keys(globals))assert.ok(imported.has(name),`The actual game must import ${name}; a VM binding cannot repair a missing production binding`);

test('the actual committed normal-attack selector matches the crossbow and eye pulse without changing projectile cadence',()=>{
 const fn=one(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='normalAttackProductionCueId');
 const select=vm.runInNewContext(ts.transpile(fn.getText(tree)+'\nnormalAttackProductionCueId;'),globals);
 assert.equal(select({side:'human',kind:'engineer'}),'weapon-crossbow-release');
 assert.equal(select({side:'zombie',kind:'kurome'}),'v104-eye-fire');
 assert.equal(select({side:'zombie',kind:'takuya'}),'enemy-takuya-attack');
 assert.equal(select({side:'human',kind:'babayaga'}),'weapon-suppressed-pistol');
 assert.equal(weaponProfileForUnit('engineer').projectileTravelSeconds,.12);
 assert.equal(weaponProfileForUnit('engineer').casing,false);
});

test('one real pan contact requests one contact waveform even when the victim already has stun',()=>{
 const block=one(n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='f.kind === "kumaverson"'&&n.thenStatement.getText(tree).includes('targetIsHeavy ? "heavyHit"'));
 for(const targetIsHeavy of [true,false])for(const stunned of [0,.38]){
  const requests=[];
  run(block,{...globals,f:{kind:'kumaverson'},target:{stunned},targetIsHeavy,contactAudioX:400,playProductionCue:(...args)=>requests.push(args)});
  assert.equal(requests.length,1,'different cue IDs must not start the same pan-heavy waveform twice');
  assert.equal(requests[0][0],targetIsHeavy?'weapon-pan-heavy-hit':'weapon-pan-hit');
 }
});

test('actual chainsaw contact distinguishes plated targets and structures from heavy flesh',()=>{
 const contact=one(n=>isCue(n,'playProductionCue')&&n.arguments[0].getText(tree).startsWith('unitAudioCueFor(')&&n.arguments[0].getText(tree).includes('v104ContactIsHard(target.kind)'));
 for(const [kind,hard]of [['crusher',true],['grappler',true],['gate-eater',true],['gairen',true],['guardian',true],['red-panther-shield',true],['abomination',false],['takuya',false],['walker',false]]){
  const requests=[];
  run(contact,{...globals,f:{kind:'crazy-king'},target:{kind},targetIsHeavy:true,contactAudioX:400,playProductionCue:(...args)=>requests.push(args)});
  assert.equal(requests[0][0],hard?'weapon-chainsaw-hard-hit':'weapon-chainsaw-flesh-hit');
 }
 const structure=one(n=>isCue(n,'playProductionCue')&&n.arguments[0].getText(tree)==='unitAudioCueFor(f.kind, "weapon", "hardHit")'&&n.arguments[1].getText(tree)==='structureAudioX');
 const requests=[];run(structure,{...globals,f:{kind:'crazy-king'},structureAudioX:900,playProductionCue:(...args)=>requests.push(args)});
 assert.equal(requests[0][0],'weapon-chainsaw-hard-hit');
});

test('TAKUYA outgoing impact never impersonates its own HP-loss event',()=>{
 const contact=one(n=>isCue(n,'playProductionCue')&&n.arguments[0].getText(tree).startsWith('v104ContactIsHard(target.kind)'));
 for(const kind of ['guardian','brawler']){
  const requests=[];run(contact,{...globals,target:{kind,x:400},playProductionCue:(...args)=>requests.push(args)});
  assert.equal(requests[0][0],kind==='guardian'?'v104-armor-hit':'weapon-melee-impact');
  assert.equal(LEGACY_SFX_CUE_MAP[requests[0][2].fallbackCue],'weapon-melee-impact');
 }
 assert.equal(enemyVoiceCue('takuya','hurt'),'enemy-takuya-hurt','real HP-loss voice is retained');
});

test('six real infected impact cue expressions and the president warning resolve their own installed profiles',()=>{
 const impact=one(n=>isCue(n,'playBattleSemanticCue')&&n.arguments[2]?.getText(tree).includes('semantic: "enemy-ability-impact"'));
 for(const kind of V090_INFECTED_KINDS){
  const cue=run(impact.arguments[0],{...globals,f:{kind}});
  assert.equal(cue,enemyVoiceCue(kind,'attack'));assert.notEqual(cue,'enemy-takuya-attack');
  assert.ok(V100_AUDIO_MANIFEST.assetById[cue]||V100_AUDIO_MANIFEST.poolById[cue]);
 }
 const warning=one(n=>isCue(n,'playBattleSemanticCue')&&n.arguments[2]?.getText(tree).includes('semantic: "boss-phase-warning"')&&n.arguments[0].getText(tree).includes('mugarian-president-mutated'));
 const cue=run(warning.arguments[0],{...globals,anomalyKind:'mugarian-president-mutated',f:{kind:'mugarian-president-mutated'}});
 assert.equal(cue,enemyCombatCueFor('mugarian-president-mutated','phase'));
 assert.equal(V100_AUDIO_MANIFEST.aliasById[cue].targetId,'boss-mother-brood-warning');
});

test('crossbow sources are reproducibly bound to a non-voice string/latch release with local license notices',()=>{
 const asset=V100_AUDIO_MANIFEST.assetById['weapon-crossbow-release'];assert.ok(asset);
 const provenance=JSON.parse(fs.readFileSync('assets/source/v104/combat-audio/provenance.json'));
 for(const s of asset.sources){
  const file='public'+s.src,r=provenance.records.find(r=>r.file===file);assert.ok(r);
  assert.equal(r.nonVoice,true);assert.equal(r.credit.license,'CC0-1.0');assert.ok(fs.existsSync(r.credit.notice));
  assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),r.sha256);
  assert.ok(r.inputs.some(i=>i.file.endsWith('/crossbow-string.wav')));
  assert.ok(r.inputs.every(i=>!/(cz|sks|voice|gunshot)/i.test(i.file)));
  for(const input of r.inputs)assert.equal(createHash('sha256').update(fs.readFileSync(input.file)).digest('hex'),input.sha256);
 }
});
