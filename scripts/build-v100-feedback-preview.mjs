import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
const root='outputs/v100-audio-review-r2';
const roles=['swing','heavy-metal','pistol','rifle','explosion','fall'];
const filters=roles.map((_,i)=>`[${i}:a]aresample=44100,apad=whole_len=132300,atrim=0:3[a${i}]`).join(';')+';'+roles.map((_,i)=>`[a${i}]`).join('')+'concat=n=6:v=0:a=1[out]';
execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error',...roles.flatMap(role=>['-i',`public/audio/v100/foley/${role}.mp3`]),'-filter_complex',filters,'-map','[out]','-c:a','libmp3lame','-q:a','3',root+'/combat-foley.mp3'],{stdio:'pipe'});
const levels=roles.map(role=>{
 const measured=spawnSync(ffmpeg.path,['-hide_banner','-i',`public/audio/v100/foley/${role}.mp3`,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
 if(measured.status!==0)throw new Error(measured.stderr);
 const mean=measured.stderr.match(/mean_volume: ([-\d.]+) dB/),peak=measured.stderr.match(/max_volume: ([-\d.]+) dB/);
 if(!mean||!peak)throw new Error(`Missing volume measurement: ${role}`);
 return{role,meanDb:Number(mean[1]),peakDb:Number(peak[1])};
});
let html=await readFile(root+'/index.html','utf8');
if(!html.includes('combat-foley.mp3'))html=html.replace('</body>','').replace('</html>','')+`<section><h2>戦闘効果音</h2><p>振り抜き → 鍋の打撃 → 拳銃 → ライフル → 爆発 → 倒れる音。各3秒の間隔です。実戦の重なりは別途調整しています。</p><audio controls preload="metadata" src="combat-foley.mp3"></audio><small>Kenney / CC0、Joth / CC0、Vincent Sevedge / CC BY 3.0。音の切り出し・フィルター・音量・フェードを調整。<a href="https://opengameart.org/content/gunshot-sounds">銃声の配布元</a></small></section></html>`;
await writeFile(root+'/index.html',html);
await writeFile(root+'/combat-foley-report.json',JSON.stringify({roles,levels},null,2));
console.log(root+'/combat-foley.mp3');
