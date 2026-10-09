import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
const source='assets/source/v100/audio';
const target='public/audio/v100/ui';
await mkdir(target,{recursive:true});
const specs=[
 ['advance','kenney-rpg/bookFlip2.ogg',.18,.45],
 ['navigate','kenney-impact/impactWood_light_000.ogg',.12,.45],
 ['cancel','kenney-rpg/cloth3.ogg',.18,.35],
 ['confirm','kenney-rpg/metalLatch.ogg',.17,.40],
 ['reject','kenney-impact/impactWood_heavy_000.ogg',.20,.22],
];
const files=[];
for(const [role,file,duration,volume] of specs){
 const input=source+'/'+file;
 const filters=`silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.001,atrim=0:${duration},asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=${role==='reject'?2400:6000},volume=${volume},afade=t=in:d=0.002,afade=t=out:st=${(duration-.035).toFixed(3)}:d=0.035,alimiter=limit=0.6:level=false`;
 for(const [ext,codec] of [['ogg','libvorbis'],['mp3','libmp3lame']]){
  const output=target+'/v100-ui-'+role+'.'+ext;
  execFileSync(ffmpegInstaller.path,['-y','-hide_banner','-loglevel','error','-i',input,'-af',filters,'-ar','44100','-ac','1','-codec:a',codec,'-q:a',ext==='ogg'?'4':'3',output],{stdio:'pipe'});
  const bytes=await readFile(output);
  files.push({role,path:output,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:file,sourceSha256:createHash('sha256').update(await readFile(input)).digest('hex'),filters});
 }
}
await writeFile(source+'/interface-foley-provenance.json',JSON.stringify({creator:'Kenney',packs:['RPG Audio','Impact Sounds'],sourceUrls:['https://kenney.nl/assets/rpg-audio','https://kenney.nl/assets/impact-sounds'],license:'CC0-1.0',licenseFiles:['kenney-rpg/License.txt','kenney-impact/License.txt'],adaptation:'Recorded paper, wood, cloth and latch sounds, shortened, filtered, lowered gain and faded. No synthesized acknowledgement tones.',files},null,2)+'\n');
console.log(JSON.stringify(files.map(({role,path,bytes})=>({role,path,bytes}))));
