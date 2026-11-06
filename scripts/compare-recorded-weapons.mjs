// Audition sequence only. This is not a recording of in-game trigger timing.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
const out='output/quality-20261028/audio-comparison';
await fs.mkdir(out,{recursive:true});
const provenance=JSON.parse(await fs.readFile('assets/source/weapon-recordings/provenance.json','utf8'));
const rows=[];
for(const family of ['rifle','gunner','smg','handgun']){
  const ids=family==='handgun'?['v104-handgun','v104-handgun']:[`weapon-${family}-01`,`weapon-${family}-02`];
  const takes=ids.map(id=>provenance.records.find(r=>r.id===id&&r.file.endsWith('.mp3')));
  for(const version of ['before','after']){
    const inputs=version==='before'?takes.map(r=>r.reference.file):takes.map(r=>r.file);
    const filters=inputs.map((_,i)=>`[${i}:a]aformat=channel_layouts=mono,volume=${version==='before'?takes[i].reference.comparisonGain:1}[in${i}]`);
    filters.push('[in0]asplit=3[a][c][e]','[in1]asplit=2[b][d]');
    const timing=[0,1000,2200,2320,2440];
    for(const [i,letter]of ['a','b','c','d','e'].entries())filters.push(`[${letter}]adelay=${timing[i]}[d${i}]`);
    filters.push('[d0][d1][d2][d3][d4]amix=inputs=5:duration=longest:dropout_transition=0,volume=5,apad=whole_len=145530[out]');
    const file=`${out}/${family}-${version}.wav`;
    execFileSync(ffmpeg.path,['-y','-v','error',...inputs.flatMap(file=>['-i',file]),'-filter_complex',filters.join(';'),'-map','[out]','-ar','44100','-c:a','pcm_s16le',file],{stdio:'pipe'});
    rows.push({family,version,file,eventsMs:timing,inputs,levelMatching:'First 200ms RMS; subjective loudness and quality not accepted'});
  }
}
await fs.writeFile(out+'/index.json',JSON.stringify({scope:'Authored audition sequence, not runtime or physical-device evidence',rows},null,2)+'\n');
console.log(JSON.stringify({comparisons:rows.length}));
