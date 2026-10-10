import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';

// Evaluate only compiled module definitions. No DOM, React render, application
// instance, server, browser or media playback is created by this check.
test('both compiled client entry modules initialize without a catalog chunk cycle',async()=>{
  const directory=new URL('../dist/client/assets/',import.meta.url);
  const files=await readdir(directory);
  for(const prefix of ['GameEntry-','V100Campaign-']){
    const file=files.find(name=>name.startsWith(prefix)&&name.endsWith('.js'));
    assert.ok(file,`production ${prefix} entry exists`);
    const url=pathToFileURL(fileURLToPath(new URL(file,directory))).href;
    const result=spawnSync(process.execPath,['--input-type=module','-e',
      `globalThis.Audio=class{constructor(){throw new Error('Media creation is forbidden in module initialization')}};globalThis.AudioContext=globalThis.Audio;globalThis.webkitAudioContext=globalThis.Audio;await import(${JSON.stringify(url)});`],{encoding:'utf8',timeout:15000});
    assert.equal(result.status,0,`${file}: ${result.error??result.stderr}`);
  }
});
