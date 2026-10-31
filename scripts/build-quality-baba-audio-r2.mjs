import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
const out='public/audio/quality-20261028',root='assets/source/quality-20261028/audio-r2';
await mkdir(out,{recursive:true});await mkdir(root,{recursive:true});
const source='assets/source/weapon-recordings/X_39P.wav',hash=b=>createHash('sha256').update(b).digest('hex');
const filter='atrim=start=1.25:end=1.95,asetpts=PTS-STARTPTS,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.004,atrim=0:0.42,asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=3600,afade=t=out:st=0.30:d=0.12,apad=pad_len=1323';
const run=a=>execFileSync(ffmpeg.path,['-v','error',...a],{maxBuffer:8*1024*1024});
const pcm=f=>{const b=run(['-i',source,'-af',f,'-f','f32le','-ac','1','-ar','44100','pipe:1']);return new Float32Array(b.buffer,b.byteOffset,b.length/4);};
const dry=pcm(filter),rms=Math.sqrt(dry.slice(0,8820).reduce((s,v)=>s+v*v,0)/8820),peak=Math.max(...dry.map(Math.abs));
const gain=Math.min(.085/rms,.75/peak),records=[];
for(const [ext,codec]of [['mp3','libmp3lame'],['ogg','libvorbis']]){
 const file=`${out}/babayaga-suppressed-r2.${ext}`;
 run(['-y','-i',source,'-af',`${filter},volume=${gain},alimiter=limit=0.8:level=false`,'-ac','1','-ar','44100','-c:a',codec,'-q:a',ext==='ogg'?'4':'3','-fflags','+bitexact',file]);
 const b=await readFile(file);records.push({file,bytes:b.length,sha256:hash(b)});
}
const provenance={source,sourceSha256:hash(await readFile(source)),license:'CC0-1.0',notice:'assets/source/weapon-recordings/LICENSE.txt',creator:'Ben Jaszczak; Brian Nelson; Kevin Heras; Matthew Nanney',filter,gain,records,adaptation:'Recorded pistol discharge processed for a suppressed game weapon. Not a recording of an actual suppressor. Retains the mechanical transient; no spoken imitation.',subjectiveListening:'pending',physicalDeviceAcceptance:'pending'};
await writeFile(root+'/provenance.json',JSON.stringify(provenance,null,2)+'\n');console.log(JSON.stringify({records,gain}));
