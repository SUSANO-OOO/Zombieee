import sharp from 'sharp';
import {V177_JOINT_ATLASES, v177JointPose, v177CaptureJointPose} from '../app/v177JointPresentation.js';

// Measure painted anatomy, never the lateral reach of a weapon or shield.
export async function measurePantherBody(kind) {
  const atlas=V177_JOINT_ATLASES[kind];
  const plan=v177JointPose(kind,{requestedState:'idle'},{locomotionPhase:0,locomotionSettle:0});
  const pose=v177CaptureJointPose(kind,plan);
  const {data,info}=await sharp('public'+atlas.path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let top=Infinity,sole=-Infinity;
  const parts=atlas.parts.filter(p=>p.bone==='head'||p.name.endsWith('boot'));
  for(const part of parts) {
    const s=part.source,d=part.destination,m=(part.upper?pose.upper:pose.lower)[part.bone];
    for(let y=0;y<s.h;y++)for(let x=0;x<s.w;x++) {
      if(data[((s.y+y)*info.width+s.x+x)*4+3]<8)continue;
      for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]) {
        const py=m[1]*(d.x+(x+dx)*d.w/s.w)+m[3]*(d.y+(y+dy)*d.h/s.h)+m[5];
        top=Math.min(top,py);sole=Math.max(sole,py);
      }
    }
  }
  return {top,sole,height:sole-top,parts:parts.map(p=>p.name)};
}
