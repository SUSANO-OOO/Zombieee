import assert from 'node:assert/strict';
import {spriteKinds} from '../app/spriteManifest.js';
import {PLAYABLE_COMBAT_KINDS} from '../app/combatPresentation.js';
import {v177ProofFormIdentity} from '../app/v177ContinuousProof.js';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';

const freeze=value=>{
  if(value&&typeof value==='object'){
    for(const item of Object.values(value))freeze(item);
    Object.freeze(value);
  }
  return value;
};
export const PHASES=freeze(['move','attack','engage']);
export const VIEWPORTS=freeze([{width:1280,height:720},{width:844,height:390},{width:844,height:340}]);
export const OWNER_KINDS=freeze(['ordinary','turned-birth','mayo-activation','futago-pair','legacy-art']);
export const LIMITS=freeze({jobMinutes:15,caseMs:30000,contextCloseMs:5000,readinessMs:5000,
  clipMs:15000,clipStopMs:3000,clipBytes:8388608,moveAttackSamples:15,engageSamples:30,
  sampleDelayMs:120,maxHistoryRows:128,sourceRafRows:4096});

// The renderer and the production sprite catalog own this list. Keep no second
// table of character identities or historic atlas hashes in the capture driver.
const catalog={knownForms:spriteKinds,playableKinds:PLAYABLE_COMBAT_KINDS};
export const FORM_BINDINGS=freeze(spriteKinds.map(form=>({
  form,...v177ProofFormIdentity(form,catalog),
  owner:form==='turned'?'turned-birth':form==='mayo-chan-feral'?'mayo-activation'
    :form.startsWith('futago-separated-')?'futago-pair':form==='futago'?'legacy-art':'ordinary',
  atlas:{path:V177_JOINT_ATLASES[form]?.path},
})));
export const SHARDS=freeze(Array.from({length:12},(_,i)=>({
  id:'forms-'+(i+1),forms:FORM_BINDINGS.slice(i*4,i*4+4).map(f=>f.form),
})));

export function validateLimits(limits){assert.deepEqual(limits,LIMITS);return true;}
export function validateManifest(forms=FORM_BINDINGS,shards=SHARDS){
  assert.equal(forms.length,48);assert.equal(new Set(forms.map(f=>f.form)).size,48);
  for(let i=0;i<forms.length;i++){
    assert.deepEqual(forms[i],FORM_BINDINGS[i],'Capture must use the actual renderer identity');
    assert.ok(OWNER_KINDS.includes(forms[i].owner));
    assert.match(forms[i].atlas.path??'',/^\/art\/v100\/joints\/.+\.webp$/u);
  }
  assert.deepEqual(shards,SHARDS);assert.ok(shards.every(s=>s.forms.length===4));
  assert.equal(new Set(shards.flatMap(s=>s.forms)).size,48);
  const counts=Object.fromEntries(OWNER_KINDS.map(owner=>[owner,forms.filter(f=>f.owner===owner).length]));
  assert.deepEqual(counts,{ordinary:43,'turned-birth':1,'mayo-activation':1,'futago-pair':2,'legacy-art':1});
  return {forms:48,shards:12,counts,nativeAccepted:false};
}
export function planShard(shardId){
  validateManifest();const shard=SHARDS.find(s=>s.id===shardId);assert.ok(shard,'Unknown shard');
  const rows=shard.forms.flatMap(form=>PHASES.flatMap(phase=>VIEWPORTS.map(viewport=>{
    const binding=FORM_BINDINGS.find(f=>f.form===form);
    return {caseId:`${shard.id}:${form}:${phase}:${viewport.width}x${viewport.height}`,
      shardId:shard.id,form,phase,viewport,owner:binding.owner,binding};
  })));
  assert.equal(rows.length,36);assert.equal(new Set(rows.map(r=>r.caseId)).size,36);
  return freeze(rows);
}
export function assertPlannedCase(row){
  assert.ok(row&&typeof row==='object');
  const expected=planShard(row.shardId).find(v=>v.caseId===row.caseId);
  assert.ok(expected,'Unknown native case');
  const identity=Object.fromEntries(Object.keys(expected).map(key=>[key,row[key]]));
  assert.deepEqual(identity,expected,'Runtime rows must retain the planned source identity');return row;
}
export function assertRetainedBindings(row,{head,expectedHead,tree,files}){
  assertPlannedCase(row);assert.match(head??'',/^[a-f0-9]{40}$/u);assert.equal(head,expectedHead);
  assert.match(tree??'',/^[a-f0-9]{40}$/u);assert.ok(Array.isArray(files));
  const matches=files.filter(f=>f.file==='public'+row.binding.atlas.path);
  assert.equal(matches.length,1,'Retain the exact source atlas once');
  assert.match(matches[0].sha256??'',/^[a-f0-9]{64}$/u);
  assert.match(matches[0].gitBlob??'',/^[a-f0-9]{40}$/u);
  return {head,tree,sourceAndAtlasBound:true,nativeAccepted:false};
}
