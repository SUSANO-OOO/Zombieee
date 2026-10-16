import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from '../../app/v177JointPresentation.js';
import {V177_MELEE_JOINT_ATLASES} from '../../app/v177MeleeJointData.js';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';

// The original golden remains an immutable control for the legacy interpolation
// path. Planned leg correction and Mayo anticipation are tested independently
// against actual painted joints; they are deliberately visible runtime changes.
export function jointLegacyInterpolationControlDigest(kinds){
 const bytes=readFileSync(new URL('../fixtures/v177-pre-leg-mayo-atlas-r1.json.gz',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'e4b10ee7839f6c7b6e57ed6f907761ef0d497368e8d2acbdc6a75a9088cb5355');
 const original=new Map(kinds.map(k=>[k,V177_JOINT_ATLASES[k]]));
 try{
  // Producer's later Paisen photo replacement has its own source/rig tests.
  // Keep this historical control on the archived Paisen master, just as Mayo
  // stays on its immutable pre-correction master. Ranger's original decoded
  // cells are byte-identical; its later continuous upper rig is tested through
  // actual paint separately. Never regenerate this pre-change digest.
  for(const [kind,atlas]of original)V177_JOINT_ATLASES[kind]=kind==='mayo-chan'?JSON.parse(gunzipSync(bytes))
    :{...(kind==='brawler'?V177_MELEE_JOINT_ATLASES.brawler:atlas),legConstraints:undefined,
      ...(kind==='ranger'?{upperRig:undefined}:{})};
  return jointRenderTraceDigest(kinds);
 }finally{for(const [kind,atlas]of original)V177_JOINT_ATLASES[kind]=atlas;}
}
export function jointRenderTraceDigest(kinds){
 const hash=createHash('sha256');let poses=0,paintCalls=0;
 const quant=n=>typeof n==='number'?Math.round(n*1e6)/1e6:n;
 for(const kind of [...kinds].sort()){
  const atlas=V177_JOINT_ATLASES[kind];assert.ok(atlas,kind);
  for(const state of ['idle','move','start-move','stop-move','wind-up','active','recovery'])for(const phase of [.1371,.4729,.7934])for(const settle of [0,.5,1]){
   const trace=[],call=(name,...values)=>trace.push([name,...values.map(quant)]);
   const ctx={save(){call('save');},restore(){call('restore');},translate(...a){call('translate',...a);},scale(...a){call('scale',...a);},transform(...a){call('transform',...a);},drawImage(_image,...a){call('paint',...a);paintCalls++;},beginPath(){call('begin');},moveTo(...a){call('move',...a);},lineTo(...a){call('line',...a);},closePath(){call('close');},fill(){call('fill',this.fillStyle);}};
   const plan=v177JointPose(kind,{requestedState:state,clipProgress:phase},{locomotionPhase:phase,locomotionSettle:settle});
   assert.ok(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,0,0,atlas.referenceFrame?.width??480,atlas.referenceFrame?.height??448));
   hash.update(JSON.stringify([kind,state,phase,settle,trace]));poses++;
  }
 }
 return {sha256:hash.digest('hex'),forms:kinds.length,poses,paintCalls,precision:1e-6};
}
