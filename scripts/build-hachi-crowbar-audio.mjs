import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from '@ffmpeg-installer/ffmpeg';

const originals = 'assets/source/v100/audio';
const authoring = 'assets/source/quality-20261126/audio/hachi-crowbar';
const runtime = '/audio/quality-20261126/foley';
const rate = 44100;
const check = process.argv.includes('--check');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (args, input) => execFileSync(ffmpeg.path, ['-nostdin', '-v', 'error', ...args], { input });
const pcm = (file, filter = 'anull') => {
  const data = run(['-i', file, '-af', filter, '-ar', String(rate), '-ac', '1', '-f', 'f32le', 'pipe:1']);
  return new Float32Array(data.buffer, data.byteOffset, data.length / 4);
};
const peak = samples => samples.reduce((max, sample) => Math.max(max, Math.abs(sample)), 0);
const rms = samples => Math.sqrt(samples.reduce((sum, sample) => sum + sample ** 2, 0) / samples.length);
const recipes = [
  { id: 'hachi-crowbar-01', duration: .32, sources: [
    ['kenney-rpg/cloth2.ogg', 0, .023, 4700],
    ['kenney-impact/impactSoft_heavy_000.ogg', .013, .067, 1300],
    ['kenney-impact/impactMetal_medium_000.ogg', .018, .059, 5000],
  ] },
  { id: 'hachi-crowbar-02', duration: .36, sources: [
    ['kenney-rpg/cloth4.ogg', 0, .018, 4200],
    ['kenney-impact/impactSoft_heavy_000.ogg', .015, .073, 1200],
    ['kenney-impact/impactMetal_heavy_000.ogg', .020, .056, 4600],
  ] },
];

async function emit(file, bytes) {
  if (check) {
    const actual = await fs.readFile(file);
    const normalized = /\.(?:json|js)$/u.test(file)
      ? Buffer.from(actual.toString('utf8').replaceAll('\r\n', '\n')) : actual;
    if (!normalized.equals(bytes)) throw new Error('Hachi crowbar output differs: ' + file);
    return;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}

const metadata = {};
const recordings = [];
for (const { id, duration, sources } of recipes) {
  const output = new Float32Array(Math.round(duration * rate));
  const layers = [];
  for (const [relative, delay, gain, lowpass] of sources) {
    const file = path.join(originals, relative);
    const filter = 'highpass=f=85,lowpass=f=' + lowpass;
    const decoded = pcm(file, filter);
    const beginning = decoded.findIndex(sample => Math.abs(sample) > peak(decoded) * .035);
    if (beginning < 0) throw new Error('Missing foley transient: ' + relative);
    const samples = decoded.subarray(Math.max(0, beginning - Math.round(rate * .004)));
    const level = rms(samples.subarray(0, Math.round(rate * .14)));
    if (!(level > .0001)) throw new Error('Silent foley: ' + relative);
    const offset = Math.round(delay * rate);
    for (let n = 0; n < Math.min(samples.length, output.length - offset); n++) {
      output[n + offset] += samples[n] * gain / level;
    }
    layers.push({ file: originals + '/' + relative, sha256: sha256(await fs.readFile(file)), delay, gain, filter });
  }
  for (let n = 0; n < output.length; n++) {
    output[n] *= Math.min(1, n / (rate * .003), (output.length - n - 1) / (rate * .040));
  }
  const scale = Math.min(.080 / rms(output.subarray(0, Math.round(rate * .18))), .78 / peak(output));
  for (let n = 0; n < output.length; n++) output[n] *= scale;
  const raw = Buffer.from(output.buffer);
  const input = ['-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0'];
  const master = run([...input, '-f', 'wav', '-c:a', 'pcm_s16le', '-fflags', '+bitexact', 'pipe:1'], raw);
  // A pipe cannot seek to fill RIFF lengths. Set the two known lengths for the saved master.
  const dataOffset = master.indexOf(Buffer.from('data'));
  master.writeUInt32LE(master.length - 8, 4);
  master.writeUInt32LE(master.length - dataOffset - 8, dataOffset + 4);
  const bytes = run([...input, '-f', 'mp3', '-c:a', 'libmp3lame', '-q:a', '3', '-fflags', '+bitexact', 'pipe:1'], raw);
  const destination = runtime + '/' + id + '.mp3';
  await emit(authoring + '/' + id + '.wav', master);
  await emit('public' + destination, bytes);
  metadata[id] = { path: destination, hash: 'sha256-' + sha256(bytes) };
  recordings.push({ id, duration, layers, scale, master: { path: authoring + '/' + id + '.wav', sha256: sha256(master) },
    delivery: { ...metadata[id], bytes: bytes.length }, peak: peak(output) });
}

const notices = await Promise.all(['kenney-rpg', 'kenney-impact'].map(async name => {
  const file = originals + '/' + name + '/License.txt';
  return { file, sha256: sha256(await fs.readFile(file)) };
}));
await emit(authoring + '/provenance.json', Buffer.from(JSON.stringify({
  creator: 'Kenney', license: 'CC0-1.0', notices, adaptation: 'Fabric motion, weighted body impact and metal contact from the source material recordings. Layers trimmed and mixed at original pitch and speed.',
  commercialUse: true, modification: true, redistribution: true,
  recordings,
}, null, 2) + '\n'));
await emit('app/pwaHachiCrowbarFiles.js', Buffer.from('// Saved sound metadata. Keep playback code out of this module.\nexport const PWA_HACHI_CROWBAR_FILES = Object.freeze('
  + JSON.stringify(metadata, null, 2) + ');\n'));
console.log(JSON.stringify({ recordings: recordings.map(record => record.delivery), check }));
