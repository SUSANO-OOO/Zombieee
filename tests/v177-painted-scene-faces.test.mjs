import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import ts from 'typescript';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {V177_STORY_DETAIL_SHOTS,v177StoryDetailShotFor,v177StoryImagePositionFor} from '../app/v177StoryDetailShots.js';
import {inspectV177PaintedSceneFaces,readV177PaintedSceneImage,readV177PaintedSceneSource} from '../scripts/v177-painted-scene-geometry.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/v177-s01-composition-d28.json',import.meta.url)));
const shot=V177_STORY_DETAIL_SHOTS['s01-nao-rescue'];
const copy=value=>JSON.parse(JSON.stringify(value));

function repaired(row){
  const geometry=copy(row.geometry),frame=geometry.detailShots[0].frame,innerWidth=geometry.scene.width-2;
  geometry.paintedImage.objectPosition=v177StoryImagePositionFor(geometry.paintedImage.src);
  const compact=row.viewport.height<=430;
  frame.width=compact?Math.max(170,Math.min(240,row.viewport.width*.26)):frame.width;
  frame.x=geometry.scene.right-1-(compact?16:innerWidth*.035)-frame.width;
  frame.right=frame.x+frame.width;
  return geometry;
}

function compile(name,file,context){
  const source=fs.readFileSync(new URL('../app/'+file,import.meta.url),'utf8');
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
  assert.ok(fn);
  const code=ts.transpileModule(fn.getText(tree).replace(/^export /u,'')+'\n'+name+';',{
    compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React},
  }).outputText;
  return vm.runInNewContext(code,context);
}

test('the face landmarks are bound to the exact revised painting and its source coordinates',()=>{
  const bytes=fs.readFileSync(new URL('../public/art/v100/story-r9/cuts/s01-nao-rescue.webp',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),shot.landmarkSourceHash);
  assert.deepEqual(shot.landmarks.map(m=>m.id),['paisen-face','nao-face']);
  for(const mark of shot.landmarks){
    const [x,y,w,h]=mark.rect;
    assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1280&&y+h<=720);
  }
  assert.equal(v177StoryImagePositionFor('/Zombieee/art/v100/story-r9/cuts/s01-nao-rescue.webp?v=1'),'50% 0%');
  for(const other of Object.values(V177_STORY_DETAIL_SHOTS).filter(s=>s!==shot))
    assert.equal(v177StoryImagePositionFor('/art/v100/story-r9/cuts/'+other.id+'.webp'),undefined);
});

test('the captured compact scene rectangles reproduce the clipped or covered Paisen face in the old cover layout',()=>{
  assert.equal(fixture.head,'d28dcdff7ebcafadf90dbb65d58b7c77edca0005');
  assert.match(fixture.projectionInputs,/not native face acceptance/);
  for(const row of fixture.rows){
    const result=inspectV177PaintedSceneFaces(shot,row.geometry);
    if(row.viewport.height<=430){
      assert.ok(result.issues.some(s=>s==='paisen-face: covered by heading'));
      if(row.viewport.height===340)assert.ok(result.issues.some(s=>s==='paisen-face: covered by detail:s01-nao-rescue'));
    }else assert.deepEqual(result.issues,[]);
  }
});

test('the revised camera and edge dock leave both face cores clear in all three captured target sizes',()=>{
  assert.equal(fixture.rows.length,3);
  for(const row of fixture.rows){
    const result=inspectV177PaintedSceneFaces(shot,repaired(row));
    assert.equal(result.applicable,true);
    assert.equal(result.faces.length,2);
    assert.deepEqual(result.issues,[],JSON.stringify(row.viewport));
  }
});

test('restoring either the centered crop or the left close-up independently reintroduces the compact occlusion',()=>{
  for(const row of fixture.rows.filter(r=>r.viewport.height<=430)){
    const centered=repaired(row);centered.paintedImage.objectPosition='50% 50%';
    assert.ok(inspectV177PaintedSceneFaces(shot,centered).issues.length>0);
    const left=repaired(row);left.detailShots[0].frame=copy(row.geometry.detailShots[0].frame);
    assert.ok(inspectV177PaintedSceneFaces(shot,left).issues.includes('paisen-face: covered by detail:s01-nao-rescue'));
  }
});

test('the actual backdrop and detail components bind the current and previous image positions separately',()=>{
  const context={React,useId:React.useId,v177StoryDetailShotFor};
  const Detail=compile('V177StoryDetailShot','V177StoryDetailShot.tsx',context);
  const current='/Zombieee/art/v100/story-r9/cuts/s01-nao-rescue.webp';
  const previous='/Zombieee/art/v100/story-r9/cuts/s09-transfer-disconnect.webp';
  const Backdrop=compile('V100EventBackdrop','V100EventBackdrop.tsx',{
    React,V177StoryDetailShot:Detail,v177StoryImagePositionFor,
    useState:()=>[{current,previous,description:'救護場面'},()=>{}],
    useRef:value=>({current:value}),useEffect:()=>{},useLayoutEffect:()=>{},
  });
  const html=renderToStaticMarkup(React.createElement(Backdrop,{src:current}));
  const images=[...html.matchAll(/<img\b[^>]*>/gu)].map(m=>m[0]);
  assert.equal(images.length,2);
  assert.ok(images[0].includes(previous)&&!images[0].includes('object-position'));
  assert.ok(images[1].includes(current)&&images[1].includes('object-position:50% 0%'));
  assert.ok(html.includes('background-position:50% 0%'));
  assert.ok(/data-v177-story-detail="s01-nao-rescue"[^>]*data-side="right"[^>]*data-compact-edge="true"/u.test(html));
});

test('unloaded, wrong-source, unsupported-fit, rotated and unmeasured image layouts cannot pass face QA',()=>{
  const base=repaired(fixture.rows[0]);
  const changes=[
    {complete:false},{src:'/art/v100/story-r9/cuts/s09-transfer-disconnect.webp'},
    {naturalWidth:64},{objectFit:'contain'},{axisAligned:false},
    {objectPosition:'calc(50% + 10px) 0%'},{layoutWidth:0},{opacity:.5},{visibility:'hidden'},{display:'none'},
  ];
  for(const change of changes){
    const geometry=copy(base);Object.assign(geometry.paintedImage,change);
    assert.ok(inspectV177PaintedSceneFaces(shot,geometry).issues.length>0);
  }
  assert.ok(inspectV177PaintedSceneFaces(shot,{}).issues.length>0);
  for(const field of ['scene','copy','headingBox']){
    const geometry=copy(base);geometry[field]=null;
    assert.ok(inspectV177PaintedSceneFaces(shot,geometry).issues.length>0);
  }
  const unmeasured=copy(base);unmeasured.detailShots=[];
  assert.ok(inspectV177PaintedSceneFaces(shot,unmeasured).issues.length>0);
  const invalidOrigin=copy(base);invalidOrigin.paintedImage.rect.x=NaN;
  assert.ok(inspectV177PaintedSceneFaces(shot,invalidOrigin).issues.length>0);
  assert.deepEqual(inspectV177PaintedSceneFaces(null,{}),{applicable:false,faces:[],issues:[]});
});

test('the native image reader observes decoded source, actual geometry and CSS without mutating any element',()=>{
  const base=repaired(fixture.rows[0]).paintedImage;
  const element={parentElement:null,querySelector:selector=>{
    assert.equal(selector,'.v100-event-image:not(.v100-event-image-previous)');return image;
  }};
  const image=Object.freeze({...base,parentElement:element,currentSrc:base.src,
    getBoundingClientRect:()=>({...base.rect,right:base.rect.x+base.rect.width,bottom:base.rect.y+base.rect.height})});
  const reader=vm.runInNewContext('('+readV177PaintedSceneImage.toString()+')',{
    getComputedStyle:node=>node===image?{width:base.layoutWidth+'px',height:base.layoutHeight+'px',
      objectFit:base.objectFit,objectPosition:base.objectPosition,opacity:'1',visibility:'visible',display:'block',transform:'none'}:{transform:'none'},
  });
  const observed=reader(element);
  assert.equal(observed.src,base.src);assert.equal(observed.complete,true);
  assert.equal(observed.axisAligned,true);assert.equal(observed.objectPosition,'50% 0%');
  assert.equal(observed.layoutWidth,base.layoutWidth);
});

test('the browser source reader hashes the actual served painting and refuses other origins or failed responses',async()=>{
  const origin='http://127.0.0.1:45547',src=origin+'/art/v100/story-r9/cuts/s01-nao-rescue.webp';
  const bytes=fs.readFileSync(new URL('../public/art/v100/story-r9/cuts/s01-nao-rescue.webp',import.meta.url));
  const image={complete:true,naturalWidth:1280,currentSrc:src};
  const element={querySelector:()=>image};let calls=0;
  const context={URL,crypto:webcrypto,location:{origin,href:origin+'/'},fetch:async(url,options)=>{
    calls++;assert.equal(url,src);assert.equal(options.cache,'force-cache');
    return {ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  }};
  const reader=vm.runInNewContext('('+readV177PaintedSceneSource.toString()+')',context);
  const actual=await reader(element);
  assert.equal(actual.sha256,shot.landmarkSourceHash);assert.equal(actual.bytes,bytes.length);
  image.currentSrc='https://external.invalid/s01-nao-rescue.webp';
  await assert.rejects(()=>reader(element),/same asset origin/u);assert.equal(calls,1);
  image.currentSrc=src;image.complete=false;
  await assert.rejects(()=>reader(element),/not decoded/u);assert.equal(calls,1);
  image.complete=true;context.fetch=async()=>({ok:false,status:404});
  await assert.rejects(()=>reader(element),/fetch failed: 404/u);
});
