// Source-preserving codec packaging of recorded manual-ability preparations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {V100_MANUAL_ABILITY_FOLEY} from '../app/v100ManualAbilityFoley.js';

const root=path.resolve(import.meta.dirname,'..'),check=process.argv.includes('--check');
const sourceDir='assets/source/quality-20261114/audio/manual-foley-r1';
const recipe=JSON.parse(await fs.readFile(path.join(root,sourceDir,'recipe.json'),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function emit(relative,bytes){
  const file=path.join(root,relative);
  if(check){const actual=await fs.readFile(file);assert.deepEqual(relative.endsWith('.json')?Buffer.from(actual.toString('utf8').replaceAll('\r\n','\n')):actual,bytes,relative);}
  else{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
}
assert.deepEqual(recipe.records.map(r=>r.id).sort(),Object.keys(V100_MANUAL_ABILITY_FOLEY).sort());
for(const notice of recipe.notices)assert.equal(hash(await fs.readFile(path.join(root,notice.path))),notice.sha256);
const temporary=await fs.mkdtemp(path.join(root,'output/.manual-foley-build-'));
assert.ok(path.resolve(temporary).startsWith(path.resolve(root,'output')+path.sep));
const records=[];
for(const row of recipe.records){
  const profile=V100_MANUAL_ABILITY_FOLEY[row.id],master=path.join(root,row.master.path);
  assert.equal(profile.duration,row.duration);assert.equal(hash(await fs.readFile(master)),row.master.sha256);
  for(const layer of row.layers)assert.equal(hash(await fs.readFile(path.join(root,layer.path))),layer.sha256);
  const encodings=[];
  for(const ext of ['mp3','ogg']){
    const tmp=path.join(temporary,profile.name+'.'+ext);
    execFileSync(ffmpeg.path,['-v','error','-nostdin','-i',master,'-map_metadata','-1','-ac','1','-ar','48000',
      ...(ext==='mp3'?['-c:a','libmp3lame','-b:a','160k']:['-c:a','libvorbis','-q:a','5']),'-fflags','+bitexact',tmp],
    {windowsHide:true,maxBuffer:1024*1024});
    const bytes=await fs.readFile(tmp),relative='public/audio/quality-20261114/manual/'+profile.name+'.'+ext;
    await emit(relative,bytes);encodings.push({path:relative,bytes:bytes.length,sha256:hash(bytes)});
    await fs.unlink(tmp);
  }
  records.push({...row,encodings});
}
await fs.rmdir(temporary);
await emit(sourceDir+'/provenance.json',Buffer.from(JSON.stringify({creator:'Kenney; layered and mastered by Codex under Producer direction',
  license:'CC0-1.0',commercialUse:true,modification:true,redistribution:true,notices:recipe.notices,
  recipe:{path:sourceDir+'/recipe.json',sha256:hash(Buffer.from((await fs.readFile(path.join(root,sourceDir,'recipe.json'),'utf8')).replaceAll('\r\n','\n')))},
  authorization:'Current smartphone quality goal: replace inappropriate electronic preparation sounds with character-specific material foley.',
  adaptation:'Existing licensed recordings only; source masters, exact layer timing/filter/dynamics and hashes retained. No voice, new contact event or actor substitution.',
  subjectiveListening:'not performed; implementation candidate, not final sound or physical-speaker acceptance',
  formats:{preferred:'mp3',fallback:'ogg',sampleRate:48000,channels:1},records},null,2)+'\n'));
console.log(JSON.stringify({check,cues:records.length,files:records.reduce((n,r)=>n+r.encodings.length,0),bytes:records.flatMap(r=>r.encodings).reduce((n,r)=>n+r.bytes,0)}));
