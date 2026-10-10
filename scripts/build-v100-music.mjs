import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { V100_MUSIC_TRACKS } from '../app/v100Music.js';
const root = 'assets/source/v100/audio/scott-buckley';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir('public/audio/v100/score', { recursive: true });
await mkdir('outputs/completion/score-pcm', { recursive: true });
const role = process.argv.find(arg => arg.startsWith('--role='))?.slice('--role='.length);
if (role && !V100_MUSIC_TRACKS.some(track => track.role === role)) throw new Error('Unknown score role: ' + role);
// A new title track must not rewrite any already released scene recording.
const previous = role ? JSON.parse(await readFile(root + '/production-provenance.json', 'utf8')) : null;
const records = previous ? previous.records.filter(record => record.role !== role) : [];
for (const track of V100_MUSIC_TRACKS.filter(track => !role || track.role === role)) {
  const input = root + '/' + track.file + '.mp3', d = track.duration;
  // Rotate a two-second tail/head crossfade to the end. Restart joins source
  // t=2 exactly, without a repeating silence or a one-sided fade.
  const decoded = execFileSync(ffmpeg.path, ['-hide_banner','-loglevel','error','-ss',String(track.start),'-i',input,'-t',String(d),'-ar','44100','-ac','2','-f','f32le','-'], { maxBuffer:100_000_000 });
  const rate = 44100, overlap = rate * 2, frames = d * rate;
  if (decoded.length !== frames * 8) throw new Error('Incomplete source excerpt: ' + track.role);
  const body = Buffer.from(decoded.subarray(overlap * 8, (frames-overlap) * 8));
  const blend = Buffer.alloc(overlap * 8);
  for (let frame=0; frame<overlap; frame++) {
    const mix = frame / (overlap-1);
    for (let channel=0; channel<2; channel++) {
      const tail = decoded.readFloatLE(((frames-overlap+frame)*2+channel)*4);
      const head = decoded.readFloatLE((frame*2+channel)*4);
      blend.writeFloatLE(tail*(1-mix)+head*mix, (frame*2+channel)*4);
    }
  }
  const raw = 'outputs/completion/score-pcm/' + track.role + '.f32';
  await writeFile(raw, Buffer.concat([body,blend]));
  const pcm = 'outputs/completion/score-pcm/' + track.role + '.wav';
  execFileSync(ffmpeg.path, ['-y','-hide_banner','-loglevel','error','-f','f32le','-ar','44100','-ac','2','-i',raw,'-c:a','pcm_f32le',pcm], { stdio:'pipe' });
  const analysis = spawnSync(ffmpeg.path, ['-hide_banner','-i',pcm,'-af','loudnorm=I=-20:LRA=11:TP=-2:print_format=json','-f','null','-'], { encoding:'utf8' });
  if (analysis.status !== 0) throw new Error(JSON.stringify({ status:analysis.status, signal:analysis.signal, error:analysis.error }) + '\n' + analysis.stderr);
  const matches = [...analysis.stderr.matchAll(/\{[^{}]*"input_i"[^{}]*\}/gs)];
  const measured = JSON.parse(matches.at(-1)?.[0] ?? 'null');
  if (!measured || !Number.isFinite(Number(measured.input_i))) throw new Error('Unmeasurable score: ' + track.role);
  const normal = `loudnorm=I=-20:LRA=11:TP=-2:measured_I=${measured.input_i}:measured_LRA=${measured.input_lra}:measured_TP=${measured.input_tp}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
  for (const ext of ['mp3','ogg']) {
    const file = 'public/audio/v100/score/' + track.role + '.' + ext;
    execFileSync(ffmpeg.path, ['-y','-hide_banner','-loglevel','error','-i',pcm,'-af',normal,'-ar','44100','-ac','2','-c:a',ext === 'mp3' ? 'libmp3lame' : 'libvorbis',...(ext === 'mp3' ? ['-b:a','128k'] : ['-q:a','4']),file], { stdio:'pipe' });
    const bytes = await readFile(file);
    records.push({ role:track.role, file, bytes:bytes.length, sha256:hash(bytes), durationSeconds:d-2,
      sourceFile:input, sourceSha256:hash(await readFile(input)), title:track.title,
      sourcePage:'https://www.scottbuckley.com.au/library/' + track.page + '/',
      sourceStartSeconds:track.start, crossfadeSeconds:2, normalization:normal, analysis:measured });
  }
  console.log(track.role + ': ' + (d-2) + ' seconds');
}
await writeFile(root + '/production-provenance.json', JSON.stringify({
  creator:'Scott Buckley', license:'CC-BY-4.0', licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  usageUrl:'https://www.scottbuckley.com.au/library/using-this-music/',
  acceptance:'Normal battle and daily conversation direction approved 2026-09-09. Producer requested an exciting opening track 2026-10-10; Born Of The Sky is the implementation candidate. Remaining scene assignments require play review; boss music unchanged.',
  adaptation:'Official compositions excerpted, stereo loop seams crossfaded, two-pass loudness normalization. Not newly composed by this project.',
  ffmpegVersion:execFileSync(ffmpeg.path,['-version'],{encoding:'utf8'}).split('\n')[0], records,
}, null, 2) + '\n');
const opening = records.find(record => record.role === 'opening' && record.file.endsWith('.mp3'));
if (opening) await writeFile('scripts/v100-opening-asset-contract.mjs',
  '// Exact title-music delta from the attributed source and derivative provenance.\n'
  + 'export const V100_OPENING_ASSET_ADDITIONS = Object.freeze(' + JSON.stringify([
    {path:opening.file.slice('public'.length),bytes:opening.bytes,hash:'sha256-'+opening.sha256,criticality:'optional'},
  ],null,2) + ');\nexport const V100_OPENING_ASSET_BYTES = ' + opening.bytes + ';\n');
const unique = V100_MUSIC_TRACKS.filter((t,i,a)=>a.findIndex(o=>o.file===t.file)===i);
await writeFile(root + '/LICENSE.md', '# Scene music sources\n\n' + unique.map(t=>"- '" + t.title + "' by Scott Buckley - released under CC-BY 4.0. https://www.scottbuckley.com.au/library/" + t.page + '/').join('\n')
  + '\n\nLicense: https://creativecommons.org/licenses/by/4.0/\nUsage: https://www.scottbuckley.com.au/library/using-this-music/\n\nFree official MP3 downloads; no purchase, subscription, account or Content ID registration. Originals remain Scott Buckley compositions. Adapted excerpts, stereo loop seams and loudness for synchronized game use. See production-provenance.json for exact source/derivative hashes and processing. In-game credits appear under 制作・素材クレジット.\n');
