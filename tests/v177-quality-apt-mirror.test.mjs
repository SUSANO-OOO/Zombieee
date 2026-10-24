import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load} from 'js-yaml';
import {assertQualityMirrorHost,qualityMirrorText} from '../scripts/v177-quality-apt-mirror.mjs';

const azure='http://azure.archive.ubuntu.com/ubuntu/';
const archive='https://archive.ubuntu.com/ubuntu/';
const fixture='# runner mirror priorities\n# '+azure+'\n'+azure+'\tpriority:1\n'+archive+'\tpriority:2\nhttps://security.ubuntu.com/ubuntu/\tpriority:3\n';
test('only the known Azure URI changes; priority, comments, security and line endings stay exact',()=>{
  for(const before of [fixture,fixture.replaceAll('\n','\r\n')]){
    const after=qualityMirrorText(before);assert.equal(after,before.replace(azure+'\tpriority:1',archive+'\tpriority:1'));
    assert.equal(qualityMirrorText(after),after,'already-selected official archive is idempotent');
  }
});
test('unknown mirror configurations fail before any privileged operation',()=>{
  for(const bad of [fixture.replace(azure+'\tpriority:1','https://unknown.invalid/ubuntu/\tpriority:1'),fixture.replace('priority:1','priority:9'),
    fixture.replace('priority:2','priority:1'),fixture.replace('https://security.ubuntu.com/ubuntu/','http://other.invalid/'),
    fixture+'https://extra.invalid/\tpriority:4\n',fixture.split('\n').slice(0,-2).join('\n')])
    assert.throws(()=>qualityMirrorText(bad));
});
test('local and unrelated jobs cannot change host APT configuration',()=>{
  const env={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Linux',
    GITHUB_JOB:'quality-ui-play',V177_QUALITY_ENGINE:'webkit',GITHUB_REPOSITORY:'SUSANO-OOO/Zombieee'};
  assert.doesNotThrow(()=>assertQualityMirrorHost(env,'linux'));
  for(const key of Object.keys(env))assert.throws(()=>assertQualityMirrorHost({...env,[key]:'unexpected'},'linux'));
  assert.throws(()=>assertQualityMirrorHost(env,'win32'));
  assert.throws(()=>assertQualityMirrorHost(env,'darwin'));
});
test('mirror preparation is WebKit-only and retains the original runtime, checks and deadlines',()=>{
  const job=load(readFileSync('.github/workflows/v1-quality-acceptance.yml','utf8')).jobs['quality-ui-play'];
  const index=job.steps.findIndex(step=>step.name==='Select official Ubuntu mirror for WebKit preparation');
  assert.ok(index>0);const step=job.steps[index];
  assert.equal(step.if,"${{ matrix.engine == 'webkit' }}");
  assert.equal(step.run,'node scripts/v177-quality-apt-mirror.mjs');
  assert.equal(step.env.V177_QUALITY_ENGINE,'${{ matrix.engine }}');
  assert.equal(job.steps[index+1].name,'Install dependencies and browser');
  assert.equal(job['timeout-minutes'],45);assert.deepEqual(job.strategy.matrix.engine,['chromium','webkit']);
  assert.match(job.steps[index+1].run,/node scripts\/pwa-native-runtime\/node_modules\/playwright\/cli\.js install --with-deps webkit/u);
  const verify=job.steps.find(item=>item.name==='Check three viewports, rewards, recovery and native inputs');
  assert.equal(verify.env.V100_QUALITY_LOOP_SIZES,'1280x720,844x390,844x340');
  assert.match(verify.run,/timeout --signal=TERM --kill-after=30s 35m node scripts\/v100-quality-loop-browser\.mjs/u);
  assert.equal(JSON.parse(readFileSync('scripts/pwa-native-runtime/package.json')).dependencies.playwright,'1.63.0');
});
