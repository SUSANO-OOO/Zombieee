import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {MELEE_FOLEY_RECIPES} from '../app/meleeFoleyRecipes.js';
const root='assets/source/v100/audio',out='public/audio/weapons/melee',rate=44100;
const hash=b=>createHash('sha256').update(b).digest('hex');
const pcm=(file,filter='anull')=>{
  const b=execFileSync(ffmpeg.path,['-v','error','-i',file,'-af',filter,'-ar',String(rate),'-ac','1','-f','f32le','pipe:1'],{maxBuffer:8*1024*1024});
  return new Float32Array(b.buffer,b.byteOffset,b.length/4);
};
const rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length);
const peak=a=>a.reduce((s,v)=>Math.max(s,Math.abs(v)),0);
await fs.mkdir(out,{recursive:true});await fs.mkdir('assets/source/melee-foley',{recursive:true});
const records=[];
for(const [id,recipe]of Object.entries(MELEE_FOLEY_RECIPES)){
  const samples=new Float32Array(Math.round(recipe.duration*rate)),inputs=[];
  for(const [relative,weight]of recipe.layers){
    const file=root+'/'+relative,filter=`highpass=f=85,lowpass=f=${recipe.reference==='swing'?7000:5200}`;
    const layer=pcm(file,filter),level=rms(layer.slice(0,Math.min(layer.length,8820)));
    if(!(level>.0001))throw Error('Silent foley '+file);
    for(let i=0;i<samples.length;i++)samples[i]+=(layer[i]??0)/level*weight;
    inputs.push({file,sha256:hash(await fs.readFile(file)),weight,filter});
  }
  const mean=samples.reduce((s,v)=>s+v,0)/samples.length;
  for(let i=0;i<samples.length;i++)samples[i]=(samples[i]-mean)*Math.min(1,i/(.002*rate),(samples.length-1-i)/(.07*rate));
  const gain=Math.min(.07/rms(samples.slice(0,8820)),.72/peak(samples));
  for(let i=0;i<samples.length;i++)samples[i]*=gain;
  const target=rms(samples.slice(0,8820)),reference='public/audio/v100/foley/'+recipe.reference+'.mp3';
  const oldRms=rms(pcm(reference).slice(0,8820));
  for(const [ext,codec]of [['mp3','libmp3lame'],['ogg','libvorbis']]){
    const file=out+'/'+id+'.'+ext;
    execFileSync(ffmpeg.path,['-v','error','-y','-f','f32le','-ar',String(rate),'-ac','1','-i','pipe:0','-c:a',codec,'-q:a',ext==='mp3'?'3':'4','-fflags','+bitexact',file],{input:Buffer.from(samples.buffer)});
    const bytes=await fs.readFile(file),decoded=pcm(file);
    if(peak(decoded)>.95)throw Error('Codec clipping '+file);
    records.push({id,file,bytes:bytes.length,sha256:hash(bytes),inputs,duration:recipe.duration,gain,targetActive200msRms:target,
      reference:{file:reference,sha256:hash(await fs.readFile(reference)),comparisonGain:target/oldRms},
      decoded:{seconds:decoded.length/rate,peak:peak(decoded),active200msRms:rms(decoded.slice(0,8820))}});
  }
}
const notices=await Promise.all(['kenney-rpg','kenney-impact'].map(async pack=>({file:root+'/'+pack+'/License.txt',sha256:hash(await fs.readFile(root+'/'+pack+'/License.txt'))})));
await fs.writeFile('assets/source/melee-foley/provenance.json',JSON.stringify({creator:'Kenney',license:'CC0-1.0',notices,
  urls:['https://kenney.nl/assets/rpg-audio','https://kenney.nl/assets/impact-sounds'],commercialUse:true,modification:true,redistribution:true,
  authorization:'Producer P03 instruction, 2026-10-28',adaptation:'Filtered licensed foley layers, no pitch change; material recordings used as designed impact layers, not literal recordings of these weapons hitting enemies.',
  subjectiveListening:'not performed',formats:{preferred:'mp3',fallback:'ogg',reason:'Preserve existing mobile MP3 and browser Ogg compatibility'},
  runtimeAssetCount:records.length,logicalBytes:records.reduce((n,r)=>n+r.bytes,0),
  distinctBytes:[...new Map(records.map(r=>[r.sha256,r.bytes])).values()].reduce((n,bytes)=>n+bytes,0),records},null,2)+'\n');
console.log(JSON.stringify({files:records.length,bytes:records.reduce((n,r)=>n+r.bytes,0)}));
