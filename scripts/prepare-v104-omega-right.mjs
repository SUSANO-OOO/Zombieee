// Pad/resize the two generated transparent layers; retain every other R1 part.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const revision=process.argv[2]??'r3';
if(!['r2','r3'].includes(revision))throw Error('Unknown Omega revision');
const root='assets/source/v100/joints/',dir=root+'takuya-omega-'+revision,old=root+'takuya-omega-r1';
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(dir,{recursive:true});
const d=JSON.parse(await readFile(old+'/parts.json'));
await copyFile(old+'/identity-reference.png',dir+'/identity-reference.png');
for(const p of d.parts){p.file='../takuya-omega-r1/'+p.file;}
for(const p of Object.values(d.poseBindings))p.file='../takuya-omega-r1/'+p.file;
const layers=[
 {name:'cleaver-and-hand',bone:'weapon-0',input:'right-grip-generated.png',size:revision==='r3'?384:282,left:revision==='r3'?139:136,top:revision==='r3'?185:193,anchor:revision==='r3'?[150,320]:[220,400],wrist:[184,281]},
 {name:'left-free-hand',bone:'arm-1-hand',input:'left-hand-generated.png',size:154,left:301,top:216,anchor:[540,465],wrist:[366,272]},
];
for(const p of layers){
 const input=await sharp(dir+'/'+p.input).resize(p.size,p.size).png().toBuffer();
 const bytes=await sharp({create:{width:544,height:revision==='r3'&&p.bone==='weapon-0'?600:512,channels:4,background:'#00000000'}}).composite([{input,left:p.left,top:p.top}]).png().toBuffer();
 await writeFile(dir+'/'+p.name+'.png',bytes);
 d.parts=d.parts.filter(x=>x.name!==p.name&&x.name!=='giant-hand');
 d.parts.push({name:p.name,bone:p.bone,file:p.name+'.png',sha256:sha(bytes),original:false,
  authoring:{source:p.input,sourceSha256:sha(await readFile(dir+'/'+p.input)),resize:[p.size,p.size],padding:[p.left,p.top],wrist:p.wrist}});
}
d.order=d.order.filter(x=>x!=='giant-hand');
d.order.splice(d.order.indexOf('cleaver-forearm')+1,0,'left-free-hand');
d.status='V1.0.4 right-handed Omega: unchanged R1 body/face/boots with dedicated giant closed right grip, broad industrial greatsword and empty far left hand. Original fixed bone lengths, strict IK and support planes. Runtime/native QA recorded separately.';
d.visibleIdentityPolicy='R1 face, hair, sunglasses, torso, tubing, arms, shorts and boots retained byte-for-byte. Only hand/weapon layers replaced at Producer request. Anatomical near giant right arm owns weapon; far small left hand is empty.';
d.armConstraints[0].effectorBone='weapon-0';
d.armConstraints[0].effectorWrist=[184,281];
d.armConstraints[1].effectorBone='arm-1-hand';
delete d.armConstraints[1].effectorWrist;
d.interpolationPivots['weapon-0']=[184,281];
d.interpolationPivots['arm-1-hand']=[366,272];
d.muzzle=revision==='r3'?[493,520]:[378,439];
d.rig.weapons[0]={name:'weapon-0',a:[184,281],b:d.muzzle,armIndex:0};
d.rig.arms[0].effectorWrist=[184,281];
d.rig.legs[0].center=d.legConstraints[0].center=330;
d.rig.legs[1].center=d.legConstraints[1].center=229;
Object.assign(d.rig.attack,{armTargets:[[184,281],[366,272]],handAngles:[0,0],walkRestShift:[0,-8],walkRestAngle:0,aimShift:[22,-32],anticipationShift:[-2,-18],attackAngle:.15,anticipationAngle:-.4,walkWeaponSwing:1});
if(revision==='r3')Object.assign(d.rig.attack,{walkRestShift:[0,-65],anticipationAngle:0,aimShift:[15,-32]});
await writeFile(dir+'/parts.json',JSON.stringify(d,null,2)+'\n');
console.log(JSON.stringify({dir,layers:layers.map(p=>({name:p.name,wrist:p.wrist}))}));
