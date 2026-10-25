import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
const root='assets/source/v105/fist-wave-audio',output='public/audio/v105';
await fs.mkdir(root,{recursive:true});await fs.mkdir(output,{recursive:true});
const recipes=[
  {role:'charge',duration:.26,expression:'0.13*sin(2*PI*(100*t+520*t*t))+0.07*sin(2*PI*220*t)*sin(2*PI*733*t)',filter:'highpass=f=90,lowpass=f=2600,afade=t=in:d=0.035,afade=t=out:st=0.21:d=0.05'},
  {role:'launch',duration:.29,expression:'0.22*sin(2*PI*(380*t-450*t*t))*exp(-10*t)+0.13*sin(2*PI*3917*t)*sin(2*PI*2173*t)*exp(-15*t)',filter:'highpass=f=100,lowpass=f=6800,afade=t=in:d=0.004,afade=t=out:st=0.18:d=0.11'},
  {role:'impact',duration:.34,expression:'0.32*sin(2*PI*(92*t-80*t*t))*exp(-18*t)+0.13*sin(2*PI*3181*t)*sin(2*PI*1733*t)*exp(-25*t)',filter:'highpass=f=55,lowpass=f=4200,afade=t=in:d=0.002,afade=t=out:st=0.20:d=0.14'},
];
const records=[];
for(const recipe of recipes){
  const master=`${root}/${recipe.role}.wav`,file=`${output}/fist-wave-${recipe.role}.mp3`;
  execFileSync(ffmpeg.path,['-y','-v','error','-f','lavfi','-i',`aevalsrc=${recipe.expression}:s=44100:d=${recipe.duration}`,
    '-af',recipe.filter,'-ac','1','-c:a','pcm_s16le',master],{stdio:'pipe'});
  execFileSync(ffmpeg.path,['-y','-v','error','-i',master,'-ac','1','-ar','44100','-c:a','libmp3lame','-b:a','128k','-write_xing','1','-id3v2_version','3','-flags:a','+bitexact',file],{stdio:'pipe'});
  const alternate=`${output}/fist-wave-${recipe.role}.ogg`;
  execFileSync(ffmpeg.path,['-y','-v','error','-i',master,'-ac','1','-ar','44100','-c:a','libvorbis','-q:a','4','-fflags','+bitexact','-flags:a','+bitexact',alternate],{stdio:'pipe'});
  const bytes=await fs.readFile(file);
  records.push({...recipe,master,masterSha256:createHash('sha256').update(await fs.readFile(master)).digest('hex'),
    file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    alternate,alternateBytes:(await fs.stat(alternate)).size,alternateSha256:createHash('sha256').update(await fs.readFile(alternate)).digest('hex')});
}
await fs.writeFile(`${root}/provenance.json`,JSON.stringify({generator:'scripts/build-v105-fist-wave-audio.mjs',
  source:'Original deterministic project synthesis; no voice or third-party samples',
  contract:'charge at accepted start; launch at current-model fist paint; one impact at swept projectile collision',
  oldComboImpactReused:false,records},null,2)+'\n');
console.log(JSON.stringify({assets:records.length,bytes:records.reduce((sum,row)=>sum+row.bytes,0)}));
