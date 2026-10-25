import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load as yaml} from 'js-yaml';
import {nativeRecordingBrowserType,NATIVE_RECORDING_WEBKIT_RUNTIME} from '../scripts/v177-native-allunit-recording-runtime.mjs';
import {PWA_WEBKIT_RUNTIME} from '../scripts/pwa-browser-runtime.mjs';

test('native recording binds its fixed writer browser while PWA and formal rendering retain their baselines',async()=>{
  const pkg=JSON.parse(readFileSync('scripts/native-recording-runtime/package.json'));
  assert.equal(pkg.dependencies.playwright,'1.65.0-alpha-2026-10-23');
  assert.deepEqual(NATIVE_RECORDING_WEBKIT_RUNTIME,{packageVersion:'1.65.0-alpha-2026-10-23',revision:'2380',browserVersion:'27.2'});
  assert.deepEqual(PWA_WEBKIT_RUNTIME,{packageVersion:'1.63.0',revision:'2359',browserVersion:'26.6'});
  assert.equal(JSON.parse(readFileSync('package.json')).devDependencies.playwright,'1.56.1');
  const workflow=yaml(readFileSync('.github/workflows/native-allunit-capture.yml','utf8'));
  const install=workflow.jobs.capture.steps.find(s=>s.name==='Install pinned native WebKit').run;
  assert.match(install,/npm ci --prefix scripts\/native-recording-runtime/u);
  assert.match(install,/native-recording-runtime\/node_modules\/playwright\/cli\.js install webkit/u);
  const corrections=yaml(readFileSync('.github/workflows/five-corrections-capture.yml','utf8'));
  assert.ok(corrections.jobs.capture.steps.some(s=>s.run==='npm ci --prefix scripts/native-recording-runtime'));
  assert.ok(corrections.jobs.capture.steps.some(s=>s.run==='node scripts/native-recording-runtime/node_modules/playwright/cli.js install webkit'));
  const capture=readFileSync('scripts/v105-five-corrections-capture.mjs','utf8');
  assert.match(capture,/await\(await nativeRecordingBrowserType\(\)\)\.launch/u);
  assert.match(capture,/runtime:NATIVE_RECORDING_WEBKIT_RUNTIME/u);
  assert.doesNotMatch(capture,/pwaBrowserType|PWA_WEBKIT_RUNTIME/u);
  const calls=[],webkit={executablePath:()=>'/fixed/webkit-2380/pw_run.sh'};
  const read=async url=>{calls.push(url.href);return JSON.stringify(url.pathname.endsWith('playwright/package.json')
    ?{version:'1.65.0-alpha-2026-10-23'}:{browsers:[{name:'webkit',revision:'2380',browserVersion:'27.2'}]});};
  assert.equal(await nativeRecordingBrowserType({read,load:async url=>{calls.push(url);return{webkit};}}),webkit);
  assert.ok(calls.every(url=>url.includes('/scripts/native-recording-runtime/node_modules/')));
});

test('native recording rejects package, revision, version and OS fallback mismatches before launch',async()=>{
  for(const fault of ['package','revision','version','fallback']){
    let loaded=false;
    const read=async url=>JSON.stringify(url.pathname.endsWith('playwright/package.json')
      ?{version:fault==='package'?'1.63.0':'1.65.0-alpha-2026-10-23'}
      :{browsers:[{name:'webkit',revision:fault==='revision'?'2359':'2380',browserVersion:fault==='version'?'26.6':'27.2'}]});
    await assert.rejects(nativeRecordingBrowserType({read,load:async()=>{loaded=true;return{webkit:{executablePath:()=>'/old/webkit-2251/pw_run.sh'}};}}));
    assert.equal(loaded,fault==='fallback');
  }
});
