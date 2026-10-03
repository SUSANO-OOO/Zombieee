import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { V100_FOLEY_RECIPES, V100_AMBIENCE_RECIPES } from '../app/v100SoundDesign.js';
const root = 'assets/source/v100/audio', records = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const run = args => execFileSync(ffmpeg.path, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'pipe' });
async function encode(folder, name, args, sources, adaptation) {
  await mkdir(`public/audio/v100/${folder}`, { recursive: true });
  for (const [ext, codec] of [['ogg', 'libvorbis'], ['mp3', 'libmp3lame']]) {
    const file = `public/audio/v100/${folder}/${name}.${ext}`;
    run([...args, '-ar', '44100', '-ac', '1', '-c:a', codec, '-q:a', ext === 'ogg' ? '4' : '3', file]);
    const bytes = await readFile(file);
    records.push({ file, bytes: bytes.length, sha256: hash(bytes), sources: await Promise.all(sources.map(async source => ({ file: source, sha256: hash(await readFile(root + '/' + source)) }))), adaptation });
  }
}
for (const [name, [source, duration, gain, cutoff]] of Object.entries(V100_FOLEY_RECIPES)) {
  // Strip lead-in room noise from recorded weapons before taking one shot.
  const trim = source.endsWith('.wav') ? 'silenceremove=start_periods=1:start_threshold=-24dB:start_silence=0.005,' : '';
  const filters = `${trim}atrim=0:${duration},asetpts=PTS-STARTPTS,highpass=f=70,lowpass=f=${cutoff},volume=${gain},afade=t=out:st=${duration - .08}:d=0.08,alimiter=limit=0.85:level=false`;
  await encode('foley', name, ['-i', root + '/' + source, '-af', filters], [source], filters);
}
for (const [name, recipe] of Object.entries(V100_AMBIENCE_RECIPES)) {
  const inputs = ['-f', 'lavfi', '-i', 'anoisesrc=color=brown:sample_rate=44100:amplitude=0.22:duration=24:seed=113'];
  for (const [file] of recipe.foley) inputs.push('-i', root + '/' + file);
  const filters = [`[0:a]highpass=f=70,lowpass=f=${recipe.lowpass},volume=${recipe.gain}[bed]`];
  recipe.foley.forEach(([, delay, gain], i) => filters.push(`[${i + 1}:a]aformat=channel_layouts=mono,highpass=f=180,lowpass=f=3400,volume=${gain},adelay=${delay},apad=whole_len=1058400[f${i}]`));
  filters.push(`[bed]${recipe.foley.map((_, i) => `[f${i}]`).join('')}amix=inputs=${recipe.foley.length + 1}:duration=first:dropout_transition=0,volume=${recipe.foley.length + 1},afade=t=in:d=0.25,afade=t=out:st=23.75:d=0.25[out]`);
  await encode('ambience', name, [...inputs, '-filter_complex', filters.join(';'), '-map', '[out]'], recipe.foley.map(([file]) => file), { bed: 'Deterministic filtered brown-noise room air, no periodic tones or alarms', ...recipe });
}
await writeFile(root + '/sound-design-provenance.json', JSON.stringify({ sources: [
  { creator: 'Kenney', packs: ['Impact Sounds', 'RPG Audio'], license: 'CC0-1.0', urls: ['https://kenney.nl/assets/impact-sounds', 'https://kenney.nl/assets/rpg-audio'], notices: ['kenney-impact/License.txt', 'kenney-rpg/License.txt'] },
  { creator: 'Joth', title: 'Chunky Explosion', license: 'CC0-1.0', url: 'https://opengameart.org/content/chunky-explosion' },
  { creator: 'Vincent Sevedge (Tabasco)', title: 'Gunshot Sounds', license: 'CC-BY-3.0', url: 'https://opengameart.org/content/gunshot-sounds', notice: 'opengameart/creativecommons.txt', note: 'Web page offers CC0; conservatively retaining archive attribution license and credit. Trimmed, filtered, attenuated and faded.' },
], records }, null, 2) + '\n');
console.log(JSON.stringify({ files: records.length, bytes: records.reduce((total, file) => total + file.bytes, 0) }));
