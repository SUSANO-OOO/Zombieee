// Source pixels and fixed-length limbs share one weapon transform. These are
// visual keys, sampled on the existing attack/ability clocks; no hit is added.
const clamp=v=>Math.max(0,Math.min(1,v));
const ease=v=>{const p=clamp(v);return p*p*(3-2*p);};
const point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
const rigid=(pivot,target,angle)=>{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,target[0]-c*pivot[0]+s*pivot[1],target[1]-s*pivot[0]-c*pivot[1]];};
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
function keys(p,rows){for(let i=1;i<rows.length;i++)if(p<=rows[i][0]){const a=rows[i-1],b=rows[i],t=ease((p-a[0])/(b[0]-a[0]));return a.slice(1).map((x,j)=>x+(b[j+1]-x)*t);}return rows.at(-1).slice(1);}
const contactKinds=new Set(['brawler','shade','walker','runner','turned','sprinter','grappler','crusher','abomination',
 'gairen','mugarian-president-mutated','futago','futago-separated-a','futago-separated-b']);
const swingKinds=new Set(['scout','brute','guardian','gate-eater','red-panther-shield','red-panther-knife','tky','miyamoto-musashi','crazy-king','kumaverson','takuya','takuya-omega','zakimiya']);
const kinds=new Set(['babayaga',...swingKinds,...contactKinds]);
const carryPlans=new WeakMap();
const carryMotion={
 // Paisen's far fist shares the leg-0 side. Counter-swing it against that
 // leg, while the near free hand balances in the opposite direction.
 brawler:{weapon:18,lift:4,roll:.028,free:28,phaseOffset:.5},
 'crazy-king':{weapon:5,lift:2,roll:.018,free:8},
 babayaga:{weapon:9,lift:2,roll:.018,free:18,phaseOffset:.5},
 'takuya-omega':{weapon:4,lift:2,roll:.012,free:10},
 // The adopted full-body master owns the neck, collar and shoulder pose.
 kumaverson:{weapon:12,lift:3,roll:.02,free:20},
};

function walkingCarry(kind,atlas,plan,carry,blend=1){
 const profile=carryMotion[kind];
 if(!profile)return carry;
 const amount=(1-clamp(plan.paintLocomotion?.settle??1))*blend;
 if(amount<=0)return carry;
 const phase=((plan.paintLocomotion?.phase??plan.phase??0)+(profile.phaseOffset??0))*2*Math.PI;
 const sway=Math.sin(phase)*amount,lift=(1-Math.cos(phase*2))*amount;
 const waist=atlas.interpolationPivots?.spine??[240,250];
 const chest=rigid(waist,waist,profile.roll*sway);
 const upper=Object.fromEntries(Object.entries(carry.upper).map(([bone,m])=>[bone,multiply(chest,m)]));
 // A shared weapon owns both grips. Free hands counterbalance independently;
 // the existing IK and ground constraints still own actual elbows and soles.
 for(const weapon of new Set(carry.arms.filter(c=>c.effectorBone.startsWith('weapon')).map(c=>c.effectorBone))){
  const owners=carry.arms.filter(c=>c.effectorBone===weapon),c=owners[0],wrist=c.effectorWrist??c.wrist;
  const m=upper[weapon],home=point(m,wrist);
  upper[weapon]=rigid(wrist,[home[0]+profile.weapon*sway,home[1]-profile.lift*lift],Math.atan2(m[1],m[0]));
  constrainHeldWeapon(upper,weapon,owners);
 }
 for(const c of carry.arms.filter(c=>!c.effectorBone.startsWith('weapon'))){
  const m=upper[c.effectorBone],home=point(m,c.effectorWrist??c.wrist);
  handPose(upper,c,[home[0]-profile.free*sway,home[1]-profile.lift*lift],Math.atan2(m[1],m[0]));
 }
 if(kind==='crazy-king'){
  const m=upper['weapon-0'];
  upper['arm-1-hand']=rigid(carry.arms[1].wrist,point(m,[195,253]),Math.atan2(m[1],m[0]));
 }
 return{...carry,upper,walkingCarry:true};
}
// Source-pixel travel, performed by alternating planted feet. Short weapons
// need a real body step to bridge their gameplay engagement distance.
const attackSteps={kumaverson:100,brute:24,guardian:60,'gate-eater':55,'red-panther-shield':45,scout:30,'red-panther-knife':40,
 brawler:60,shade:60,walker:60,runner:60,turned:60,sprinter:60,grappler:35,crusher:25,abomination:25,
 'futago-separated-a':24,'futago-separated-b':24,'mugarian-president-mutated':140};

// Project a wrist onto its fixed-length arm annulus and the weapon's floor
// half-plane together. Alternating the two projections can push a large
// downward blade back inside the elbow's minimum reach on its final pass.
function groundedHand(target,shoulder,min,max,ceiling,base=-Infinity){
 const lo=Math.max(base-shoulder[1],-max),hi=Math.min(ceiling-shoulder[1],max);
 if(lo>hi)throw Error('Held weapon has no fixed-length reach inside its vertical strip');
 const dx=target[0]-shoulder[0];
 let x=dx,y=Math.max(lo,Math.min(hi,target[1]-shoulder[1]));
 let length=Math.hypot(x,y);
 if(length>max){
  x*=max/length;y*=max/length;
  if(y<lo||y>hi){y=Math.max(lo,Math.min(hi,y));x=(dx<0?-1:1)*Math.sqrt(Math.max(0,max*max-y*y));}
 }
 length=Math.hypot(x,y);
 if(length<min){
  const scale=length?min/length:0,rx=length?x*scale:min,ry=y*scale;
  if(ry>=lo&&ry<=hi){x=rx;y=ry;}
  else{y=Math.max(lo,Math.min(hi,ry));x=(dx<0?-1:1)*Math.sqrt(Math.max(0,min*min-y*y));}
 }
 return[x+shoulder[0],y+shoulder[1]];
}

function constrainOmegaWeapon(atlas,upper,ground=[1,0,0,1,0,0],topGuard=-Infinity){
 const m=upper[atlas.weaponBone],c=atlas.armConstraints.find(c=>c.effectorBone===atlas.weaponBone),wrist=c.effectorWrist??c.wrist;
 const final=multiply(ground,m),s=point(ground,point(upper[c.parentBone],c.shoulder)),t=point(final,wrist);
 const a=Math.hypot(c.elbow[0]-c.shoulder[0],c.elbow[1]-c.shoulder[1]),b=Math.hypot(c.wrist[0]-c.elbow[0],c.wrist[1]-c.elbow[1]);
 let top=Infinity,bottom=-Infinity;for(const [x,y]of atlas.weaponHull){
  const offset=final[1]*(x-wrist[0])+final[3]*(y-wrist[1]);top=Math.min(top,offset);bottom=Math.max(bottom,offset);
 }
 const hand=groundedHand(t,s,Math.abs(a-b)+2,a+b-2,atlas.weaponFloorY-bottom,topGuard-top),dx=hand[0]-t[0],dy=hand[1]-t[1];
 // The grounded torso is a rigid transform. Return the wrist translation to
 // its local space so paint, grip IK and weapon sockets keep one owner.
 m[4]+=ground[0]*dx+ground[1]*dy;m[5]+=ground[2]*dx+ground[3]*dy;
}

export function v177GroundedWeaponChoreography(kind,atlas,plan,soleFloor){
 if(kind==='mugarian-president-mutated'&&plan.choreography&&plan.groundedMotion&&Number.isFinite(soleFloor)){
  const bone='weapon-0',c=atlas.armConstraints.find(c=>c.effectorBone===bone),wrist=c.effectorWrist??c.wrist;
  const source=plan.choreography.groundedCaneSource??plan.choreography.upper[bone],ground=plan.groundedMotion.upper;
  const shoulder=point(ground,point(plan.choreography.upper[c.parentBone],c.shoulder)),target=point(multiply(ground,source),wrist);
  // Keep the complete cane upright while the torso bends. Its own original
  // hand/arm reaches the same floor as the painted soles; it cannot push the
  // whole actor upward through the later live-ground correction.
  const base=atlas.poses[atlas.lowerCount-atlas.frameCount][bone],angle=Math.atan2(base[1],base[0]);
  const d=atlas.parts.find(p=>p.bone===bone).destination,cs=Math.cos(angle),sn=Math.sin(angle);
  const bottom=Math.max(...[[d.x,d.y],[d.x+d.w,d.y],[d.x,d.y+d.h],[d.x+d.w,d.y+d.h]]
   .map(([x,y])=>sn*(x-wrist[0])+cs*(y-wrist[1])));
  const reach=armReach(c),hand=groundedHand(target,shoulder,reach.min,reach.max,soleFloor-bottom);
  const inverse=[ground[0],ground[2],ground[1],ground[3],
   -ground[0]*ground[4]-ground[1]*ground[5],-ground[2]*ground[4]-ground[3]*ground[5]];
  const upper={...plan.choreography.upper,[bone]:multiply(inverse,rigid(wrist,hand,angle))};
  return{...plan,choreography:{...plan.choreography,upper,groundedCaneSource:[...source]}};
 }
 if(kind!=='takuya-omega'||!atlas.weaponHull||!plan.choreography||!plan.groundedMotion)return plan;
 // Recoil can re-resolve a held paint on several successive frames. Project
 // the same authored weapon each time, rather than accumulating the previous
 // floor/reach correction and then snapping back when the return regenerates it.
 const source=plan.choreography.groundedWeaponSource??plan.choreography.upper[atlas.weaponBone];
 const upper={...plan.choreography.upper,[atlas.weaponBone]:[...source]};
 // The full unchanged blade stays above its floor and below the upper scene
 // margin. Its hand still lies inside the original arm's reach annulus.
 constrainOmegaWeapon(atlas,upper,plan.groundedMotion.upper,-130);
 return{...plan,choreography:{...plan.choreography,upper,groundedWeaponSource:[...source]}};
}

function armReach(c,margin=2){
 const a=Math.hypot(c.elbow[0]-c.shoulder[0],c.elbow[1]-c.shoulder[1]),b=Math.hypot(c.wrist[0]-c.elbow[0],c.wrist[1]-c.elbow[1]);
 return{min:Math.abs(a-b)+margin,max:a+b-margin};
}
function handPose(upper,c,target,angle,margin=2){
 const s=point(upper[c.parentBone],c.shoulder),r=armReach(c,margin),dx=target[0]-s[0],dy=target[1]-s[1],d=Math.hypot(dx,dy);
 const radius=Math.max(r.min,Math.min(r.max,d)),t=d?[s[0]+dx*radius/d,s[1]+dy*radius/d]:[s[0]+radius,s[1]];
 upper[c.effectorBone]=rigid(c.effectorWrist??c.wrist,t,angle);
}
const nearAngle=(angle,reference)=>reference+Math.atan2(Math.sin(angle-reference),Math.cos(angle-reference));
function swingAngle(p,rest,wind,hit,follow,overhead=false){
 if(!overhead)wind=nearAngle(wind,rest);hit=nearAngle(hit,wind);follow=nearAngle(follow,hit);
 return keys(p,[[0,rest],[.18,wind],[.23,wind],[.28,hit],[.48,follow],[.64,follow],[1,nearAngle(rest,follow)]])[0];
}
function shoulderTarget(c,p,rest,rows){
 const [dx,dy]=keys(p,[[0,rest[0]-c.shoulder[0],rest[1]-c.shoulder[1]],...rows,[1,rest[0]-c.shoulder[0],rest[1]-c.shoulder[1]]]);
 return[c.shoulder[0]+dx,c.shoulder[1]+dy];
}
function constrainHeldWeapon(upper,weapon,owners,margin=2){
 const m=upper[weapon],chains=owners.map(c=>({c,...armReach(c,margin),shoulder:point(upper[c.parentBone],c.shoulder),wrist:c.effectorWrist??c.wrist}));
 if(chains.length===2){
  const [a,b]=chains,sx=b.shoulder[0]-a.shoulder[0],sy=b.shoulder[1]-a.shoulder[1],gx=b.wrist[0]-a.wrist[0],gy=b.wrist[1]-a.wrist[1];
  const span=Math.hypot(sx,sy),grip=Math.hypot(gx,gy),reach=a.max+b.max-.00001;
  if(span>0&&grip>0){
   const cosine=(span*span+grip*grip-reach*reach)/(2*span*grip);
   if(cosine>-1){
    const center=Math.atan2(sy,sx)-Math.atan2(gy,gx),angle=nearAngle(Math.atan2(m[1],m[0]),center),limit=Math.acos(Math.min(1,cosine));
    const bounded=Math.max(center-limit,Math.min(center+limit,angle));
    if(Math.abs(bounded-angle)>1e-10)m.splice(0,6,...rigid(a.wrist,point(m,a.wrist),bounded));
   }
  }
 }
 const discs=chains.map(c=>{const t=point(m,c.wrist);return{...c,x:c.shoulder[0]-t[0],y:c.shoulder[1]-t[1]};});
 const valid=([x,y])=>discs.every(c=>{const d=Math.hypot(x-c.x,y-c.y);return d>=c.min-1e-7&&d<=c.max+1e-7;});
 if(valid([0,0]))return;
 const candidates=[];
 for(const c of discs)for(const r of [c.min,c.max]){
  const d=Math.hypot(c.x,c.y);candidates.push(d?[c.x-c.x*r/d,c.y-c.y*r/d]:[c.x+r,c.y]);
 }
 for(let i=0;i<discs.length;i++)for(let j=i+1;j<discs.length;j++){
  const a=discs[i],b=discs[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(!d)continue;
  for(const r of [a.min,a.max])for(const s of [b.min,b.max]){
   if(d>r+s+1e-7||d<Math.abs(r-s)-1e-7)continue;
   const along=(r*r-s*s+d*d)/(2*d),h=Math.sqrt(Math.max(0,r*r-along*along)),x=a.x+dx/d*along,y=a.y+dy/d*along;
   candidates.push([x-dy/d*h,y+dx/d*h],[x+dy/d*h,y-dx/d*h]);
  }
 }
 const nearest=candidates.filter(valid).sort((a,b)=>Math.hypot(...a)-Math.hypot(...b))[0];
 if(nearest){m[4]+=nearest[0];m[5]+=nearest[1];}
}

export function v177WeaponChoreography(kind,atlas,plan,actor={}){
 if(!kinds.has(kind)||plan.resolvedJointPose||plan.liveStun||plan.turnedGetup)return plan;
 const attacking=Number.isFinite(plan.attackPhase),p=attacking?plan.attackPhase:0;
 const envelope=attacking?Math.min(ease(p/.08),ease((1-p)/.16)):0;
 if(!attacking&&!carryMotion[kind])return plan;
 if(!attacking&&kind==='brawler'&&(plan.paintLocomotion?.settle??1)>=1)return plan;
 if(!attacking&&carryPlans.has(atlas))return{...plan,choreography:walkingCarry(kind,atlas,plan,carryPlans.get(atlas)),upperOffsetY:0};
 // Sequence commits at impact. Windup uses the upcoming sequence, while
 // active/recovery use the committed one, so the cut cannot change mid-swing.
 const sequence=Math.max(0,(Number(actor.attackSequence)||0)-(actor.attackWindup>0?0:1));
 const variant=sequence%(kind==='miyamoto-musashi'?3:2);
 const base=atlas.poses[atlas.lowerCount-atlas.frameCount],upper={};
 const legs=atlas.legConstraints??[];
 const waist=atlas.interpolationPivots?.spine??(legs.length?[legs.reduce((s,c)=>s+c.hip[0],0)/legs.length,legs.reduce((s,c)=>s+c.hip[1],0)/legs.length]:[240,250]);
 const weight=attacking?keys(p,[[0,0],[.18,-1],[.23,-1],[.28,.8],[.48,1],[.64,.8],[1,0]])[0]:0;
 const heavy=['brute','guardian','gate-eater','red-panther-shield','crazy-king','kumaverson','takuya','takuya-omega','crusher','abomination','gairen'].includes(kind);
 // Kuma raises the bowl over his crown, then folds forward into the slam.
 // The planted legs and original arm lengths still own the whole movement.
 const bodyAngle=kind==='kumaverson'?keys(p,[[0,0],[.18,.10],[.23,.10],[.28,.27],[.48,.42],[.64,.35],[1,0]])[0]:kind==='babayaga'?0:(kind==='brute'?.70:kind==='mugarian-president-mutated'?.50:heavy?.21:.17)*weight;
 const torso=rigid(waist,[waist[0]+weight*(heavy?13:9),waist[1]+Math.abs(weight)*(kind==='mugarian-president-mutated'?30:heavy?5:3)],bodyAngle);
 for(const [bone,m]of Object.entries(base)){
  const pivot=atlas.interpolationPivots?.[bone]??[0,0];
  upper[bone]=multiply(torso,rigid(pivot,point(m,pivot),Math.atan2(m[1],m[0])));
 }
 const arms=atlas.armConstraints.map(c=>({...c}));
 if(kind==='babayaga'){
  // His original source owns one pistol hand. The other arm must have its
  // own wrist; forcing both elbows onto that one hand folds the support arm.
  const free=arms[1];free.effectorBone='arm-1-hand';
  free.effectorWrist=free.wrist;free.grip=free.wrist;free.bendSign=1;
  handPose(upper,free,point(upper[free.parentBone],free.wrist),bodyAngle);
 }
 const weaponOwners=[...arms];
 const strikeBones=contactKinds.has(kind)?[]:kind==='miyamoto-musashi'?['weapon-0','weapon-1']:[atlas.weaponBone];
 const primary=arms.find(c=>c.effectorBone===atlas.weaponBone),pivot=primary.effectorWrist??primary.wrist;
 const rest=point(base[atlas.weaponBone],pivot),restAngle=Math.atan2(base[atlas.weaponBone][1],base[atlas.weaponBone][0]);
 let angle=restAngle,target=[...rest];
 if(['guardian','kumaverson'].includes(kind)&&plan.abilityPresentation==='guard'){
  const raised=keys(p,[[0,0],[.28,1],[.7,1],[1,0]])[0];
  const sourceDirection=Math.atan2(atlas.muzzle[1]-pivot[1],atlas.muzzle[0]-pivot[0]);
  const reach=armReach(primary).max,home=point(torso,rest);
  const shoulder=point(torso,primary.shoulder);
  const goal=[shoulder[0]+reach*.72,shoulder[1]+reach*.28];
  const hand=[home[0]+(goal[0]-home[0])*raised,home[1]+(goal[1]-home[1])*raised];
  const aim=nearAngle(-Math.PI*.5-sourceDirection,restAngle);
  upper[atlas.weaponBone]=rigid(pivot,hand,restAngle+(aim-restAngle)*raised);
 }else if(kind==='brawler'&&plan.abilityPresentation==='fist-wave'){
  // Bring both fists from the waist to the same forward pressure plane.
  // Their original shoulders and elbows keep their own fixed bone lengths.
  for(const [index,c]of arms.entries()){
   const wrist=c.effectorWrist??c.wrist,home=point(base[c.effectorBone],wrist),reach=armReach(c).max;
   const rows=[[.18,-reach*.10,reach*.55],[.23,-reach*.10,reach*.55],
    [.28,reach*.92,reach*.14+(index?4:-4)],[.48,reach*.92,reach*.14+(index?4:-4)],[.64,reach*.87,reach*.18]];
   const t=point(torso,shoulderTarget(c,p,home,rows));
   const sourceDirection=Math.atan2(c.grip[1]-wrist[1],c.grip[0]-wrist[0]);
   handPose(upper,c,t,swingAngle(p,Math.atan2(base[c.effectorBone][1],base[c.effectorBone][0])+sourceDirection,
    -.1,0,.08)-sourceDirection+bodyAngle,2*envelope);
  }
 }else if(contactKinds.has(kind)){
  const leading=arms.findIndex(c=>c.effectorBone===atlas.weaponBone);
  const both=['grappler','crusher','abomination','futago','futago-separated-a','futago-separated-b'].includes(kind);
  for(const [index,c]of arms.entries()){
   if(kind==='mugarian-president-mutated'&&index===2)continue; // The third arm braces the cane while the claws strike.
   const wrist=c.effectorWrist??c.wrist,home=point(base[c.effectorBone],wrist),reach=armReach(c).max;
   const lead=both||index===(variant===0?leading:(leading+1)%arms.length);
   if(lead)strikeBones.push(c.effectorBone);
   let rows=lead?[[.18,-reach*.18,-reach*.48],[.23,-reach*.18,-reach*.48],[.28,reach*.95,reach*(index%2?.22:.04)],[.48,reach*.76,reach*.48],[.64,reach*.7,reach*.4]]
    :[[.18,reach*.28,reach*.12],[.23,reach*.28,reach*.12],[.28,reach*.10,reach*.37],[.48,reach*.20,reach*.27],[.64,reach*.2,reach*.27]];
   if(kind==='mugarian-president-mutated'&&lead)rows=[[.18,-reach*.16,-reach*.60],[.23,-reach*.16,-reach*.60],
    [.28,reach*.50,reach*.86],[.48,reach*.15,reach*.98],[.64,reach*.15,reach*.98]];
   const t=point(torso,shoulderTarget(c,p,home,rows)),start=Math.atan2(base[c.effectorBone][1],base[c.effectorBone][0]);
   const sourceDirection=Math.atan2(c.grip[1]-wrist[1],c.grip[0]-wrist[0]);
   const aimed=kind==='mugarian-president-mutated'&&lead
    ?keys(p,[[0,start],[.18,-2.1],[.23,-2.1],[.28,-.65],[.48,.05],[.64,.05],[1,start]])[0]+bodyAngle
    :swingAngle(p,start+sourceDirection,-.7,lead?-.1:-.7,lead?.6:-.5)-sourceDirection+bodyAngle;
   handPose(upper,c,t,aimed,2*envelope);
  }
 }else if(kind==='crazy-king'){
  // Both grips belong to the motor housing. Sweep its long bar across the
  // front of the body; never rotate the bar behind the hips at impact.
  const sourceDirection=Math.atan2(atlas.muzzle[1]-pivot[1],atlas.muzzle[0]-pivot[0]);
  const carry=[227,205],local=attacking?shoulderTarget(primary,p,carry,[[.18,44,-11],[.23,44,-11],[.28,59,37],[.48,44,50],[.64,44,50]]):carry;
  angle=(attacking?swingAngle(p,.15,-2.15,-.05,.8):.15)-sourceDirection;
  upper['weapon-0']=multiply(torso,rigid(pivot,local,angle));
  weaponOwners.push({...arms[1],effectorBone:'weapon-0',effectorWrist:[195,253]});
  const hand=point(upper['weapon-0'],[195,253]);
  upper['arm-1-hand']=rigid(arms[1].wrist,hand,angle+bodyAngle);
 }else{
  if(kind==='babayaga'){
   const [aimAt,lowerAt]=atlas.attackBoundaries;
   const raise=attacking?keys(p,[[0,0],[aimAt,1],[lowerAt,1],[1,0]])[0]:0;
   const recoil=attacking?keys(p,[[0,0],[.28,0],[.32,-6],[.42,0],[.7,0],[1,0]])[0]:0;
   // Lower the pistol beside the body while travelling. Raise it only for
   // the actual shot; the free arm continues to belong to its own shoulder.
   target=[198+raise*82+recoil,228-raise*56];
   angle=1.35*(1-raise);
  }else if(attacking){
   const sourceDirection=Math.atan2(atlas.muzzle[1]-pivot[1],atlas.muzzle[0]-pivot[0]),restDirection=restAngle+sourceDirection;
   const reach=armReach(primary).max,reverse=variant===1&&['tky','miyamoto-musashi','red-panther-knife','scout'].includes(kind);
   let wind=-2.15,hit=-.12,follow=1.05;
   let rows=[[.18,-reach*.12,-reach*.63],[.23,-reach*.12,-reach*.63],[.28,reach*.85,reach*.18],[.48,reach*.70,reach*.60],[.64,reach*.70,reach*.60]];
   if(reverse){
    [wind,hit,follow]=[1.65,-.35,-1.75];
    rows=[[.18,reach*.45,reach*.70],[.23,reach*.45,reach*.70],[.28,reach*.88,reach*.06],[.48,reach*.35,-reach*.70],[.64,reach*.35,-reach*.70]];
   }
   if(kind==='brute'){[wind,hit,follow]=[-2.25,-.65,-.3];rows=[[.18,23,-26],[.23,23,-26],[.28,38,13],[.48,35,28],[.64,35,28]];}
   else if(['guardian','gate-eater','red-panther-shield'].includes(kind)){[wind,hit,follow]=[restDirection-.25,restDirection,restDirection+.10];rows=[[.18,23,38],[.23,23,38],[.28,66,16],[.48,62,24],[.64,62,24]];}
   else if(kind==='kumaverson'){[wind,hit,follow]=[-1.7,-.08,.85];rows=[[.18,9,-reach*.95],[.23,9,-reach*.95],[.28,reach*.96,0],[.48,reach*.77,reach*.52],[.64,reach*.77,reach*.52]];}
   else if(kind==='takuya-omega'){[wind,hit,follow]=[-2.75,.25,.9];rows=[[.08,0,150],[.18,45,140],[.23,45,140],[.25,0,165],[.28,reach*.55,reach*.83],[.48,reach*.62,reach*.5],[.64,reach*.62,reach*.5]];}
   else if(kind==='takuya'){rows=[[.18,70,-10],[.23,70,-10],[.28,90,35],[.48,70,65],[.64,70,65]];}
   target=shoulderTarget(primary,p,rest,rows);
   angle=swingAngle(p,restDirection,wind,hit,follow,kind==='takuya-omega')-sourceDirection;
  }else{
   target=rest;angle=restAngle;
  }
  upper[atlas.weaponBone]=kind==='babayaga'?rigid(pivot,point(torso,target),angle):multiply(torso,rigid(pivot,target,angle));
  if(kind==='miyamoto-musashi'){
   const c=arms[1],r=point(base['weapon-1'],c.effectorWrist??c.wrist),a=Math.atan2(base['weapon-1'][1],base['weapon-1'][0]);
   const rows=[[.18,18,-30],[.23,18,-30],[.28,62,5],[.48,45,45],[.64,45,45]];
   const t=shoulderTarget(c,p,r,rows),da=swingAngle(p,a,variant===2?-1.7:1.0,variant===2?.2:-.9,variant===2?1.1:-1.7);
   upper['weapon-1']=multiply(torso,rigid(c.effectorWrist??c.wrist,t,da));
  }
  // A free hand braces the chest and counterbalances the striking shoulder.
  // It is never left frozen against the hip while the weapon alone rotates.
  if(attacking&&kind!=='babayaga')for(const c of arms.filter(c=>!c.effectorBone.startsWith('weapon'))){
   const wrist=c.effectorWrist??c.wrist,home=point(base[c.effectorBone],wrist),reach=armReach(c).max;
   const t=point(torso,shoulderTarget(c,p,home,[[.18,reach*.35,reach*.15],[.23,reach*.35,reach*.15],[.28,-reach*.35,reach*.4],[.48,reach*.12,reach*.25],[.64,reach*.12,reach*.25]]));
   handPose(upper,c,t,Math.atan2(base[c.effectorBone][1],base[c.effectorBone][0])+bodyAngle,2*envelope);
  }
 }
 // Keep both original bone lengths. Move the whole held weapon by the
 // smallest translation that puts every hand in its shoulder's reachable disc.
 for(const weapon of new Set(weaponOwners.filter(c=>c.effectorBone.startsWith('weapon')).map(c=>c.effectorBone))){
  const owners=weaponOwners.filter(c=>c.effectorBone===weapon);
  if(kind==='takuya-omega'&&atlas.weaponHull&&owners.length===1){
   constrainOmegaWeapon(atlas,upper);
   continue;
  }
  constrainHeldWeapon(upper,weapon,owners,['crazy-king','babayaga','kumaverson'].includes(kind)?2:2*envelope);
 }
 if(kind==='crazy-king'){
  const m=upper['weapon-0'],hand=point(m,[195,253]);
  upper['arm-1-hand']=rigid(arms[1].wrist,hand,Math.atan2(m[1],m[0]));
 }
 const frontBones=(!attacking||['crazy-king','babayaga','kumaverson','takuya-omega'].includes(kind)||p>.06&&p<.94)?arms.flatMap(c=>[c.upperBone,c.lowerBone,c.effectorBone]):[];
 const stationaryAbility=['guard','fist-wave','cross-guard','ground-slam','slam'].includes(plan.abilityPresentation);
 if(kind==='babayaga'){const far=new Set([arms[1].upperBone,arms[1].lowerBone,arms[1].effectorBone]);for(let i=frontBones.length-1;i>=0;i--)if(far.has(frontBones[i]))frontBones.splice(i,1);}
 const choreography={kind,variant,sequence,upper,arms,frontBones,strikeBones,bodyWeight:weight,stepDistance:attacking&&!stationaryAbility?attackSteps[kind]??0:0,
  ...(kind==='mugarian-president-mutated'?{strikePoints:{'arm-1-hand':[228,326]}}:{})};if(!attacking)carryPlans.set(atlas,choreography);
 return{...plan,choreography:walkingCarry(kind,atlas,plan,choreography,attacking?1-envelope:1),upperOffsetY:0};
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
