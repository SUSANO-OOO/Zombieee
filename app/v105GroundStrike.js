import {V105_GROUND_STRIKES} from './v105GroundStrikeData.js';
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const mul=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const rigid=(p,t,a)=>{const c=Math.cos(a),s=Math.sin(a);return[c,s,-s,c,t[0]-c*p[0]+s*p[1],t[1]-s*p[0]-c*p[1]];};
const identity=()=>[1,0,0,1,0,0];
function keyAt(keys,p){
 for(let i=1;i<keys.length;i++)if(p<=keys[i][0]){
  const a=keys[i-1],b=keys[i],q=Math.max(0,Math.min(1,(p-a[0])/(b[0]-a[0]))),t=q*q*(3-2*q);
  return a.slice(1).map((x,j)=>x+(b[j+1]-x)*t);
 }
 return keys.at(-1).slice(1);
}
function handWithin(discs,preferred,ceiling,contact){
 const valid=([x,y])=>y<=ceiling+1e-7&&(!contact||Math.abs(y-ceiling)<1e-6)
  &&discs.every(c=>{const d=Math.hypot(x-c.x,y-c.y);return d>=c.min-1e-6&&d<=c.max+1e-6;});
 const candidates=[preferred,[preferred[0],ceiling]];
 for(const c of discs)for(const r of [c.min,c.max]){
  const dx=preferred[0]-c.x,dy=preferred[1]-c.y,d=Math.hypot(dx,dy);
  if(d)candidates.push([c.x+dx*r/d,c.y+dy*r/d]);
  const h2=r*r-(ceiling-c.y)**2;
  if(h2>=0){const h=Math.sqrt(h2);candidates.push([c.x-h,ceiling],[c.x+h,ceiling]);}
 }
 for(let i=0;i<discs.length;i++)for(let j=i+1;j<discs.length;j++){
  const a=discs[i],b=discs[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(!d)continue;
  for(const r of [a.min,a.max])for(const s of [b.min,b.max]){
   if(d>r+s+1e-7||d<Math.abs(r-s)-1e-7)continue;
   const along=(r*r-s*s+d*d)/(2*d),h=Math.sqrt(Math.max(0,r*r-along*along)),x=a.x+dx/d*along,y=a.y+dy/d*along;
   candidates.push([x-dy/d*h,y+dx/d*h],[x+dy/d*h,y-dx/d*h]);
  }
 }
 return candidates.filter(valid).sort((a,b)=>Math.hypot(a[0]-preferred[0],a[1]-preferred[1])-Math.hypot(b[0]-preferred[0],b[1]-preferred[1]))[0];
}

// Resolve the whole original held weapon and both arms above the actual boot
// floor. Contact comes from painted alpha, never from replacing a muzzle's Y.
export function v105GroundStrikePlan(kind,atlas,plan,capture){
 const data=V105_GROUND_STRIKES[kind],p=plan.attackPhase;
 if(!data||plan.groundStrikeApplied||!plan.bipedFeet||!['ground-slam','slam'].includes(plan.abilityPresentation)
   ||!Number.isFinite(p)||p<=0||p>=1)return plan;
 const floor=Math.max(...data.soles.flatMap(s=>s.hull.map(v=>point(capture.lower[s.bone],v)[1])));
 const [body,requestedDrop,angle,hx,hy]=keyAt(data.keys,p),base=atlas.poses[atlas.lowerCount-atlas.frameCount];
 const waist=atlas.interpolationPivots.spine,ground=plan.groundedMotion.lower;
 const primary=atlas.armConstraints.find(c=>c.effectorBone===atlas.weaponBone),pivot=primary.effectorWrist??primary.wrist;
 const cs=Math.cos(angle),sn=Math.sin(angle),rot=q=>[cs*(q[0]-pivot[0])-sn*(q[1]-pivot[1]),sn*(q[0]-pivot[0])+cs*(q[1]-pivot[1])];
 const bottom=Math.max(...data.weaponHull.map(q=>rot(q)[1])),ceiling=floor-bottom,contact=p>=.28-1e-8&&p<=.55+1e-8;
 let drop=requestedDrop,result;
 for(let attempt=0;attempt<(contact?12:1);attempt++,drop+=2){
  const lower=[...ground];lower[5]+=drop;
  if(atlas.legConstraints.some(l=>{
   const hip=point(mul(lower,base[l.parentBone]),l.hip),foot=point(capture.lower[l.effectorBone],l.ankle),d=Math.hypot(hip[0]-foot[0],hip[1]-foot[1]);
   const a=Math.hypot(l.knee[0]-l.hip[0],l.knee[1]-l.hip[1]),b=Math.hypot(l.ankle[0]-l.knee[0],l.ankle[1]-l.knee[1]);
   return d>a+b-.001||d<Math.abs(a-b)+2;
  }))continue;
  const home=point(ground,waist),torso=rigid(waist,[home[0],home[1]+drop],body);
  const upper=Object.fromEntries(Object.entries(base).map(([bone,m])=>[bone,mul(torso,m)]));
  const discs=atlas.armConstraints.map(c=>{
   const s=point(upper[c.parentBone],c.shoulder),offset=rot(c.effectorWrist??c.wrist);
   const a=Math.hypot(c.elbow[0]-c.shoulder[0],c.elbow[1]-c.shoulder[1]),b=Math.hypot(c.wrist[0]-c.elbow[0],c.wrist[1]-c.elbow[1]);
   return{x:s[0]-offset[0],y:s[1]-offset[1],min:Math.abs(a-b)+2,max:a+b-2};
  });
  const hand=handWithin(discs,[hx+ground[4],hy+ground[5]+drop],ceiling,contact);
  if(hand){upper[atlas.weaponBone]=rigid(pivot,hand,angle);result={lower,upper};break;}
 }
 if(!result)return plan;
 const weapon=result.upper[atlas.weaponBone];
 const sourcePoint=data.weaponHull.reduce((a,b)=>point(weapon,a)[1]>point(weapon,b)[1]?a:b);
 const gap=floor-point(weapon,sourcePoint)[1];
 return {...plan,groundStrikeApplied:true,groundStrikeSourceMotion:plan.groundedMotion,groundStrike:{sourcePoint,sourceBone:atlas.weaponBone,floor,gap,contactReady:contact&&Math.abs(gap)<.01},
  groundedMotion:{...plan.groundedMotion,lower:result.lower,upper:identity()},
  choreography:{...plan.choreography,upper:result.upper,stepDistance:0}};
}
