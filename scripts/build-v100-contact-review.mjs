import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
const source=process.env.V100_CONTACT_REVIEW_SOURCE??'outputs/v100-contact-chromium-r4';
const out='outputs/v100-audio-review-r2';
const report=JSON.parse(await readFile(source+'/report.json'));
const result=report.results[0],combo=result.completeVisibleCombos?.[0];
if(result.status!=='observed'||combo?.length!==5||result.errors.length)throw new Error('A native five-contact observation without browser errors is required');
const ground=result.contactAudit.draws.find(d=>d.kind==='ground');
if(!ground)throw new Error('No native ground-impact observation');
const excerpts=[{label:'パイセンの連撃',start:Math.max(0,Math.min(...combo.map(h=>h.at))/1000-2)},
 {label:'タタラの地砕き',start:Math.max(0,ground.at/1000-2)}];
for(const [index,excerpt] of excerpts.entries()){
 const file=out+'/contact-native-part-'+index+'.mp4';
 execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-ss',String(excerpt.start),'-i',result.video,'-t','8','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-an',file]);
 excerpt.file=file;excerpt.durationSeconds=8;
}
const mp4=out+'/contact-native.mp4',webm=out+'/contact-native.webm';
execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-i',excerpts[0].file,'-i',excerpts[1].file,'-filter_complex','[0:v][1:v]concat=n=2:v=1:a=0[v]','-map','[v]','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',mp4]);
execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-i',mp4,'-c:v','libvpx-vp9','-b:v','0','-crf','30','-an',webm]);
await copyFile(source+'/s3-contact-canvas.png',out+'/contact-native.png');
let index=await readFile(out+'/index.html','utf8');
if(index.includes('id="contact-review"'))throw new Error('Preserve the existing review unless deliberately updating its source');
const section='<section id="contact-review"><h2>打撃の演出・実戦映像</h2><p>前半はパイセンの連撃、後半はタタラの地砕きです。拳の命中には短い接触の粒子、地面への打撃には土煙と破片を使い分けています。</p><video controls playsinline preload="metadata" poster="contact-native.png"><source src="contact-native.mp4" type="video/mp4"><source src="contact-native.webm" type="video/webm"></video><small>通常操作の実戦から各8秒を抜粋した16秒映像・音声なし。人物の身体の動き、ほかの技能と敵の演出は引き続き改善中です。</small></section>';
await writeFile(out+'/index.html',index.replace('</html>',section+'</html>'));
const outputs=[];for(const file of [mp4,webm]){const bytes=await readFile(file);outputs.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile(out+'/contact-review-report.json',JSON.stringify({sourceReport:source+'/report.json',build:report.build.combinedSha256,sourceVideo:result.video,excerpts,outputs,combo,durationSeconds:16,audio:false,scope:'Native Chromium 844x340 owned-roster S3 fixture. Ordinary deploy, support and ability inputs only; no actor, HP or clock setters. Edited sequence of two actual excerpts; not earned campaign or physical-device acceptance.'},null,2)+'\n');
console.log(JSON.stringify({outputs,excerpts}));
