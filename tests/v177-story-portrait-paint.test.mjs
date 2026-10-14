import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {readV177StoryPortraitPaint} from '../scripts/v177-story-portrait-paint.mjs';

function fixture(overrides={}) {
  const state={opacity:'1',visibility:'visible',display:'block',...overrides};
  const image={src:'paisen-warm-r2.webp',currentSrc:'paisen-warm-r2.webp',
    complete:true,naturalWidth:512,naturalHeight:640,
    getBoundingClientRect:()=>({width:294.46875,height:368.078125}),
    getAnimations:()=>state.animations??[],...overrides.image};
  const scene={isConnected:true,querySelectorAll:()=>[image]};
  const context=vm.createContext({document:{querySelector:()=>scene},getComputedStyle:()=>state});
  const observe=vm.runInContext('('+readV177StoryPortraitPaint.toString()+')',context);
  return {state,image,scene,context,observe};
}

test('decoded native portrait is still rejected during zero and partial opacity entrance frames',()=>{
  for(const opacity of ['0','.12','.67']) {
    const f=fixture({opacity,animations:[{animationName:'v100-event-dissolve',playState:'running',pending:false}]});
    assert.equal(f.image.complete&&f.image.naturalWidth>0,true,'the previous load-only observation accepts this unpainted frame');
    assert.equal(f.observe('.scene'),false);
    f.state.opacity='1';
    assert.equal(f.observe('.scene'),false,'full opacity alone cannot bypass an unfinished entrance');
    f.state.animations[0].playState='finished';
    const result=f.observe('.scene');assert.equal(result.nativePaintReady,true);
    assert.equal(result.portraits[0].opacity,1);
    assert.equal(result.portraits[0].source,'paisen-warm-r2.webp');
  }
});

test('missing, failed, hidden, zero-size, pending or stalled portrait cannot become a valid capture',()=>{
  const variants=[{image:{complete:false}},{image:{naturalWidth:0}},
    {image:{naturalHeight:0}},{visibility:'hidden'},{display:'none'},
    {opacity:'0'},{image:{getBoundingClientRect:()=>({width:0,height:0})}},
    {animations:[{playState:'finished',pending:true}]},
    {animations:[{playState:'paused',pending:false}]}];
  for(const state of variants)assert.equal(fixture(state).observe('.scene'),false);
  const f=fixture();f.scene.isConnected=false;assert.equal(f.observe('.scene'),false);
  f.context.document.querySelector=()=>null;assert.equal(f.observe('.scene'),false);
});

test('illustrated scene with no separate portraits retains its native capture path',()=>{
  const f=fixture();f.scene.querySelectorAll=()=>[];
  const result=f.observe('.scene');assert.equal(result.nativePaintReady,true);
  assert.equal(result.portraitCount,0);
});

test('actual hosted caller waits for the serialized observer before geometry and screenshot without changing its deadline',async()=>{
  const source=await readFile(new URL('../scripts/v100-dialogue-composition-browser.mjs',import.meta.url),'utf8');
  const block=source.match(/   const portraitPaint = await page\.waitForFunction\(readV177StoryPortraitPaint,[\s\S]*?finally \{ await portraitPaint\.dispose\(\); \}/u)?.[0];
  assert.ok(block,'the production hosted capture must use the native paint observer');
  assert.ok(source.indexOf(block)<source.indexOf('const geometry=await scene.evaluate'));
  assert.ok(source.indexOf(block)<source.indexOf('await page.screenshot({path:out+'));
  assert.ok(source.includes('page.setDefaultTimeout(20000)'));
  assert.ok(source.includes("if(process.platform==='win32')throw new Error"));
  const f=fixture({opacity:'0',animations:[{playState:'running',pending:false}]});
  let disposed=false,polls=0;
  f.context.readV177StoryPortraitPaint=f.observe;f.context.fixture={eventId:'v100:event:prologue'};
  f.context.result={};f.context.page={waitForFunction:async(fn,selector)=>{
    assert.equal(selector,'[data-v100-event-id="v100:event:prologue"]');
    assert.equal(fn(selector),false);polls++;
    f.state.opacity='1';f.state.animations[0].playState='finished';
    const actual=fn(selector);assert.equal(actual.nativePaintReady,true);polls++;
    return {jsonValue:async()=>actual,dispose:async()=>{disposed=true;}};
  }};
  await vm.runInContext('(async()=>{'+block+'})()',f.context);
  assert.equal(polls,2);assert.equal(disposed,true);
  assert.equal(f.context.result.portraitPaint.portraits[0].opacity,1);
});
