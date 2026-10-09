import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { V100_CREDITS_FILM } from '../app/v100CreditsFilm.js';
import { v100CreditsCameraStyle } from '../app/v100CreditsFilmEdit.js';
import { V100_CREDITS_DURATION, V100_CREDITS_FADE_SECONDS, V100_CREDITS_CUES, v100CreditsOutroFrame, v100CreditScrollFrame, v100StaffRollFrame, v100StaffRollSections } from '../app/v100StaffRoll.js';
import { V100_PRODUCTION_TOOLS, V100_SOUND_CREDITS, V100_BUNDLED_LEGACY_CREDITS, V100_STORY_CAST_CREDITS } from '../app/v100CreditSources.js';
import { V100_UNITS } from '../app/v100Registry.js';
import { V100_MUSIC_TRACKS } from '../app/v100Music.js';
import { V100_POST_CREDITS_AUDIO, V100_POST_CREDITS_SHOTS, V100_POST_CREDITS_LAUGH_CUE, v100PostCreditsFrame } from '../app/v100PostCreditsData.js';

test('the 25-drawing edit keeps all saved scenes and visits every cut in order', () => {
  assert.deepEqual([...new Set(V100_CREDITS_FILM.map(shot => shot.sceneIndex))], Array.from({length:11},(_,i)=>i));
  assert.equal(new Set(V100_CREDITS_FILM.map(shot=>shot.id)).size,V100_CREDITS_FILM.length);
  assert.equal(V100_CREDITS_FILM.length,25);
  assert.equal(new Set(V100_CREDITS_FILM.map(shot=>shot.src)).size,25);
  assert.deepEqual(V100_CREDITS_FILM.find(shot=>shot.id==='segawa-record').actors,['segawa']);
  assert.match(V100_CREDITS_FILM.find(shot=>shot.id==='segawa-record').description,/研究記録/u);
  const visited=[];
  let previous=-1;
  for(let seconds=0;seconds<=V100_CREDITS_DURATION;seconds+=.01){
    const frame=v100StaffRollFrame(seconds,V100_CREDITS_DURATION,11);
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

test('the shorter film removes duplicate zoom inserts and gives each drawing time to read', () => {
  const coordinates = style => [Number(style.transform.match(/scale\(([^)]+)\)/u)[1]), ...style.origin.match(/[-\d.]+/gu).map(Number), ...style.position.match(/[-\d.]+/gu).map(Number)];
  let previous = v100StaffRollFrame(0, V100_CREDITS_DURATION, 11);
  let joins = 0;
  for (let seconds = .01; seconds <= V100_CREDITS_DURATION; seconds += .01) {
    const frame = v100StaffRollFrame(seconds, V100_CREDITS_DURATION, 11);
    if (V100_CREDITS_FILM[frame.shotIndex].src === V100_CREDITS_FILM[previous.shotIndex].src) {
      const before = coordinates(v100CreditsCameraStyle(previous.camera, previous.cameraProgress));
      const after = coordinates(v100CreditsCameraStyle(frame.camera, frame.cameraProgress));
      assert.ok(Math.abs(after[0] - before[0]) < .002, `Scale jumps at ${seconds}`);
      assert.ok(after.slice(1).every((value, index) => Math.abs(value - before[index + 1]) < .2), `Framing jumps at ${seconds}`);
      assert.deepEqual(v100CreditsCameraStyle(frame.camera, frame.cameraProgress, true), v100CreditsCameraStyle(previous.camera, previous.cameraProgress, true));
      if (frame.shotIndex !== previous.shotIndex) joins++;
    }
    previous = frame;
  }
  assert.equal(joins, 0);
  const starts = V100_CREDITS_FILM.map(shot => V100_CREDITS_CUES[shot.sceneIndex] + shot.sceneOffset);
  for (let index = 0; index < starts.length; index++) {
    assert.ok((starts[index + 1] ?? 106) - starts[index] >= 2.5, V100_CREDITS_FILM[index].id);
  }
  assert.equal(V100_CREDITS_FILM.at(-1).id, 'kumaya-main-table');
  assert.ok(106 - starts.at(-1) >= 6);
});

test('the face, eyes and grin retain their camera and illumination across cuts', () => {
  for (const cut of [26.2, 29, 31.6, 34.2]) {
    const before = v100PostCreditsFrame(cut - .00001), after = v100PostCreditsFrame(cut);
    assert.ok(Math.abs(after.scale - before.scale) < .00001);
    assert.ok(Math.abs(after.imageOpacity - before.imageOpacity) < .00001);
    const previousFocus = before.focus.match(/[\d.]+/gu).map(Number), nextFocus = after.focus.match(/[\d.]+/gu).map(Number);
    assert.ok(nextFocus.every((value, index) => Math.abs(value - previousFocus[index]) < .0001));
    assert.ok(Math.abs(after.brightness - before.brightness) < .00001);
  }
  const fixed = v100PostCreditsFrame(23.3, true);
  for (const time of [26.2, 29, 31.6, 34.2, 36]) {
    const frame = v100PostCreditsFrame(time, true);
    assert.equal(frame.scale, fixed.scale);
    assert.equal(frame.focus, fixed.focus);
  }
});

test('detail and gag entrances hold the previous picture until the cut', () => {
  let previous = v100StaffRollFrame(0, V100_CREDITS_DURATION, 11);
  const entrances = new Set();
  for (let seconds = .01; seconds <= V100_CREDITS_DURATION; seconds += .01) {
    const frame = v100StaffRollFrame(seconds, V100_CREDITS_DURATION, 11);
    if (frame.shotIndex !== previous.shotIndex && V100_CREDITS_FILM[frame.shotIndex].transition === 'cut') {
      assert.equal(previous.blend, 0, V100_CREDITS_FILM[frame.shotIndex].id);
      entrances.add(V100_CREDITS_FILM[frame.shotIndex].id);
    }
    previous = frame;
  }
  assert.ok(entrances.has('segawa-record'));
  assert.ok(entrances.has('street-paisen-broom'));
  assert.ok(entrances.has('floodgate-king-riceball'));
});

test('credits reach the complete final composition at 106s and begin a gradual audio fade', () => {
  assert.equal(v100StaffRollFrame(105.999, 315.82, 11).ended, false);
  assert.equal(v100StaffRollFrame(106, 315.82, 11).ended, true);
  assert.equal(v100StaffRollFrame(106, 315.49, 11).ended, true);
  assert.equal(v100CreditsOutroFrame(0).gain, 1);
  let previous = 1;
  for (let time = .05; time < V100_CREDITS_FADE_SECONDS; time += .05) {
    const frame = v100CreditsOutroFrame(time);
    assert.ok(frame.gain > 0 && frame.gain < previous && !frame.ended);
    previous = frame.gain;
  }
  assert.equal(v100CreditsOutroFrame(V100_CREDITS_FADE_SECONDS).gain, 0);
  assert.ok(v100CreditsOutroFrame(3.2).ended);
});

test('the complete scroll retains all people, material works, licenses and actual tools', () => {
  const sections = v100StaffRollSections();
  const text = sections.flatMap(section => section.lines).join('\n');
  assert.match(text, /K4ITo/u);
  assert.doesNotMatch(sections.map(section => section.title).join('\n') + text, /SUSANO-OOO|立ちはだかった|男性の笑い声/u);
  for (const section of V100_PRODUCTION_TOOLS) for (const name of section.lines) assert.ok(text.includes(name), name);
  const cast = [...V100_UNITS.map(unit => unit.displayName), ...V100_STORY_CAST_CREDITS.flatMap(section => section.lines)];
  assert.equal(cast.length, 41);
  for (const name of cast) assert.ok(text.includes(name), name);
  for (const credit of V100_SOUND_CREDITS) for (const value of [credit.author, credit.license, ...credit.works]) assert.ok(text.includes(value), value);
  for (const credit of V100_BUNDLED_LEGACY_CREDITS) for (const value of [credit.author, credit.work]) assert.ok(text.includes(value), value);
  for (const track of V100_MUSIC_TRACKS) assert.ok(text.includes(track.title), track.title);
  assert.match(text, /Scott Buckley · CC BY 4.0/u);
  assert.ok(sections.find(section => section.title === '効果音・ボイス・エフェクト素材').entries.some(entry => entry.author === 'adiantheman'));
  assert.ok(sections.filter(section => section.title === '音楽素材').some(section => section.entries?.some(entry => entry.author === 'nene')));
});

test('one measured scroll moves continuously and gives the final signature four seconds', () => {
  for (const [content, viewport, footer] of [[3600, 182, 104], [4400, 534, 128]]) {
    let previous = v100CreditScrollFrame(0, content, viewport, footer);
    for (let seconds = .01; seconds <= 106; seconds += .01) {
      const frame = v100CreditScrollFrame(seconds, content, viewport, footer);
      assert.ok(frame.offset <= previous.offset);
      assert.ok(previous.offset - frame.offset < 1);
      previous = frame;
    }
    const end = v100CreditScrollFrame(102, content, viewport, footer);
    assert.equal(end.offset, v100CreditScrollFrame(106, content, viewport, footer).offset);
    const footerTop = content - footer + end.offset;
    assert.ok(footerTop >= 0 && footerTop + footer <= viewport);
  }
});

test('helmet afloat precedes the face and the laugh window ends before the title cards', () => {
  const ids=V100_POST_CREDITS_SHOTS.map(shot=>shot.id);
  assert.ok(ids.indexOf('helmet-afloat')<ids.indexOf('ogata-reveal'));
  assert.equal(new Set(V100_POST_CREDITS_SHOTS.map(shot => shot.src)).size, 10);
  assert.equal(V100_POST_CREDITS_SHOTS.length, 10);
  assert.notEqual(V100_POST_CREDITS_SHOTS.find(shot=>shot.id==='infected-eyes').src,V100_POST_CREDITS_SHOTS.find(shot=>shot.id==='ogata-reveal').src);
  assert.ok(ids.indexOf('king-turn') < ids.indexOf('ogata-reveal'));
  assert.equal(ids.at(-1),'ogata-grin');
  assert.ok(V100_POST_CREDITS_LAUGH_CUE > V100_POST_CREDITS_SHOTS.find(shot => shot.id === 'crooked-smile').start);
  assert.ok(V100_POST_CREDITS_LAUGH_CUE < V100_POST_CREDITS_SHOTS.at(-1).start);
  assert.equal(v100PostCreditsFrame(V100_POST_CREDITS_LAUGH_CUE-.01).laughGain,0);
  assert.ok(v100PostCreditsFrame(V100_POST_CREDITS_LAUGH_CUE+.5).laughGain>0);
  assert.equal(v100PostCreditsFrame(38).laughGain,0);
  assert.equal(v100PostCreditsFrame(39).imageOpacity,0);
  assert.equal(v100PostCreditsFrame(39).wavesGain,0);
  assert.ok(v100PostCreditsFrame(38.9).wavesGain>0);
  assert.equal(v100PostCreditsFrame(40).text,'continuation');
  assert.equal(v100PostCreditsFrame(48).text,'sequel');
  assert.equal(v100PostCreditsFrame(57).text,'thanks');
  assert.equal(v100PostCreditsFrame(56).musicGain,0);
  for (const time of [39, 40, 48, 57, 64]) assert.equal(v100PostCreditsFrame(time).wavesGain,0);
  for(let seconds=0;seconds<=64;seconds+=.1){
    const frame=v100PostCreditsFrame(seconds);
    for(const key of ['imageOpacity','titleOpacity','wavesGain','musicGain','laughGain'])assert.ok(Number.isFinite(frame[key])&&frame[key]>=0&&frame[key]<=1,key);
  }
});

test('all ten illustrated finale cuts are source-bound and available in the offline pack', async () => {
  const provenance = JSON.parse(await readFile('assets/source/v100/runtime/ending/film-art-r3.provenance.json', 'utf8'));
  const manifest = JSON.parse(await readFile('public/asset-manifest.json', 'utf8'));
  assert.equal(provenance.selected.length, 10);
  assert.equal(provenance.generator.purelyHumanAuthorship, false);
  assert.equal(provenance.privacy.rawPhotoInputsThisPass, false);
  for (const shot of V100_POST_CREDITS_SHOTS) {
    const item = provenance.selected.find(item => item.runtime.path === shot.src);
    assert.ok(item, shot.id);
    const bytes = await readFile('public' + shot.src);
    assert.equal(bytes.length, item.runtime.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.runtime.sha256);
    assert.deepEqual([item.runtime.width, item.runtime.height], [1600, 900]);
    const offline = manifest.assets.filter(asset => asset.path === shot.src);
    assert.equal(offline.length, 1); assert.equal(offline[0].criticality, 'critical');
    assert.ok(item.finalPrompt.length > 200);
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
