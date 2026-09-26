import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {V100_MUSIC_TRACKS} from '../app/v100Music.js';
const out=process.env.V100_AUDIO_REVIEW_OUT??'outputs/v100-audio-review-r2';
await mkdir(out,{recursive:true});
const labels={
  preparation:['作戦準備','地図・編成・装備を選ぶ時間。静かな推進感を保つ曲です。'],
  tension:['危機・作戦中の会話','襲撃の予兆、連絡、危険な状況での判断。旋律を抑え、緊張を保ちます。'],
  horror:['地下・研究施設・異常個体','未知の脅威や実験の痕跡を見つける場面。不穏な響きを中心にしています。'],
  relief:['救出後・安堵','助かった人の無事や再会。喜びだけでなく、疲れや傷も残る場面の曲です。'],
  loss:['喪失・別れ','犠牲者や家族を想う場面、敗北後。静かな悲しみを置きます。'],
  ending:['終幕・スタッフロール','最後の戦いの後、街と人の生活へ帰る余韻。スタッフロールも同じ曲が続きます。'],
  pressure:['通常戦闘・追い込み','承認済みの通常戦闘曲から強い部分を使い、戦況が厳しくなったときに切り替えます。ボス曲は現在のままです。'],
};
const jobs=[];
for(const track of V100_MUSIC_TRACKS.filter(t=>labels[t.role])){
 const file='score-'+track.role+'.mp3',input='public/audio/v100/score/'+track.role+'.mp3';
 execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-i',input,'-t','32','-af',`volume=${track.gain},afade=t=in:d=0.35,afade=t=out:st=30:d=2`,'-c:a','libmp3lame','-b:a','128k',out+'/'+file],{stdio:'pipe'});
 jobs.push({role:track.role,file,title:track.title,sha256:createHash('sha256').update(await readFile(out+'/'+file)).digest('hex')});
}
let html=await readFile(out+'/index.html','utf8');
html=html.replace(/<div id="scene-music-review">[\s\S]*?<\/div><!-- scene-music-review -->/u,'');
const section='<div id="scene-music-review"><h2>追加した場面別の音楽</h2><p>通常戦闘と会話・日常は了承いただいた方向で反映しました。以下は場面に合わせて追加した32秒の試聴です。実機スピーカーでの最終確認はこれからです。</p>'
 +jobs.map(j=>`<section><h2>${labels[j.role][0]}</h2><p>${labels[j.role][1]}</p><audio controls preload="metadata" src="${j.file}"></audio><small>『${j.title}』Scott Buckley / <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。抜粋・ループ・音量を調整。<a href="https://www.scottbuckley.com.au/library/${V100_MUSIC_TRACKS.find(t=>t.role===j.role).page}/">公式配布元</a></small></section>`).join('')
 +'</div><!-- scene-music-review -->';
html=html.replace('<section><h2>短い操作音</h2>',section+'<section><h2>短い操作音</h2>');
if(!html.includes('id="exclusive-media"'))html=html.replace('</html>','<script id="exclusive-media">document.addEventListener("play",function(e){if(!(e.target instanceof HTMLMediaElement))return;document.querySelectorAll("audio,video").forEach(function(m){if(m!==e.target)m.pause();});},true);</script></html>');
await writeFile(out+'/index.html',html);
await writeFile(out+'/scene-music-report.json',JSON.stringify({scope:'32-second review excerpts from runtime score assets, not final physical-speaker mix acceptance',jobs},null,2));
console.log(JSON.stringify({out,jobs:jobs.length}));
