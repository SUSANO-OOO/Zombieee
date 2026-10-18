// Follow the existing normal-shot phases. The waist stays on its source pelvis;
// shoulders, both hands and the weapon receive one common rigid transform.
const waists={medic:[240,193],engineer:[235,203]};
const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*smooth(t);

export function v177FirearmUpperMotion(kind,sample,spine) {
  if(kind!=='medic'&&kind!=='engineer')return null;
  const p=Math.max(0,Math.min(1,Number(sample?.clipProgress)||0));
  const support=kind==='medic',ready=support ? .014 : .018,
    kick=support?-.055:-.065,release=support?-.02:-.025;
  let angle;
  switch(sample?.requestedState){
    case 'wind-up':if(p===0)return null;angle=mix(0,ready,p);break;
    case 'active':angle=p<.3?mix(ready,kick,p/.3):mix(kick,release,(p-.3)/.7);break;
    case 'recovery':if(p===1)return null;angle=mix(release,0,p);break;
    default:return null;
  }
  const [wx,wy]=waists[kind],x=spine[0]*wx+spine[2]*wy+spine[4],
    y=spine[1]*wx+spine[3]*wy+spine[5],c=Math.cos(angle),s=Math.sin(angle);
  return [c,s,-s,c,x-c*x+s*y,y-s*x-c*y];
}

export function applyV177FirearmUpperMotion(out,t) {
  const a=out[0],b=out[1],c=out[2],d=out[3],x=out[4],y=out[5];
  out[0]=t[0]*a+t[2]*b;out[1]=t[1]*a+t[3]*b;
  out[2]=t[0]*c+t[2]*d;out[3]=t[1]*c+t[3]*d;
  out[4]=t[0]*x+t[2]*y+t[4];out[5]=t[1]*x+t[3]*y+t[5];
  return out;
}
