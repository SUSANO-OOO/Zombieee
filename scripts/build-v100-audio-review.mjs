import{mkdir,writeFile,readFile}from'node:fs/promises';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import ffmpeg from'@ffmpeg-installer/ffmpeg';
const out=process.env.V100_AUDIO_REVIEW_OUT??'outputs/v100-audio-review-r2';await mkdir(out,{recursive:true});
const jobs=[
 {id:'conversation',title:'会話・日常',track:'Amberlight',start:12,poster:'outputs/v100-dialogue-improvement-r1/webkit-844x340-pair.png'},
 {id:'combat',title:'通常戦闘',track:'Simulacra',start:32,poster:'outputs/v100-final-normal-c471eba-r1/s1-30s.png'},
];
const report=[];
for(const job of jobs){
 const input='assets/source/v100/audio/scott-buckley/'+job.track+'.mp3';
 const destination=out+'/'+job.id+'.mp4';
 execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-loop','1','-i',job.poster,'-ss',String(job.start),'-i',input,'-t','32','-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p','-af','afade=t=in:st=0:d=0.5,afade=t=out:st=30:d=2,volume=0.55','-r','10','-c:v','libx264','-preset','fast','-crf','25','-c:a','aac','-b:a','160k','-movflags','+faststart','-shortest',destination],{stdio:'pipe'});
 report.push({...job,path:destination,sourceSha256:createHash('sha256').update(await readFile(input)).digest('hex')});
 execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error','-i',destination,'-c:v','libvpx-vp9','-crf','36','-b:v','0','-deadline','good','-cpu-used','4','-c:a','libopus','-b:a','128k',out+'/'+job.id+'.webm'],{stdio:'pipe'});
}
const ui=['advance','navigate','cancel','confirm','reject'];
const inputs=ui.flatMap(id=>['-i','public/audio/v100/ui/v100-ui-'+id+'.mp3']);
const filters=ui.map((_,i)=>`[${i}:a]aresample=44100,apad=whole_len=70560[a${i}]`).join(';')+';'+ui.map((_,i)=>`[a${i}]`).join('')+'concat=n=5:v=0:a=1[out]';
execFileSync(ffmpeg.path,['-y','-hide_banner','-loglevel','error',...inputs,'-filter_complex',filters,'-map','[out]','-c:a','libmp3lame','-q:a','3',out+'/interface.mp3'],{stdio:'pipe'});
await writeFile(out+'/report.json',JSON.stringify({scope:'Music direction samples synchronized to still game imagery; not finished sound mix or motion evidence',jobs:report,interfaceOrder:ui},null,2));
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>音の方向性・確認用</title><style>body{margin:auto;max-width:850px;padding:22px;background:#101d22;color:#e7ecdf;font:16px/1.65 system-ui}h1{font-size:24px;color:#ffdb97}h2{font-size:19px}section{padding:16px;margin:16px 0;background:#1b3439;border:1px solid #657d76;border-radius:10px}video,audio{width:100%}a{color:#b9dfef}small{color:#b8c7c3}</style><h1>音の方向性・確認用</h1><p>各プレーヤーをタップして再生できます。BGMを選ぶための32秒のサンプルです。背景はゲームの静止画で、戦闘効果音・VFXの完成見本ではありません。</p>${jobs.map(j=>`<section><h2>${j.title}</h2><video controls playsinline preload="metadata"><source src="${j.id}.mp4" type="video/mp4"><source src="${j.id}.webm" type="video/webm"></video><small>『${j.track}』Scott Buckley / CC BY 4.0<br>抜粋・音量・フェードを調整。<a href="https://www.scottbuckley.com.au/library/${j.track.toLowerCase()}/">公式配布元</a></small></section>`).join('')}<section><h2>短い操作音</h2><p>次へ → 項目選択 → 戻る → 購入成功 → 操作できない、の順です。</p><audio controls preload="metadata" src="interface.mp3"></audio><small>Kenney Interface Sounds / CC0。長さ・音量・高域を調整。</small></section><p>ボス戦BGMは現在の曲を残します。会話中の電子音の解消、効果音の整理は別途作業中です。</p></html>`;
await writeFile(out+'/index.html',html);console.log(JSON.stringify({out,jobs:jobs.length}));
