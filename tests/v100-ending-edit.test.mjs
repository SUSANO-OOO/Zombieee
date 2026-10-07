import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { V100_CREDITS_FILM } from '../app/v100CreditsFilm.js';
import { v100CreditsCameraStyle } from '../app/v100CreditsFilmEdit.js';
import { V100_CREDITS_SONG, v100StaffRollFrame } from '../app/v100StaffRoll.js';
import { V100_POST_CREDITS_AUDIO, V100_POST_CREDITS_SHOTS, V100_POST_CREDITS_LAUGH_CUE, v100PostCreditsFrame } from '../app/v100PostCreditsData.js';

test('the expanded film keeps all saved scenes and visits every cut in order', () => {
  assert.deepEqual([...new Set(V100_CREDITS_FILM.map(shot => shot.sceneIndex))], Array.from({length:11},(_,i)=>i));
  assert.equal(new Set(V100_CREDITS_FILM.map(shot=>shot.id)).size,V100_CREDITS_FILM.length);
  assert.equal(new Set(V100_CREDITS_FILM.map(shot=>shot.src)).size,38);
  assert.deepEqual(V100_CREDITS_FILM.find(shot=>shot.id==='segawa-record').actors,['segawa']);
  assert.match(V100_CREDITS_FILM.find(shot=>shot.id==='segawa-record').description,/研究記録/u);
  const visited=[];
  let previous=-1;
  for(let seconds=0;seconds<=V100_CREDITS_SONG.duration;seconds+=.01){
    const frame=v100StaffRollFrame(seconds,V100_CREDITS_SONG.duration,11);
    assert.ok(frame.shotIndex>=previous);
    assert.ok(Number.isFinite(frame.withinShot)&&frame.withinShot>=0&&frame.withinShot<=1);
    assert.ok(Number.isFinite(frame.blend)&&frame.blend>=0&&frame.blend<=1);
    assert.equal(V100_CREDITS_FILM[frame.shotIndex].sceneIndex,frame.index);
    if(frame.shotIndex!==previous)visited.push(frame.shotIndex);
    previous=frame.shotIndex;
  }
  assert.deepEqual(visited,V100_CREDITS_FILM.map((_,i)=>i));
});

test('all selected cameras remain finite and reduced motion keeps the frame still', () => {
  for(const shot of V100_CREDITS_FILM){
    assert.ok(shot.camera,shot.id);
    const fixed=v100CreditsCameraStyle(shot.camera,0,true);
    for(const progress of [-100,0,.25,.5,1,100,NaN]){
      const style=v100CreditsCameraStyle(shot.camera,progress);
      const scale=Number(style.transform.match(/scale\(([^)]+)\)/u)[1]);
      assert.ok(Number.isFinite(scale)&&scale>=1&&scale<=1.4,shot.id);
      assert.deepEqual(v100CreditsCameraStyle(shot.camera,progress,true),fixed);
    }
  }
});

test('detail and gag entrances hold the previous picture until the cut', () => {
  let previous = v100StaffRollFrame(0, V100_CREDITS_SONG.duration, 11);
  const entrances = new Set();
  for (let seconds = .01; seconds <= V100_CREDITS_SONG.duration; seconds += .01) {
    const frame = v100StaffRollFrame(seconds, V100_CREDITS_SONG.duration, 11);
    if (frame.shotIndex !== previous.shotIndex && V100_CREDITS_FILM[frame.shotIndex].transition === 'cut') {
      assert.equal(previous.blend, 0, V100_CREDITS_FILM[frame.shotIndex].id);
      entrances.add(V100_CREDITS_FILM[frame.shotIndex].id);
    }
    previous = frame;
  }
  assert.ok(entrances.has('segawa-record'));
  assert.ok(entrances.has('ward-radio-hands'));
  assert.ok(entrances.has('kumaya-mayo-nose'));
});

test('helmet afloat precedes the face and the laugh window ends before the title cards', () => {
  const ids=V100_POST_CREDITS_SHOTS.map(shot=>shot.id);
  assert.ok(ids.indexOf('helmet-afloat')<ids.indexOf('ogata-reveal'));
  assert.equal(V100_POST_CREDITS_SHOTS.find(shot=>shot.id==='infected-eyes').src,V100_POST_CREDITS_SHOTS.find(shot=>shot.id==='ogata-reveal').src);
  assert.equal(ids.at(-1),'ogata-grin');
  assert.ok(V100_POST_CREDITS_LAUGH_CUE>V100_POST_CREDITS_SHOTS.at(-1).start);
  assert.equal(v100PostCreditsFrame(V100_POST_CREDITS_LAUGH_CUE-.01).laughGain,0);
  assert.ok(v100PostCreditsFrame(V100_POST_CREDITS_LAUGH_CUE+.5).laughGain>0);
  assert.equal(v100PostCreditsFrame(38).laughGain,0);
  assert.equal(v100PostCreditsFrame(39).imageOpacity,0);
  assert.equal(v100PostCreditsFrame(40).text,'continuation');
  assert.equal(v100PostCreditsFrame(48).text,'sequel');
  assert.equal(v100PostCreditsFrame(57).text,'thanks');
  assert.equal(v100PostCreditsFrame(56).musicGain,0);
  for(let seconds=0;seconds<=64;seconds+=.1){
    const frame=v100PostCreditsFrame(seconds);
    for(const key of ['imageOpacity','titleOpacity','wavesGain','musicGain','laughGain'])assert.ok(Number.isFinite(frame[key])&&frame[key]>=0&&frame[key]<=1,key);
  }
});

test('the new laugh has exact source-bound bytes, one offline SE asset and attribution', async () => {
  const provenance=JSON.parse(await readFile('assets/source/v100/audio/adiantheman-evil-laugh/provenance.json','utf8'));
  const bytes=await readFile('public'+V100_POST_CREDITS_AUDIO.laugh);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'988a67ff68d67445174cb080ed168082e957eaf6c9dc6370ac5d37b72a26cbbf');
  assert.match(JSON.stringify(provenance),/CC0/u);
  const manifest=JSON.parse(await readFile('public/asset-manifest.json','utf8'));
  const rows=manifest.assets.filter(asset=>asset.path===V100_POST_CREDITS_AUDIO.laugh);
  assert.equal(rows.length,1);assert.equal(rows[0].audioChannel,'se');assert.equal(rows[0].criticality,'optional');
  assert.ok(!manifest.assets.some(asset=>/codex-remote-attachments|写真[1-8]/u.test(asset.path)));
  const credits=await readFile('app/v100CreditSources.js','utf8');
  assert.match(credits,/adiantheman/u);assert.match(credits,/Evil Laugh/u);
});
