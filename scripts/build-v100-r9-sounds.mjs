import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {V100_R9_SOUND_RECIPES} from '../app/v100R9SoundDesign.js';
const root='assets/source/v100/audio',out='public/audio/v100/r9';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=args=>execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error',...args],{stdio:'pipe'});
await mkdir(out,{recursive:true});
const records=[];
for(const [name,recipe] of Object.entries(V100_R9_SOUND_RECIPES)){
 const inputs=[],filters=[],mix=[],sources=[];
 for(const [index,layer] of recipe.layers.entries()){
  const file=`${root}/${layer.file}`;inputs.push('-i',file);
  const content=await readFile(file);sources.push({file,sha256:sha(content),license:'CC0-1.0'});
  filters.push(`[${index}:a]aformat=channel_layouts=mono,aresample=44100,asetrate=${Math.round(44100*layer.rate)},aresample=44100,highpass=f=70,lowpass=f=7000,volume=${layer.gain},adelay=${layer.delay},apad=whole_len=${Math.round(44100*recipe.duration)},atrim=0:${recipe.duration}[l${index}]`);
  mix.push(`[l${index}]`);
 }
 if(recipe.noise){
  const {color,gain,cutoff,start,end}=recipe.noise,index=recipe.layers.length;
  inputs.push('-f','lavfi','-i',`anoisesrc=color=${color}:sample_rate=44100:amplitude=0.7:duration=${recipe.duration}:seed=${903+records.length}`);
  filters.push(`[${index}:a]highpass=f=70,lowpass=f=${cutoff},volume=${gain},afade=t=in:d=${start},afade=t=out:st=${recipe.duration-end}:d=${end}[air]`);mix.push('[air]');
 }
 filters.push(`${mix.join('')}amix=inputs=${mix.length}:duration=longest:dropout_transition=0,volume=${mix.length},atrim=0:${recipe.duration},afade=t=out:st=${recipe.duration-.04}:d=0.04,alimiter=limit=0.8:level=false[out]`);
 for(const [ext,codec] of [['mp3','libmp3lame'],['ogg','libvorbis']]){
  const file=`${out}/${name}.${ext}`;
  run([...inputs,'-filter_complex',filters.join(';'),'-map','[out]','-ar','44100','-ac','1','-c:a',codec,'-q:a',ext==='mp3'?'3':'4',file]);
  const bytes=await readFile(file);records.push({id:`v100-r9-${name}`,file,bytes:bytes.length,sha256:sha(bytes),duration:recipe.duration,loop:recipe.loop??false,sources,recipe,
   adaptation:'Recorded CC0 physical foley, deterministic filtered noise, delayed layers, fades and peak limiter. No UI acknowledgement or dialogue synthesis.'});
 }
}
await writeFile(root+'/r9-sound-provenance.json',JSON.stringify({version:1,sources:[{creator:'Kenney',license:'CC0-1.0',notices:['kenney-rpg/License.txt','kenney-impact/License.txt'],urls:['https://kenney.nl/assets/rpg-audio','https://kenney.nl/assets/impact-sounds']}],records},null,2)+'\n');
console.log(JSON.stringify({files:records.length,preferredMp3Bytes:records.filter(row=>row.file.endsWith('.mp3')).reduce((sum,row)=>sum+row.bytes,0)}));
