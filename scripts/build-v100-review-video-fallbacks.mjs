import {readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
const root='outputs/v100-audio-review-r2';
let html=await readFile(root+'/index.html','utf8');
const videos=[...html.matchAll(/<video([^>]*?)\ssrc="([^"]+\.mp4)"([^>]*)><\/video>/g)];
const records=[];
for(const [tag,before,mp4,after] of videos){
 const webm=mp4.replace(/\.mp4$/,'.webm'),target=root+'/'+webm;
 let exists=await stat(target).then(()=>true,()=>false);
 if(!exists)execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-i',root+'/'+mp4,'-c:v','libvpx-vp9','-b:v','0','-crf','32','-cpu-used','4','-c:a','libopus',target]);
 html=html.replace(tag,'<video'+before+after+'><source src="'+mp4+'" type="video/mp4"><source src="'+webm+'" type="video/webm"></video>');
 records.push({mp4,webm,bytes:(await stat(target)).size});
}
await writeFile(root+'/index.html',html);
await writeFile(root+'/video-fallbacks-report.json',JSON.stringify({scope:'MP4 preserved; WebM fallback added for browsers without H.264 decoding. Existing audio is retained.',records},null,2)+'\n');
console.log(JSON.stringify(records));
