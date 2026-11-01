import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {CHAINSAW_RECORDING_CUES} from '../app/chainsawRecordings.js';
const root='assets/source/chainsaw-recordings',out='public/audio/weapons/chainsaw',rate=44100;
const source=root+'/chainsaw-0707.ogg',hash=b=>createHash('sha256').update(b).digest('hex');
const run=args=>execFileSync(ffmpeg.path,['-v','error',...args],{maxBuffer:32*1024*1024});
function pcm(file,filter='anull') {
 const b=run(['-i',file,'-af',filter,'-ar',String(rate),'-ac','1','-f','f32le','pipe:1']);
 return new Float32Array(b.buffer,b.byteOffset,b.length/4);
}
const rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
const peak=a=>a.reduce((s,v)=>Math.max(s,Math.abs(v)),0);
// Source windows and envelopes are explicit adaptations, not a claim that
// the source was recorded during combat or that each window is an engine stop.
const recipes={
 start:{start:11.35,duration:1.05,target:.075},
 'idle-loop':{start:19,duration:2,target:.035,loop:true},
 attack:{start:28.05,duration:.46,target:.075},
 'flesh-hit':{start:38,duration:.34,target:.07,foley:'assets/source/v100/audio/kenney-impact/impactSoft_heavy_000.ogg',motorMix:.2},
 'hard-hit':{start:51,duration:.48,target:.07,foley:'assets/source/v100/audio/kenney-impact/impactMetal_heavy_000.ogg',motorMix:.2},
 stop:{start:112,duration:.78,target:.045,fadeOut:.4},
 'overdrive-activate':{start:25.15,duration:.7,target:.075},
 'overdrive-active':{start:71,duration:.65,target:.075},
};
await fs.mkdir(out,{recursive:true});const records=[];
for(const [name,r] of Object.entries(recipes)) {
 const n=Math.round(r.duration*rate),overlap=Math.round(.1*rate);
 const filter=`atrim=start=${r.start}:duration=${r.duration+(r.loop?.1:0)},asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=6500`;
 const motor=pcm(source,filter);if(motor.length<n+(r.loop?overlap:0))throw Error('Short source '+name);
 const samples=new Float32Array(motor.slice(0,n));
 if(r.loop)for(let i=0;i<overlap;i++) {const mix=i/overlap;samples[i]=motor[n+i]*(1-mix)+motor[i]*mix;}
 const inputs=[{file:source,sha256:hash(await fs.readFile(source))}];
 if(r.foley) {
  const foley=pcm(r.foley,'highpass=f=90,lowpass=f=6500'),motorLevel=rms(samples),foleyLevel=rms(foley.slice(0,n));
  for(let i=0;i<n;i++)samples[i]=samples[i]/motorLevel*r.motorMix+(foley[i]??0)/foleyLevel*(1-r.motorMix);
  inputs.push({file:r.foley,sha256:hash(await fs.readFile(r.foley))});
 }
 const mean=samples.reduce((s,v)=>s+v,0)/n;
 for(let i=0;i<n;i++) {
  const envelope=r.loop?1:Math.min(1,i/(.004*rate),(n-1-i)/((r.fadeOut??.075)*rate));
  samples[i]=(samples[i]-mean)*envelope;
 }
 const gain=Math.min(r.target/rms(samples),(r.loop?.18:.72)/peak(samples));
 for(let i=0;i<n;i++)samples[i]*=gain;
 const raw=Buffer.from(samples.buffer),formats=r.loop?[['wav','pcm_s16le']]:[['mp3','libmp3lame'],['ogg','libvorbis']];
 for(const [ext,codec] of formats) {
  const file=`${out}/${name}.${ext}`;
  execFileSync(ffmpeg.path,['-v','error','-y','-f','f32le','-ar',String(rate),'-ac','1','-i','pipe:0','-c:a',codec,...(r.loop?[]:['-q:a',ext==='mp3'?'3':'4']),'-fflags','+bitexact',file],{input:raw});
  const bytes=await fs.readFile(file),decoded=pcm(file),p=peak(decoded);
  if(p>.9||rms(decoded)<.005)throw Error('Invalid encoded level '+name);
  records.push({name,file,bytes:bytes.length,sha256:hash(bytes),inputs,recipe:r,filter,gain,decoded:{seconds:decoded.length/rate,peak:p,rms:rms(decoded),boundaryJump:Math.abs(decoded[0]-decoded.at(-1))}});
 }
}
const sourceReceipt=JSON.parse(await fs.readFile(root+'/source-receipt.json'));
const provenance={status:'runtime-candidate-not-listening-accepted',sourceReceipt,creator:'Joseph SARDIN; Kenney (contact foley)',license:'CC0-1.0',commercialUse:true,modification:true,redistribution:true,
 notices:[root+'/LICENSE.txt','assets/source/v100/audio/kenney-impact/License.txt'],
 adaptation:'Recorded chainsaw windows trimmed, filtered and level bounded. Cyclic crossfade for idle; motor falloff with fade for stop. Contacts mix recorded motor with Kenney body/metal foley. No spoken imitation, pitch-shifted tone or synthesized motor.',
 subjectiveListening:'not performed',physicalDeviceAcceptance:'not performed',
 formats:{preferred:'MP3 one-shots / PCM WAV idle loop',fallback:'Ogg one-shots',reason:'Keep existing one-shot codecs; preserve exact loop seam without lossy encoder padding'},
 runtimeCueCount:Object.keys(CHAINSAW_RECORDING_CUES).length,runtimeAssetCount:records.length,logicalBytes:records.reduce((s,r)=>s+r.bytes,0),distinctBytes:records.reduce((s,r)=>s+r.bytes,0),records};
await fs.writeFile(root+'/provenance.json',JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({cues:provenance.runtimeCueCount,files:records.length,bytes:provenance.logicalBytes,loop:records.find(r=>r.name==='idle-loop').decoded}));
