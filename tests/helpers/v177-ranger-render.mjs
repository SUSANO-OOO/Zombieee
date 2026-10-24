import {V177_JOINT_ATLASES,drawV177JointPose} from '../../app/v177JointPresentation.js';

export const rangerPoint = (m,[x,y]) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const multiply = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],
  a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];

export function traceRangerPose(plan,{actor,x=0,y=0,width=480,height=448}={}) {
  const calls=[],stack=[];let matrix=[1,0,0,1,0,0];
  const ctx={save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
    translate(x,y){matrix=multiply(matrix,[1,0,0,1,x,y]);},scale(x,y){matrix=multiply(matrix,[x,0,0,y,0,0]);},
    transform(...m){matrix=multiply(matrix,m);},drawImage(_image,...rects){calls.push({rects,matrix:[...matrix]});}};
  const painted=drawV177JointPose(ctx,{naturalWidth:V177_JOINT_ATLASES.ranger.decodedWidth},'ranger',plan,x,y,width,height,{actor});
  return {painted,calls};
}
