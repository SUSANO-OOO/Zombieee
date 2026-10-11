import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {V177_JOINT_ATLASES,v177JointPose,drawV177JointPose} from '../app/v177JointPresentation.js';

const definitions=new Map();
for(const dir of await readdir(new URL('../assets/source/v100/joints/',import.meta.url))){
 try{const d=JSON.parse(await readFile(new URL('../assets/source/v100/joints/'+dir+'/parts.json',import.meta.url)));definitions.set(d.kind,d);}
 catch(e){if(!['ENOENT','ENOTDIR'].includes(e.code))throw e;}
}
const transform=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function paintedBones(kind,atlas,sample,runtime){
 const matrices=[],ctx={save(){},restore(){},translate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},transform(...m){matrices.push(m);},drawImage(){}};
 const plan=v177JointPose(kind,sample,runtime);assert.ok(plan,kind+' authored plan');
 assert.ok(drawV177JointPose(ctx,{naturalWidth:atlas.decodedWidth},kind,plan,0,0,480,448));
 return Object.fromEntries(atlas.parts.map((p,i)=>[p.bone,matrices[i]]));
}
function assertLegs(kind,d,raw){
 // The actual visible pelvis, rather than a separately attacking torso, owns
 // biped hips. Quadruped hips belong to the visible torso. This expectation is
 // derived from painted source ownership, independently of runtime metadata.
 const parent=d.parts.some(p=>p.bone==='pelvis'&&d.lowerLayers.includes(p.name))?'pelvis':'spine';
 for(let i=0;i<d.rig.legs.length;i++){
  const l=d.rig.legs[i],a=raw[`leg-${i}-upper`],b=raw[`leg-${i}-lower`],foot=raw[`leg-${i}-foot`];
  assert.ok(distance(transform(a,l.hip),transform(raw[parent],l.hip))<.001,kind+' hip stays in painted body');
  assert.ok(distance(transform(a,l.knee),transform(b,l.knee))<.001,kind+' knee joins both rigid pieces');
  assert.ok(distance(transform(b,l.ankle),transform(foot,l.ankle))<.001,kind+' ankle joins planted foot');
  for(const m of [a,b]){
   assert.ok(Math.abs(Math.hypot(m[0],m[1])-1)<.0001);assert.ok(Math.abs(Math.hypot(m[2],m[3])-1)<.0001);
   assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2]-1)<.0001,kind+' leg never scales, shears or reflects');
  }
  const gap=distance(transform(raw[parent],l.hip),transform(foot,l.ankle)),upper=distance(l.hip,l.knee),lower=distance(l.knee,l.ankle);
  assert.ok(gap>Math.abs(upper-lower)+.001&&gap<upper+lower-.001,kind+' fixed-length reach, no fallback');
 }
}

test('All43 rigid forms keep their painted hip, knee and ankle joined through travel, settling and attack',()=>{
 const rigid=Object.entries(V177_JOINT_ATLASES).filter(([,a])=>a.type==='rigid-parts');assert.equal(rigid.length,43);
 assert.deepEqual(Object.keys(V177_JOINT_ATLASES).filter(k=>V177_JOINT_ATLASES[k].type!=='rigid-parts'),['ranger']);
 let samples=0;
 for(const [kind,atlas]of rigid){
  const d=definitions.get(kind)??[...definitions.values()].find(x=>V177_JOINT_ATLASES[x.kind]===atlas);assert.ok(d,kind+' frozen source');
  assert.equal(atlas.legConstraints.length,d.rig.legs.length);
  const lowerPelvis=d.parts.some(p=>p.bone==='pelvis'&&d.lowerLayers.includes(p.name));
  for(let i=0;i<d.rig.legs.length;i++){
   const c=atlas.legConstraints[i];assert.equal(c.parentBone,lowerPelvis?'pelvis':'spine');assert.equal(c.parentUpper??true,!lowerPelvis);
   for(const point of ['hip','knee','ankle'])assert.deepEqual(c[point],d.rig.legs[i][point]);
  }
  for(let n=0;n<=120;n++)for(const settle of [0,.5,1]){
   assertLegs(kind,d,paintedBones(kind,atlas,{requestedState:'move'},{locomotionPhase:n/120,locomotionSettle:settle}));samples++;
  }
  for(let p=0;p<12;p++)for(const settle of [0,1]){
   const runtime={locomotionPhase:(p+.1371)/12,locomotionSettle:settle},idle=paintedBones(kind,atlas,{requestedState:'idle'},runtime);
   for(const state of ['wind-up','active','recovery'])for(let n=0;n<=30;n++){
    const raw=paintedBones(kind,atlas,{requestedState:state,clipProgress:n/30},runtime);assertLegs(kind,d,raw);samples++;
    for(let i=0;i<d.rig.legs.length;i++){
     const bone=`leg-${i}-foot`,ankle=d.rig.legs[i].ankle;
     assert.ok(distance(transform(raw[bone],ankle),transform(idle[bone],ankle))<.001,kind+' held foot never follows attack');
    }
   }
  }
  assert.equal(v177JointPose(kind,{requestedState:'hit'},{}),null,kind+' preserves separate hit owner');
  assert.equal(v177JointPose(kind,{requestedState:'active'},{},{ownedPose:true}),null,kind+' preserves dedicated ability owner');
 }
 assert.equal(samples,111585);
});

test('Mayo reduces only the unreachable anticipation while retaining its painted texture, gait and forward bite',async()=>{
 const d=definitions.get('mayo-chan'),atlas=V177_JOINT_ATLASES['mayo-chan'];
 const legacy=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/v177-pre-leg-mayo-atlas-r1.json.gz',import.meta.url))));
 assert.equal(d.rig.attack.anticipationPx,1.5);assert.deepEqual(d.rig.attack.bodyShift,[6,1.4]);
 assert.deepEqual(atlas.parts,legacy.parts);assert.equal(atlas.path,legacy.path);assert.equal(atlas.decodedBytes,legacy.decodedBytes);
 assert.equal(atlas.cycleDistance,legacy.cycleDistance);assert.deepEqual(atlas.pelvisOffsets,legacy.pelvisOffsets);
 assert.deepEqual(atlas.poses.slice(0,atlas.lowerCount),legacy.poses.slice(0,legacy.lowerCount),'Walk and every settle frame unchanged');
 const active=v177JointPose('mayo-chan',{requestedState:'active',clipProgress:.5},{locomotionPhase:0,locomotionSettle:1});
 assert.deepEqual(atlas.poses[active.upperIndex],legacy.poses[active.upperIndex],'Full forward bite remains authored');
 for(let phase=0;phase<=240;phase++)for(let clip=0;clip<=60;clip++){
  assertLegs('mayo-chan',d,paintedBones('mayo-chan',atlas,{requestedState:'wind-up',clipProgress:clip/60},{locomotionPhase:phase/240,locomotionSettle:1}));
 }
});
