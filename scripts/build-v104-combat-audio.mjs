import fs from'node:fs/promises';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';import ffmpeg from'@ffmpeg-installer/ffmpeg';
const source='assets/source/v100/audio',out='public/audio/v104/combat',records=[];
const voices=JSON.parse(await fs.readFile('assets/source/v104/combat-audio/voices.json','utf8'));
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',');
if(only&&only.some(name=>!['handgun','suppressed-pistol','crossbow-release',...voices.cast.map(v=>`voice-${v.kind}-${v.event}`)].includes(name)))throw Error('Unknown isolated audio target');
const oldProvenance=only?JSON.parse(await fs.readFile('assets/source/v104/combat-audio/provenance.json','utf8')):null;
await fs.mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
// Ogg muxing picks a stream serial at random. Preserve the existing exact asset
// when only the serial and its page checksums changed during regeneration.
function sameOggPayload(a,b){
 const normalize=input=>{const bytes=Buffer.from(input);let p=0;
  while(p<bytes.length){if(bytes.toString('ascii',p,p+4)!=='OggS')return null;
   const n=bytes[p+26],size=27+n+bytes.subarray(p+27,p+27+n).reduce((s,v)=>s+v,0);
   if(p+size>bytes.length)return null;bytes.fill(0,p+14,p+18);bytes.fill(0,p+22,p+26);p+=size;
  }return bytes;};
 const x=normalize(a),y=normalize(b);return Boolean(x&&y&&x.equals(y));
}
const eyeSources=[
 {name:'eye-warning',duration:1.25,expression:'0.32*sin(2*PI*(145*t+240*t*t))*(0.75+0.25*sin(2*PI*9*t))',filter:'highpass=f=100,lowpass=f=2600,afade=t=in:d=0.06,afade=t=out:st=1.1:d=0.15'},
 {name:'eye-fire',duration:.44,expression:'0.24*sin(2*PI*77*t+4*sin(2*PI*37*t))+0.17*sin(2*PI*650*t+12*sin(2*PI*131*t))+0.08*sin(2*PI*1567*t)*sin(2*PI*3719*t)',filter:'highpass=f=60,lowpass=f=6200,afade=t=in:d=0.015,afade=t=out:st=0.24:d=0.2'},
];
for(const effect of eyeSources){
 if(only)continue;
 const file='assets/source/v104/combat-audio/'+effect.name+'.wav';
 execFileSync(ffmpeg.path,['-y','-v','error','-f','lavfi','-i',`aevalsrc=${effect.expression}:s=44100:d=${effect.duration}`,'-af',effect.filter,'-c:a','pcm_s16le',file],{stdio:'pipe'});
}
const crossbowString={duration:.3,expression:'0.16*(sin(2*PI*190*t)+0.46*sin(2*PI*380*t)+0.21*sin(2*PI*570*t))*exp(-32*t)',filter:'highpass=f=120,lowpass=f=5400,afade=t=in:d=0.002,afade=t=out:st=0.2:d=0.1'};
const crossbowStringFile='assets/source/v104/combat-audio/crossbow-string.wav';
if(!only||only.includes('crossbow-release'))execFileSync(ffmpeg.path,['-y','-v','error','-f','lavfi','-i',`aevalsrc=${crossbowString.expression}:s=44100:d=${crossbowString.duration}`,'-af',crossbowString.filter,'-c:a','pcm_s16le',crossbowStringFile],{stdio:'pipe'});
async function encode(name,inputs,filter,extra={}){
 if(only&&!only.includes(name))return;
 for(const[ext,codec]of[['ogg','libvorbis'],['mp3','libmp3lame']]){
  const file=`${out}/${name}.${ext}`;
  const previous=ext==='ogg'?await fs.readFile(file).catch(()=>null):null;
  const compatible=filter.replaceAll('amix=inputs=2:normalize=0','amix=inputs=2:duration=longest:dropout_transition=0,volume=2');
  const graph=compatible+';[mix]alimiter=limit=0.85:level=false'+(/^(pan-|armor-)/.test(name)?',volume=0.5':'')+'[out]';
  execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error',...inputs.flatMap(p=>['-i',p]),'-filter_complex',graph,'-map','[out]','-ar','44100','-ac','1','-c:a',codec,'-q:a','4',file],{stdio:'pipe'});
  let bytes=await fs.readFile(file);
  if(previous&&sameOggPayload(previous,bytes)){bytes=previous;await fs.writeFile(file,bytes);}
  records.push({file,bytes:bytes.length,sha256:sha(bytes),inputs:await Promise.all(inputs.map(async file=>({file,sha256:sha(await fs.readFile(file))}))),filter:graph,...extra});
 }
}
await encode('pan-hit',[source+'/kenney-rpg/metalPot1.ogg',source+'/kenney-impact/impactSoft_heavy_000.ogg'],
 '[0:a]atrim=0:0.65,highpass=f=240,lowpass=f=7200,volume=0.8[p];[1:a]atrim=0:0.18,lowpass=f=1600,volume=0.5[b];[p][b]amix=inputs=2:normalize=0,volume=0.48,afade=t=out:st=0.48:d=0.17,apad=pad_len=1323[mix]');
await encode('pan-heavy',[source+'/kenney-rpg/metalPot2.ogg',source+'/kenney-impact/impactSoft_heavy_000.ogg'],
 '[0:a]atrim=0:0.8,highpass=f=200,lowpass=f=7000,volume=0.85[p];[1:a]atrim=0:0.25,lowpass=f=1900,volume=0.6[b];[p][b]amix=inputs=2:normalize=0,volume=0.48,afade=t=out:st=0.6:d=0.2,apad=pad_len=1323[mix]');
await encode('armor-hit',[source+'/kenney-impact/impactMetal_heavy_000.ogg',source+'/kenney-impact/impactSoft_heavy_000.ogg'],
 '[0:a]asetrate=35280,aresample=44100,atrim=0:0.5,highpass=f=65,lowpass=f=2200,volume=0.75[p];[1:a]atrim=0:0.3,lowpass=f=650,volume=0.85[b];[p][b]amix=inputs=2:normalize=0,volume=0.48,afade=t=out:st=0.16:d=0.1,apad=pad_len=1323[mix]');
const gunshotCredit={creator:'Vincent Sevedge (Tabasco)',license:'CC-BY-3.0',url:'https://opengameart.org/content/gunshot-sounds',notice:source+'/opengameart/creativecommons.txt',adaptation:'trimmed, filtered, attenuated and faded original CZ pistol recording; no voice'};
await encode('handgun',[source+'/opengameart/cz.wav'],
 '[0:a]silenceremove=start_periods=1:start_threshold=-24dB:start_silence=0.005,atrim=0:0.32,asetpts=PTS-STARTPTS,highpass=f=90,lowpass=f=8500,volume=0.48,afade=t=out:st=0.22:d=0.1[mix]',{credit:gunshotCredit,nonVoice:true});
await encode('suppressed-pistol',[source+'/opengameart/cz.wav'],
 '[0:a]silenceremove=start_periods=1:start_threshold=-24dB:start_silence=0.005,atrim=0:0.24,asetpts=PTS-STARTPTS,highpass=f=140,lowpass=f=1900,volume=0.28,afade=t=out:st=0.12:d=0.12[mix]',{credit:gunshotCredit,nonVoice:true});
await encode('crossbow-release',[source+'/kenney-rpg/metalLatch.ogg',source+'/kenney-rpg/knifeSlice.ogg',crossbowStringFile],
 '[0:a]atrim=0:0.075,highpass=f=350,lowpass=f=5000,volume=0.2[l];[1:a]atrim=0:0.12,highpass=f=900,lowpass=f=6000,volume=0.12,adelay=8[w];[2:a]volume=0.9[p];[l][w][p]amix=inputs=3:duration=longest:dropout_transition=0,volume=2.4,afade=t=out:st=0.2:d=0.1,apad=pad_len=1323[mix]',
 {procedural:crossbowString,nonVoice:true,credit:{creator:'Kenney; deterministic plucked-string synthesis by project',license:'CC0-1.0',notice:source+'/kenney-rpg/License.txt',url:'https://kenney.nl/assets/rpg-audio',adaptation:'short latch and bolt rush over a damped string release; no gunshot or voice'}});
for(const effect of eyeSources)await encode(effect.name,['assets/source/v104/combat-audio/'+effect.name+'.wav'],'[0:a]volume=1[mix]',{procedural:effect,nonVoice:true});
for(const v of voices.cast)await encode(`voice-${v.kind}-${v.event}`,[v.source],
 '[0:a]highpass=f=85,lowpass=f=9000,silenceremove=start_periods=1:start_threshold=-46dB:start_silence=0.01,volume=0.9[mix]',{credit:v.credit,text:v.text,synthetic:true,styleId:v.styleId});
const completeRecords=only?[...oldProvenance.records.filter(r=>!only.some(name=>r.file===out+'/'+name+'.mp3'||r.file===out+'/'+name+'.ogg')), ...records]:records;
await fs.writeFile('assets/source/v104/combat-audio/provenance.json',JSON.stringify({sources:{foley:{license:'CC0-1.0',creator:'Kenney',urls:['https://kenney.nl/assets/impact-sounds','https://kenney.nl/assets/rpg-audio']},gunshots:gunshotCredit,voices},records:completeRecords},null,2)+'\n');
console.log(JSON.stringify({files:records.length,bytes:records.reduce((s,r)=>s+r.bytes,0)}));
