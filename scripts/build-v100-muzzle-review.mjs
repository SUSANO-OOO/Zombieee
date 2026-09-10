import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
const source='outputs/v100-muzzle-native-r3',out='outputs/v100-audio-review-r2';
const report=JSON.parse(await readFile(source+'/report.json'));
const result=report.results[0];
if(result.status!=='observed'||!result.muzzleAudit.draws.length)throw new Error('No native firearm observation');
const start=Math.max(0,result.muzzleAudit.draws[0].at/1000-2);
const file=out+'/muzzle-native.mp4';
execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-ss',String(start),'-i',result.video,'-t','14','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-an',file]);
await copyFile(source+'/s1-muzzle-canvas.png',out+'/muzzle-native.png');
let index=await readFile(out+'/index.html','utf8');
const section='<section id="muzzle-review"><h2>発砲の演出・実戦映像</h2><p>通常操作でババヤガを出撃させた戦闘です。銃口の火花を短い連続コマにし、実際の銃の先端へ合わせました。</p><video controls playsinline preload="metadata" poster="muzzle-native.png" src="muzzle-native.mp4"></video><small>表示確認用の14秒映像・音声なし。音楽と効果音は試聴欄で確認できます。攻撃モーション全体と他のVFXは引き続き改善中です。</small></section>';
if(index.includes('id="muzzle-review"'))throw new Error('Preserve an existing review unless deliberately updating its source.');
index=index.replace('</html>',section+'</html>');
await writeFile(out+'/index.html',index);
const bytes=await readFile(file);
await writeFile(out+'/muzzle-review-report.json',JSON.stringify({
 sourceReport:source+'/report.json',build:report.build.combinedSha256,sourceVideo:result.video,
 output:file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
 startSeconds:start,durationSeconds:14,audio:false,
 scope:'Native Chromium battle at844x340, normal deployment/ability inputs, no actor or clock setters. Video excerpt only; not physical-device or full-game acceptance.'
},null,2)+'\n');
console.log(JSON.stringify({file,bytes:bytes.length,start}));
