import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from '../../app/v177JointPresentation.js';
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
