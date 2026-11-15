import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {V100_BOSS_SKILL_AUDIO} from '../app/v100BossSkillAudio.js';

const root=path.resolve(import.meta.dirname,'..'),check=process.argv.includes('--check');
const sourceDir='assets/source/quality-20261116/audio/boss-skills-r1';
const recipeBytes=await fs.readFile(path.join(root,sourceDir,'recipe.json'));
const recipe=JSON.parse(recipeBytes),hash=b=>createHash('sha256').update(b).digest('hex');
assert.deepEqual(recipe.records.map(r=>r.key).sort(),Object.keys(V100_BOSS_SKILL_AUDIO).sort());
for(const notice of recipe.notices)assert.equal(hash(await fs.readFile(path.join(root,notice.path))),notice.sha256);
async function emit(relative,bytes){
  const file=path.join(root,relative);let existing;
  try{existing=await fs.readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(check){
    assert.ok(existing,relative);
    assert.deepEqual(/\.(json|js)$/.test(relative)?Buffer.from(existing.toString('utf8').replaceAll('\r\n','\n')):existing,bytes,relative);
  }else if(!existing?.equals(bytes)){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
}
await fs.mkdir(path.join(root,'output'),{recursive:true});
const temporary=await fs.mkdtemp(path.join(root,'output/.boss-skill-build-'));
assert.ok(path.resolve(temporary).startsWith(path.resolve(root,'output')+path.sep));
const records=[];
for(const row of recipe.records){
  const profile=V100_BOSS_SKILL_AUDIO[row.key],master=path.join(root,row.master.path);
  assert.equal(profile.id,row.id);assert.equal(profile.duration,row.duration);
  assert.equal(hash(await fs.readFile(master)),row.master.sha256);
  for(const layer of row.layers)assert.equal(hash(await fs.readFile(path.join(root,layer.path))),layer.sha256);
  const encodings=[];
  for(const ext of ['mp3','ogg']){
    const tmp=path.join(temporary,profile.name+'.'+ext);
    execFileSync(ffmpeg.path,['-v','error','-nostdin','-i',master,'-map_metadata','-1','-ac','1','-ar','48000',
      ...(ext==='mp3'?['-c:a','libmp3lame','-b:a','160k']:['-c:a','libvorbis','-q:a','5']),'-fflags','+bitexact',tmp],
    {windowsHide:true,maxBuffer:1024*1024});
    const bytes=await fs.readFile(tmp),relative='public/audio/quality-20261116/boss-skills/'+profile.name+'.'+ext;
    if(ext==='mp3')assert.equal('sha256-'+hash(bytes),profile.hash);
    await emit(relative,bytes);encodings.push({path:relative,bytes:bytes.length,sha256:hash(bytes)});await fs.unlink(tmp);
  }
  records.push({...row,encodings});
}
await fs.rmdir(temporary);
const saved=Object.fromEntries(records.map(r=>{const f=r.encodings.find(e=>e.path.endsWith('.mp3'));return [r.id,{path:f.path.replace(/^public/,''),hash:'sha256-'+f.sha256}];}));
await emit('app/pwaBossSkillFiles.js',Buffer.from('// Generated source metadata only; no playback dependencies.\nexport const PWA_BOSS_SKILL_FILES=Object.freeze(Object.fromEntries(Object.entries('+JSON.stringify(saved,null,2)+').map(([id,file])=>[id,Object.freeze(file)])));\n'));
await emit(sourceDir+'/provenance.json',Buffer.from(JSON.stringify({
  creators:['Kenney','Joth'],license:'CC0-1.0',commercialUse:true,modification:true,redistribution:true,
  authorization:'Active Producer goal: all nine bosses need distinctive, dramatic skills with matching warning and impact sound.',
  notices:recipe.notices,rights:recipe.rights,
  recipe:{path:sourceDir+'/recipe.json',sha256:hash(Buffer.from(recipeBytes.toString('utf8').replaceAll('\r\n','\n')))},
  adaptation:'Licensed material and designed sci-fi samples, layered for the existing skill event timings. No new voice or actor substitution.',
  subjectiveListening:'not performed; production candidate, not final listening or physical-phone acceptance',
  formats:{preferred:'mp3',fallback:'ogg',reason:'MPEG is the saved phone source; Ogg is retained for decoder compatibility, never fetched as a new uncommitted offline source.',channels:1,sampleRate:48000},
  runtime:{count:records.length*2,logicalBytes:records.flatMap(r=>r.encodings).reduce((n,e)=>n+e.bytes,0)},
  records,
},null,2)+'\n'));
console.log(JSON.stringify({check,bosses:records.length,files:records.length*2,bytes:records.flatMap(r=>r.encodings).reduce((n,e)=>n+e.bytes,0)}));
