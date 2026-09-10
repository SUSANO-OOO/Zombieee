import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {V100_MUSIC_TRACKS} from '../app/v100Music.js';
const records=[];
for(const track of V100_MUSIC_TRACKS){
 const file='public/audio/v100/score/'+track.role+'.mp3';
 const pcm=execFileSync(ffmpeg.path,['-hide_banner','-loglevel','error','-i',file,'-f','f32le','-ac','2','-ar','44100','-'],{maxBuffer:100_000_000});
 const frames=pcm.length/8,duration=frames/44100;
 let peak=0,sum=0;
 for(let i=0;i<pcm.length;i+=4){const value=pcm.readFloatLE(i);assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));sum+=value*value;}
 const rms=Math.sqrt(sum/(frames*2));
 const seam=Math.max(...[0,1].map(c=>Math.abs(pcm.readFloatLE(c*4)-pcm.readFloatLE((frames-1)*8+c*4))));
 assert.ok(Math.abs(duration-(track.duration-2))<.05,'Exact gapless loop duration: '+track.role);
 assert.ok(peak<.9,'Headroom after lossy encoding: '+track.role);
 assert.ok(rms>.004&&rms<.13,'Audible score with sensible RMS: '+track.role);
 assert.ok(seam<.08,'No discontinuity at loop seam: '+track.role);
 records.push({role:track.role,duration,peakDb:20*Math.log10(peak),rmsDb:20*Math.log10(rms),seamAmplitude:seam});
}
await writeFile('outputs/completion/music-signal-r1.json',JSON.stringify({scope:'Decoded MPEG signal, duration, headroom and loop seam checks; not human listening acceptance',status:'passed',records},null,2));
console.log(JSON.stringify({status:'passed',records}));
