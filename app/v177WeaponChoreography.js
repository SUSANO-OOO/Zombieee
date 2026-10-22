// Source pixels and fixed-length limbs share one weapon transform. These are
// visual keys, sampled on the existing attack/ability clocks; no hit is added.
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const p=clamp(v);return p*p*(3-2*p);};
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const rigid=(pivot,target,angle)=>{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,target[0]-c*pivot[0]+s*pivot[1],target[1]-s*pivot[0]-c*pivot[1]];};
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function keys(p,rows){for(let i=1;i<rows.length;i++)if(p<=rows[i][0]){const a=rows[i-1],b=rows[i],t=ease((p-a[0])/(b[0]-a[0]));return a.slice(1).map((x,j)=>x+(b[j+1]-x)*t);}return rows.at(-1).slice(1);}
const kinds=new Set(['tky','miyamoto-musashi','crazy-king','kumaverson','takuya','takuya-omega','babayaga']);
const carryPlans=new WeakMap();

// Project a wrist onto its fixed-length arm annulus and the weapon's floor
// half-plane together. Alternating the two projections can push a large
// downward blade back inside the elbow's minimum reach on its final pass.
function groundedHand(target,shoulder,min,max,ceiling){
 const desired=[target[0]-shoulder[0],target[1]-shoulder[1]],cap=ceiling-shoulder[1];
 if(cap < -max)throw Error('Held weapon has no fixed-length reach above its floor');
 let [x,y]=desired;y=Math.min(y,cap);
 let length=Math.hypot(x,y);
 if(length>max){
  x*=max/length;y*=max/length;
  if(y>cap){y=cap;x=(desired[0]<0?-1:1)*Math.sqrt(Math.max(0,max*max-y*y));}
 }
 length=Math.hypot(x,y);
 if(length<min){
  const scale=length?min/length:0,rx=length?x*scale:min,ry=y*scale;
  if(ry<=cap){x=rx;y=ry;}
  else{y=cap;x=(desired[0]<0?-1:1)*Math.sqrt(Math.max(0,min*min-y*y));}
 }
 return[x+shoulder[0],y+shoulder[1]];
}

function constrainOmegaWeapon(atlas,upper,ground=[1,0,0,1,0,0]){
 const m=upper[atlas.weaponBone],c=atlas.armConstraints.find(c=>c.effectorBone===atlas.weaponBone),wrist=c.effectorWrist??c.wrist;
 const final=multiply(ground,m),s=point(ground,point(upper[c.parentBone],c.shoulder)),t=point(final,wrist);
 const a=Math.hypot(c.elbow[0]-c.shoulder[0],c.elbow[1]-c.shoulder[1]),b=Math.hypot(c.wrist[0]-c.elbow[0],c.wrist[1]-c.elbow[1]);
 let bottom=-Infinity;for(const [x,y]of atlas.weaponHull)bottom=Math.max(bottom,final[1]*(x-wrist[0])+final[3]*(y-wrist[1]));
 const hand=groundedHand(t,s,Math.abs(a-b)+2,a+b-2,atlas.weaponFloorY-bottom),dx=hand[0]-t[0],dy=hand[1]-t[1];
 // The grounded torso is a rigid transform. Return the wrist translation to
 // its local space so paint, grip IK and weapon sockets keep one owner.
 m[4]+=ground[0]*dx+ground[1]*dy;m[5]+=ground[2]*dx+ground[3]*dy;
}

export function v177GroundedWeaponChoreography(kind,atlas,plan){
 if(kind!=='takuya-omega'||!atlas.weaponHull||!plan.choreography||!plan.groundedMotion)return plan;
 const upper={...plan.choreography.upper,[atlas.weaponBone]:[...plan.choreography.upper[atlas.weaponBone]]};
 constrainOmegaWeapon(atlas,upper,plan.groundedMotion.upper);
 return{...plan,choreography:{...plan.choreography,upper}};
}

export function v177WeaponChoreography(kind,atlas,plan,actor={}){
 if(!kinds.has(kind)||plan.resolvedJointPose||plan.liveStun||plan.turnedGetup)return plan;
 const attacking=Number.isFinite(plan.attackPhase),p=attacking?plan.attackPhase:0;
 if(!attacking&&!['crazy-king','babayaga','takuya-omega','kumaverson'].includes(kind))return plan;
 if(!attacking&&carryPlans.has(atlas))return{...plan,choreography:carryPlans.get(atlas),upperOffsetY:0};
 // Sequence commits at impact. Windup uses the upcoming sequence, while
 // active/recovery use the committed one, so the cut cannot change mid-swing.
 const sequence=Math.max(0,(Number(actor.attackSequence)||0)-(actor.attackWindup>0?0:1));
 const variant=sequence%(kind==='miyamoto-musashi'?3:2);
 const base=atlas.poses[atlas.lowerCount-atlas.frameCount],upper={};
 const waist=atlas.interpolationPivots?.spine??[240,250];
 const weight=attacking?keys(p,[[0,0],[.21,-1],[.28,1],[.5,.65],[1,0]])[0]:0;
 const torso=rigid(waist,waist,(kind==='crazy-king'?.2:kind==='takuya-omega'?-.12:.08)*weight);
 for(const [bone,m]of Object.entries(base)){
  const pivot=atlas.interpolationPivots?.[bone]??[0,0];
  upper[bone]=multiply(torso,rigid(pivot,point(m,pivot),Math.atan2(m[1],m[0])));
 }
 const arms=atlas.armConstraints.map(c=>({...c})),weaponOwners=[...arms];
 const primary=arms.find(c=>c.effectorBone===atlas.weaponBone),pivot=primary.effectorWrist??primary.wrist;
 const rest=point(base[atlas.weaponBone],pivot),restAngle=Math.atan2(base[atlas.weaponBone][1],base[atlas.weaponBone][0]);
 const envelope=attacking?Math.min(ease(p/.12),ease((1-p)/.22)):0;
 let angle=restAngle,target=[...rest];
 if(kind==='crazy-king'){
  const a=attacking?keys(p,[[0,0],[.20,-1.35],[.28,.7],[.45,1.65],[1,0]])[0]:0;
  const center=[180,232],goal=[218+weight*4,188+Math.abs(weight)*2];
  upper['weapon-0']=multiply(torso,rigid(center,goal,a));
  weaponOwners.push({...arms[1],effectorBone:'weapon-0',effectorWrist:[195,253]});
  const hand=point(upper['weapon-0'],[195,253]);
  upper['arm-1-hand']=rigid(arms[1].wrist,hand,a);
 }else{
  if(kind==='kumaverson'){
   const [dx,dy,da]=keys(p,[[0,0,0,0],[.20,50,-94,-1.5],[.28,73,-34,.65],[.48,62,-10,1.0],[1,0,0,0]]);
   target=[rest[0]+dx,rest[1]+dy];angle+=da;
  }else if(kind==='takuya-omega'){
   const [dx,dy,da]=keys(p,[[0,0,0,0],[.20,18,-50,-1.15],[.28,52,-65,.15],[.48,44,-148,.6],[1,0,0,0]]);
   target=[rest[0]+dx,rest[1]+dy];angle+=da;
  }else if(kind==='takuya'){
   const [dx,dy,da]=keys(p,[[0,0,0,0],[.2,-8,-55,-.8],[.28,-30,35,.6],[.48,-25,50,.9],[1,0,0,0]]);
   target=[rest[0]+dx,rest[1]+dy];angle+=da;
  }else if(kind==='babayaga'){
   // Keep both forearms in front of the coat silhouette by actually holding
   // the pistol forward. Its bore stays level while the torso takes recoil.
   const recoil=attacking?keys(p,[[0,0],[.27,0],[.31,-5],[.43,0],[1,0]])[0]:0;
   target=[rest[0]+45+envelope*4+recoil,rest[1]-25-envelope*2];
   angle=0;
  }else{
   const reverse=variant===1;
   const da=keys(p,[[0,0],[.20,reverse?.95:-1.65],[.28,reverse?-.55:.3],[.48,reverse?-1.2:1.0],[1,0]])[0];
   angle+=da;target=[rest[0]+envelope*(kind==='tky'?30:20),rest[1]-envelope*35];
  }
  upper[atlas.weaponBone]=kind==='babayaga'?rigid(pivot,point(torso,target),angle):multiply(torso,rigid(pivot,target,angle));
  if(kind==='miyamoto-musashi'){
   const c=arms[1],r=point(base['weapon-1'],c.effectorWrist??c.wrist),a=Math.atan2(base['weapon-1'][1],base['weapon-1'][0]);
   const da=keys(p,[[0,0],[.2,variant===2?-1.3:.65],[.28,variant===2?.4:-.9],[.5,variant===2?1:-1.4],[1,0]])[0];
   upper['weapon-1']=multiply(torso,rigid(c.effectorWrist??c.wrist,[r[0]+envelope*7,r[1]-envelope*25],a+da));
  }
 }
 // Keep both original bone lengths. Move the whole held weapon by the
 // smallest translation that puts every hand in its shoulder's reachable disc.
 for(const weapon of new Set(weaponOwners.filter(c=>c.effectorBone.startsWith('weapon')).map(c=>c.effectorBone))){
  const m=upper[weapon],owners=weaponOwners.filter(c=>c.effectorBone===weapon);
  if(kind==='takuya-omega'&&atlas.weaponHull&&owners.length===1){
   constrainOmegaWeapon(atlas,upper);
   continue;
  }
  for(let pass=0;pass<12;pass++){
   let moved=false;
   for(const c of owners){
   const s=point(upper[c.parentBone],c.shoulder),t=point(m,c.effectorWrist??c.wrist),dx=t[0]-s[0],dy=t[1]-s[1],d=Math.hypot(dx,dy);
   const a=Math.hypot(c.elbow[0]-c.shoulder[0],c.elbow[1]-c.shoulder[1]),b=Math.hypot(c.wrist[0]-c.elbow[0],c.wrist[1]-c.elbow[1]);
   const goal=Math.max(Math.abs(a-b)+2,Math.min(a+b-2,d));
   if(d>0&&Math.abs(goal-d)>1e-7){m[4]+=dx*(goal/d-1);m[5]+=dy*(goal/d-1);moved=true;}
   }
   if(!moved)break;
  }
 }
 if(kind==='crazy-king'){
  const m=upper['weapon-0'],hand=point(m,[195,253]);
  upper['arm-1-hand']=rigid(arms[1].wrist,hand,Math.atan2(m[1],m[0]));
 }
 const choreography={kind,variant,sequence,upper,arms};if(!attacking)carryPlans.set(atlas,choreography);
 return{...plan,choreography,upperOffsetY:0};
}

export function v177ChoreographedAbilitySample(kind,ability,base,{anomaly,kurome}={}){
 let state,duration;
 if(anomaly&&['warning','active','recovery'].includes(ability?.phase)){
  state={warning:'wind-up',active:'active',recovery:'recovery'}[ability.phase];duration=anomaly[ability.phase==='warning'?'warningSeconds':ability.phase==='active'?'activeSeconds':'recoverySeconds'];
 }else if(kind==='kurome'&&['tracking','locked','firing','recovery'].includes(ability?.phase)){
  state=ability.phase==='firing'?'active':ability.phase==='recovery'?'recovery':'wind-up';
  duration=kurome[state==='active'?'fireSeconds':state==='recovery'?'recoverySeconds':'warningSeconds'];
 }
 if(!state||!(duration>0)||!Number.isFinite(ability.remainingSeconds))return null;
 return{...base,requestedState:state,clipProgress:clamp(1-ability.remainingSeconds/duration),movement:false};
}
