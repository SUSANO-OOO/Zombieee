import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { RECORDED_WEAPON_TAKES } from '../app/weaponRecordingRecipes.js';
const sourceRoot = 'assets/source/weapon-recordings', out = 'public/audio/weapons/recorded';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = args => execFileSync(ffmpeg.path, ['-hide_banner','-loglevel','error',...args], { maxBuffer: 32 * 1024 * 1024 });
const pcm = (source, filter) => {
  const bytes = run(['-i',source,'-af',filter,'-ar','44100','-ac','1','-f','f32le','pipe:1']);
  return new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength / 4);
};
const rms = samples => Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
await mkdir(out,{recursive:true});
const records = [];
for (const [id, take] of Object.entries(RECORDED_WEAPON_TAKES)) {
  const source = `${sourceRoot}/${take.source}`;
  const filters = `aformat=channel_layouts=mono,atrim=start=${take.start}:end=${take.start+1},asetpts=PTS-STARTPTS,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.004,atrim=0:${take.duration},asetpts=PTS-STARTPTS,highpass=f=80,lowpass=f=${take.cutoff},afade=t=out:st=${take.duration-.12}:d=0.12,apad=pad_len=1323`;
  const dry = pcm(source,filters), old = pcm(`public/${take.reference}`,'anull');
  // Equal active-window RMS is a reproducible comparison aid, not a claim
  // of equal perceived loudness or an actual listening acceptance.
  const oldRms = rms(old.slice(0,8820)), dryRms = rms(dry.slice(0,8820));
  if (!(dryRms > .001)) throw Error(`No recorded discharge selected: ${id}`);
  // The prior recording has a dense noise floor. Matching its RMS by driving
  // these sharper transients into a limiter would destroy their dynamics.
  // Use a bounded active level, then attenuate the old clip for A/B listening.
  const dryPeak=dry.reduce((max,v)=>Math.max(max,Math.abs(v)),0);
  const gain = Math.min(.07 / dryRms, .75 / dryPeak);
  const targetActive200msRms=dryRms*gain;
  const filter = `${filters},volume=${gain},alimiter=limit=0.8:level=false`;
  for (const [ext,codec] of [['mp3','libmp3lame'],['ogg','libvorbis']]) {
    const file = `${out}/${id}.${ext}`;
    run(['-y','-i',source,'-af',filter,'-ar','44100','-ac','1','-c:a',codec,'-q:a',ext==='ogg'?'4':'3','-fflags','+bitexact',file]);
    const bytes = await readFile(file), samples = pcm(file,'anull');
    const peak = samples.reduce((max,v) => Math.max(max,Math.abs(v)),0);
    if (peak > .95) throw Error(`Codec overshoot: ${id}`);
    records.push({id,file,bytes:bytes.length,sha256:hash(bytes),source:{file:source,sha256:hash(await readFile(source))},
      sourceWindowStart:take.start,filter,targetActive200msRms,reference:{file:`public/${take.reference}`,sha256:hash(await readFile(`public/${take.reference}`)),active200msRms:oldRms,comparisonGain:targetActive200msRms/oldRms},
      decoded:{seconds:samples.length/44100,peak,active200msRms:rms(samples.slice(0,8820))}});
  }
}
await writeFile(`${sourceRoot}/provenance.json`,JSON.stringify({
  source:'https://opengameart.org/content/the-free-firearm-sound-library',
  archive:'https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z',
  creator:'Ben Jaszczak; Brian Nelson; Kevin Heras; Matthew Nanney',license:'CC0-1.0',notice:`${sourceRoot}/LICENSE.txt`,
  commercialUse:true,modification:true,redistribution:true,producerAuthorization:'2026-10-28 P03 implementation instruction',
  subjectiveListening:'not performed',physicalDeviceAcceptance:'not performed',
  formats:{preferred:'mp3',fallback:'ogg',reason:'Preserve existing mobile MP3 and browser Ogg compatibility'},
  runtimeAssetCount:records.length,logicalBytes:records.reduce((n,r)=>n+r.bytes,0),distinctBytes:records.reduce((n,r)=>n+r.bytes,0),records,
},null,2)+'\n');
console.log(JSON.stringify({files:records.length,bytes:records.reduce((n,r)=>n+r.bytes,0)}));
