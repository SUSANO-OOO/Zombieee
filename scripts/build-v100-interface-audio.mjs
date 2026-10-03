import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
const source='assets/source/v100/audio/kenney-interface';
const target='public/audio/v100/ui';
await mkdir(target,{recursive:true});
const specs=[
 ['advance','click_001.ogg',.14,.48],
 ['navigate','click_002.ogg',.16,.55],
 ['cancel','back_001.ogg',.22,.5],
 ['confirm','confirmation_001.ogg',.36,.55],
 ['reject','error_001.ogg',.26,.4],
];
const files=[];
for(const [role,file,duration,volume] of specs){
 const input=source+'/'+file;
 const filters=`atrim=0:${duration},asetpts=PTS-STARTPTS,highpass=f=100,lowpass=f=7500,volume=${volume},afade=t=out:st=${(duration-.035).toFixed(3)}:d=0.035`;
 for(const [ext,codec] of [['ogg','libvorbis'],['mp3','libmp3lame']]){
  const output=target+'/v100-ui-'+role+'.'+ext;
  execFileSync(ffmpegInstaller.path,['-y','-hide_banner','-loglevel','error','-i',input,'-af',filters,'-ar','44100','-ac','1','-codec:a',codec,'-q:a',ext==='ogg'?'4':'3',output],{stdio:'pipe'});
  const bytes=await readFile(output);
  files.push({role,path:output,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:file,sourceSha256:createHash('sha256').update(await readFile(input)).digest('hex'),filters});
 }
}
await writeFile(source+'/provenance.json',JSON.stringify({creator:'Kenney',pack:'Interface Sounds 1.0',sourceUrl:'https://kenney.nl/assets/interface-sounds',downloadUrl:'https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip',license:'CC0-1.0',licenseFile:'License.txt',adaptation:'Shortened, filtered, lowered gain, faded; derived for V1 interface roles',files},null,2)+'\n');
console.log(JSON.stringify(files.map(({role,path,bytes})=>({role,path,bytes}))));
