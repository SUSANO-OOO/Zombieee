import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import ts from 'typescript';
import {MANUAL_ABILITY_REGISTRY,createManualAbilityRuntime,beginManualAbility,advanceManualAbility} from '../app/manualAbilities.js';
import {V177_JOINT_ATLASES,v177JointPose,v177RangerFootPlan,drawV177JointPose,v177RenderedWeightedLowerReceipt,v177RenderedJointWeaponSocket,v177JointCycleDistance} from '../app/v177JointPresentation.js';
import {createV177RangerLowerPose,v177RangerLowerPose} from '../app/v177RangerLowerMotion.js';
import {createV177RangerLowerPainter,paintV177RangerLower,getV177RangerLowerPaintSnapshot} from '../app/v177RangerLowerPaint.js';
const atlas=V177_JOINT_ATLASES.ranger,rig=atlas.lowerRig,sha=b=>createHash('sha256').update(b).digest('hex');
const source='assets/source/v100/joints/ranger-r1/',motion=JSON.parse(gunzipSync(await readFile(source+'motion.json.gz')));
const texture=await sharp(await readFile('public'+atlas.path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
// Actual stopped-foot receipts: 6728 seq2219/2221/2443/2445 and f42 seq915.
// Neutral boot angles and backing transforms reconstruct the pants geometry;
// they do not claim the missing original full-body transform or native counts.
const stoppedClothPoses=[
  [.3218648310388337,.3125,.17980769230769234,285,[[234.50034161521174,375.27737767347855,0],[239.2011385199187,398.5,0]]],
  [.3218648310388337,.5208333333333333,.17980769230769234,285,[[226.97460136454436,374.12392614906105,0],[239.2011385199187,398.5,0]]],
  [.3218648310388337,.3125,.17980769230769234,285,[[231.9115994539109,375.1963043451642,0],[239.2011385199187,398.5,0]]],
  [.3218648310388337,.5208333333333333,.17980769230769234,285,[[224.950555092322,374.0605377705638,0],[239.2011385199187,398.5,0]]],
  [.28717897371718815,.5208333333333333,.16346153846153846,282,[[215.28056136216583,377.06076053803184,0],[244.45996204933007,398.5,0]]],
];
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
// Inert RGBA/Canvas contract. No browser, GPU, game or media device is opened.
function surface(){
  const canvas={width:0,height:0,data:null};let crop;
  const context={clearRect(){},drawImage(image,x,y,w,h){crop={image,x,y,w,h};},
    getImageData(){const data=new Uint8ClampedArray(crop.w*crop.h*4);for(let y=0;y<crop.h;y++)for(let x=0;x<crop.w;x++){
      const at=((crop.y+y)*crop.image.naturalWidth+crop.x+x)*4,to=(y*crop.w+x)*4;data.set(crop.image.pixels.subarray(at,at+4),to);}return {data};},
    createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},putImageData(data){canvas.data=data;}};
  canvas.getContext=()=>context;return canvas;
}
function image(){return {naturalWidth:atlas.decodedWidth,naturalHeight:atlas.decodedHeight,pixels:texture.data,ownerDocument:{createElement:surface}};}
function observedPainter(){
  const observation={writes:0,failWrite:false,surfaces:[],dirtyRects:[]};
  const create=()=>{const canvas=surface(),context=canvas.getContext(),put=context.putImageData;
    context.putImageData=(...args)=>{if(observation.failWrite)throw Error('write failed');observation.writes++;observation.dirtyRects.push(args.slice(3));put(...args);
      canvas.data={width:args[0].width,height:args[0].height,data:new Uint8ClampedArray(args[0].data)};};
    observation.surfaces.push(canvas);return canvas;};
  return {painter:createV177RangerLowerPainter(image(),rig,create),observation};
}
function main({width=1280,height=720,matrix=[1,0,0,1,0,0]}={}){
  const calls=[],stack=[];let m=[...matrix];const ctx={canvas:{width,height},globalAlpha:.73,globalCompositeOperation:'source-over',filter:'none',
    getTransform:()=>Object.fromEntries(['a','b','c','d','e','f'].map((key,i)=>[key,m[i]])),
    save(){stack.push([...m]);},restore(){m=stack.pop();},setTransform(...value){m=[...value];},transform(...value){m=multiply(m,value);},
    translate(x,y){m=multiply(m,[1,0,0,1,x,y]);},scale(x,y){m=multiply(m,[x,0,0,y,0,0]);},
    drawImage(img,...rect){calls.push({matrix:[...m],rect,pixels:img.data?new Uint8ClampedArray(img.data.data):null,sourceWidth:img.width,
      alpha:ctx.globalAlpha,composite:ctx.globalCompositeOperation,filter:ctx.filter});}};
  return {ctx,calls,stack};
}

test('a newly rasterized exact RGBA match reuses its uploaded owner while a changed payload is uploaded',()=>{
  const {painter,observation}=observedPainter(),phase=.371;
  const paint=value=>{const target=main({matrix:[2,0,0,2,640.25,360]});const receipt=paintV177RangerLower(painter,target.ctx,value,.6,-48,-80,96,89.6);return {receipt,call:target.calls[0]};};
  const first=paint(phase),owner=painter.lastRaster,vertices=painter.parts.map(g=>[...g.target]);
  const before=getV177RangerLowerPaintSnapshot();assert.equal(observation.writes,1);
  const near=paint(phase+1e-12),after=getV177RangerLowerPaintSnapshot();
  assert.notDeepEqual(painter.parts.map(g=>[...g.target]),vertices,'the geometry cache must miss');
  assert.equal(after.rasterizedDraws-before.rasterizedDraws,1,'compute the current pose and all original samples');
  assert.notEqual(near.receipt.phase,first.receipt.phase);assert.deepEqual(near.call.pixels,first.call.pixels);
  assert.equal(observation.writes,1);assert.equal(painter.lastRaster.uploadOwner,owner);
  assert.deepEqual(painter.imageData.data,owner.canvas.data.data,'the uploaded pixels are an independent copy');
  const cachedBefore=getV177RangerLowerPaintSnapshot();paint(phase);paint(phase+1e-12);
  assert.equal(getV177RangerLowerPaintSnapshot().rasterizedDraws,cachedBefore.rasterizedDraws,'both geometry keys remain cached');
  const changed=paint(.62);assert.notDeepEqual(changed.call.pixels,first.call.pixels);assert.equal(observation.writes,2);
  const recovered=paint(phase+1e-12);assert.deepEqual(recovered.call.pixels,first.call.pixels);assert.equal(observation.writes,2,
    'a retained physical payload can be reused after full byte comparison');
  assert.ok(painter.rasters.every(r=>!r.valid||r.imageData.data.every((value,i)=>value===(r.uploadOwner??r).canvas.data.data[i])),
    'a valid geometry key must always name the actual uploaded payload');
});

test('exact raster reuse retains the frozen 1658 pixels at all three viewport transforms',()=>{
  const result=[],painter=createV177RangerLowerPainter(image(),rig);
  for(const [width,height,scale]of[[1280,720,1],[844,390,.8],[844,340,2]])for(const flip of[false,true])for(const angle of[0,.07])for(const phase of[0,.371,.83]){
    const c=Math.cos(angle),s=Math.sin(angle),sign=flip?-1:1;
    const target=main({width,height,matrix:[c*sign*scale,s*sign*scale,-s*scale,c*scale,width/2,height/2]});
    const receipt=paintV177RangerLower(painter,target.ctx,phase,phase===0?1:.49999,-48,-80,96,89.6);
    // Crop to the active draw rectangle: a shared surface can retain a larger
    // allocation, but those transparent outside pixels are never drawn.
    const call=target.calls[0],w=receipt.width,h=receipt.height,pixels=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)pixels.set(call.pixels.subarray(y*call.sourceWidth*4,(y*call.sourceWidth+w)*4),y*w*4);
    result.push({receipt,pixelSha:sha(pixels),draw:call.rect});
  }
  // Generated once from immutable commit1658 before adding bitmap reuse.
  assert.equal(sha(JSON.stringify(result)),'89a8361b28a3d7947c1ce5a1049ed0762d3f13038bb411f996861ee20ffeb599');
});

test('bitmap reuse observes subpixel, foot, facing and surface changes and applies current draw state',()=>{
  const {painter,observation}=observedPainter();
  const paint=(entry={})=>{
    const target=main({width:entry.clipWidth??1280,matrix:entry.matrix??[1,0,0,1,640,360]});
    if(entry.alpha!=null){target.ctx.globalAlpha=entry.alpha;target.ctx.filter='brightness(1.1)';target.ctx.globalCompositeOperation='screen';}
    const receipt=paintV177RangerLower(painter,target.ctx,entry.phase??.371,.5,-48,-80,entry.size??96,89.6,entry.feet??null);
    return {receipt,call:target.calls[0]};
  };
  const first=paint();assert.equal(observation.writes,1);
  assert.deepEqual(observation.dirtyRects[0],[0,0,first.receipt.width,first.receipt.height]);
  const again=paint({alpha:.21});assert.equal(observation.writes,1);assert.deepEqual(again.receipt,first.receipt);
  assert.deepEqual(again.call.pixels,first.call.pixels);assert.equal(again.call.alpha,.21);
  assert.equal(again.call.filter,'brightness(1.1)');assert.equal(again.call.composite,'screen');
  for(const entry of[
    {matrix:[1,0,0,1,640.000001,360]}, {matrix:[-1,0,0,1,640,360]},
    {matrix:[2,0,0,2,640,360]}, {phase:.372}, {size:96.000001},
    {feet:v177RangerLowerPose(rig,.4,.5).joints.map(j=>[j[4],j[5],0])}, {clipWidth:640}, {},
  ]){
    const before=getV177RangerLowerPaintSnapshot(),result=paint(entry),after=getV177RangerLowerPaintSnapshot();
    assert.equal(after.rasterizedDraws,before.rasterizedDraws+1,'changed backing geometry must be rasterized');
    assert.deepEqual(result.call.pixels,painter.imageData.data,'the current exact payload must be uploaded or already present');
  }
  const before=observation.writes;paint();assert.equal(observation.writes,before);
  assert.equal(paint({matrix:[1,0,0,1,-2000,0]}).receipt.mode,'offscreen-weighted-mesh');
  paint();assert.equal(observation.writes,before+1,'offscreen draws invalidate the prior bitmap');
  assert.equal(paint({matrix:[0,0,0,0,0,0]}).receipt.mode,'legacy-cell-fallback');
  paint();assert.equal(observation.writes,before+2,'failed transforms invalidate the prior bitmap');
  observation.failWrite=true;
  assert.throws(()=>paint({phase:.39}),/write failed/);
  observation.failWrite=false;
  paint({phase:.39});assert.equal(observation.writes,before+3,'a failed put cannot create a successful reuse receipt');
});

test('optional lower timing identifies raster, upload and blit without changing pixels or paint receipts',()=>{
  const previous=globalThis.__V100_RAF_CALLBACK_DIAG__,rows=[];
  const painter=createV177RangerLowerPainter(image(),rig);
  const paint=()=>{
    const target=main({matrix:[1,0,0,1,640,360]});
    const receipt=paintV177RangerLower(painter,target.ctx,.371,.5,-48,-80,96,89.6);
    return {receipt,pixels:target.calls[0].pixels};
  };
  try{
    const expected=paint();
    globalThis.__V100_RAF_CALLBACK_DIAG__={rangerPaintActive:false,rangerPaint:row=>rows.push(row)};
    assert.deepEqual(paint(),expected);assert.equal(rows.length,0);
    globalThis.__V100_RAF_CALLBACK_DIAG__.rangerPaintActive=true;
    assert.deepEqual(paint(),expected);assert.equal(rows.length,1);assert.equal(rows[0].reused,true);
    assert.equal(rows[0].cacheSwitch,false);assert.deepEqual(rows[0].transform,[1,0,0,1,640,360]);
    assert.equal(rows[0].rasterFinishedAt,rows[0].lookupFinishedAt);
    for(const key of ['startedAt','poseFinishedAt','lookupFinishedAt','rasterFinishedAt','uploadFinishedAt','endedAt'])assert.ok(Number.isFinite(rows[0][key]));
    const times=Object.entries(rows[0]).filter(([key])=>key.endsWith('At')).map(([,value])=>value);
    assert.ok(times.every((value,index)=>index===0||value>=times[index-1]));
    const fresh=createV177RangerLowerPainter(image(),rig),target=main({matrix:[1,0,0,1,640,360]});
    assert.deepEqual(paintV177RangerLower(fresh,target.ctx,.371,.5,-48,-80,96,89.6),expected.receipt);
    assert.deepEqual(target.calls[0].pixels,expected.pixels);assert.equal(rows[1].reused,false);
  }finally{
    if(previous===undefined)delete globalThis.__V100_RAF_CALLBACK_DIAG__;else globalThis.__V100_RAF_CALLBACK_DIAG__=previous;
  }
});

test('alternating Ranger owners keep exact pixels and current draw state without repeated rasterization',()=>{
  const activePixels=(receipt,call)=>{
    const result=new Uint8ClampedArray(receipt.width*receipt.height*4);
    for(let y=0;y<receipt.height;y++)result.set(call.pixels.subarray(y*call.sourceWidth*4,(y*call.sourceWidth+receipt.width)*4),y*receipt.width*4);
    return result;
  };
  for(const [width,height,scale]of [[1280,720,1],[844,390,.8],[844,340,2]]){
    const {painter,observation}=observedPainter();
    const paint=(p,second,alpha)=>{
      const target=main({width,height,matrix:[scale,0,0,scale,second?440.75:320.25,160]});
      target.ctx.globalAlpha=alpha;target.ctx.filter=second?'brightness(1.1)':'none';
      const receipt=paintV177RangerLower(p,target.ctx,second?.762:.371,second?.25:.5,-48,-80,96,89.6);
      return {receipt,call:target.calls[0]};
    };
    const expected=[false,true].map(second=>paint(createV177RangerLowerPainter(image(),rig),second,.73));
    for(let i=0;i<6;i++)paint(painter,i%2===1,.73);
    const before=getV177RangerLowerPaintSnapshot();
    const uploadsBefore=observation.writes;
    for(let i=0;i<20;i++){
      const second=i%2===1,alpha=second?.21:.64,result=paint(painter,second,alpha),control=expected[Number(second)];
      assert.deepEqual(result.receipt,control.receipt);
      assert.deepEqual(activePixels(result.receipt,result.call),activePixels(control.receipt,control.call));
      assert.deepEqual(result.call.rect,control.call.rect);assert.equal(result.call.alpha,alpha);
      assert.equal(result.call.filter,second?'brightness(1.1)':'none');
    }
    const after=getV177RangerLowerPaintSnapshot();
    assert.equal(after.rasterizedDraws,before.rasterizedDraws);
    assert.equal(after.reusedDraws-before.reusedDraws,20);
    assert.equal(observation.writes,uploadsBefore,'alternating cached owners must never upload their pixels again');
    assert.equal(painter.rasters.length,2);
    assert.equal(new Set(painter.rasters.map(raster=>raster.canvas)).size,2);
    assert.ok(painter.rasters.reduce((sum,raster)=>sum+raster.imageData.data.byteLength,0)<=65536*4);
    assert.ok(painter.rasters.reduce((sum,raster)=>sum+raster.canvas.width*raster.canvas.height,0)<=65536);
    const failedTarget=main({width,height,matrix:[scale,0,0,scale,320.25,160]});
    failedTarget.ctx.drawImage=()=>{throw Error('blit failed');};
    assert.throws(()=>paintV177RangerLower(painter,failedTarget.ctx,.371,.5,-48,-80,96,89.6),/blit failed/);
    assert.ok(painter.rasters.every(raster=>!raster.valid));
    paint(painter,false,.73);assert.equal(getV177RangerLowerPaintSnapshot().rasterizedDraws,after.rasterizedDraws+1);
  }
});

test('Ranger bitmap retention stays within the original RGBA budget and failed allocation cannot retain a hit',()=>{
  const painter=createV177RangerLowerPainter(image(),rig);
  const paint=(size,phase=.371)=>paintV177RangerLower(painter,main({width:1600,height:1600,matrix:[1,0,0,1,600,350]}).ctx,phase,.5,-size/2,-size*.8,size,size*448/480);
  paint(120);
  const allocate=painter.context.createImageData;
  painter.context.createImageData=()=>{throw new Error('allocation failed');};
  assert.throws(()=>paint(96,.762),/allocation failed/);
  assert.ok(painter.rasters.every(raster=>!raster.valid));
  painter.context.createImageData=allocate;paint(96,.762);
  for(const size of [300,480,650]){
    const receipt=paint(size);assert.equal(receipt.mode,'continuous-weighted-mesh');
    assert.ok(painter.rasters.length<=2);
    assert.ok(painter.rasters.reduce((sum,raster)=>sum+raster.imageData.data.byteLength,0)<=65536*4);
    assert.ok(painter.rasters.reduce((sum,raster)=>sum+raster.canvas.width*raster.canvas.height,0)<=65536);
  }
  assert.ok(painter.width*painter.height>32768);
  paint(96,.762);assert.equal(painter.rasters.length,1,'a large backing allocation permits only one retained payload');
});

test('growing Ranger surfaces releases the alternate backing canvas and a missing context never becomes reusable',()=>{
  const {painter,observation}=observedPainter();
  const paint=(size,phase)=>paintV177RangerLower(painter,main({width:1600,height:1600,matrix:[1,0,0,1,600,350]}).ctx,phase,.5,-size/2,-size*.8,size,size*448/480);
  paint(96,.371);paint(96,.762);paint(96,.371);assert.equal(painter.rasters.length,2);
  const alternate=painter.rasters[1].canvas;paint(480,.371);
  assert.equal(alternate.width,0);assert.equal(alternate.height,0);
  const broken=createV177RangerLowerPainter(image(),rig);let rejected;
  const target=()=>main({matrix:[1,0,0,1,640,360]}).ctx;
  paintV177RangerLower(broken,target(),.371,.5,-60,-100,120,112);
  broken.createCanvas=()=>{rejected={width:0,height:0,getContext:()=>null};return rejected;};
  assert.throws(()=>paintV177RangerLower(broken,target(),.762,.5,-48,-80,96,89.6),/context unavailable/);
  assert.equal(rejected.width,0);assert.equal(rejected.height,0);
  assert.ok(broken.rasters.every(raster=>!raster.valid));
  assert.ok(observation.surfaces.filter(canvas=>canvas.width*canvas.height>0).length<=2);
});

test('Ranger releases source readback and retains the original generated-RGBA surface hint',()=>{
  const observations=[];
  const create=()=>{const canvas=surface(),context=canvas.getContext(),row={canvas,attributes:null,reads:0};
    const read=context.getImageData;context.getImageData=(...args)=>{row.reads++;return read(...args);};
    context.getContextAttributes=()=>({...row.attributes});
    canvas.getContext=(_kind,attributes)=>{row.attributes={...attributes};return context;};observations.push(row);return canvas;};
  const painter=createV177RangerLowerPainter(image(),rig,create);
  assert.equal(observations[0].attributes.willReadFrequently,true);assert.equal(observations[0].reads,rig.parts.length);
  assert.equal(observations[0].canvas.width,0);assert.equal(observations[0].canvas.height,0);
  const paint=phase=>paintV177RangerLower(painter,main({matrix:[1,0,0,1,640,360]}).ctx,phase,.5,-48,-80,96,89.6);
  paint(.371);paint(.762);paint(.371);assert.equal(painter.rasters.length,2);
  for(const row of observations.slice(1)){assert.equal(row.attributes.willReadFrequently,true);assert.equal(row.reads,0);}
  for(const raster of painter.rasters)assert.equal(raster.attributes.willReadFrequently,true);
  assert.ok(painter.rasters.reduce((sum,raster)=>sum+raster.canvas.width*raster.canvas.height,0)<=65536);
});

test('failed source or paint context acquisition releases every transient canvas',()=>{
  for(const failure of ['source-context','source-read','paint-context','paint-throw']){
    const canvases=[];
    const create=()=>{const canvas=surface(),context=canvas.getContext(),i=canvases.length;canvas.width=300;canvas.height=150;canvases.push(canvas);
      if(i===0&&failure==='source-read')context.getImageData=()=>{throw Error('source read failed');};
      canvas.getContext=()=>{if((i===0&&failure==='source-context')||(i===1&&failure==='paint-context'))return null;
        if(i===1&&failure==='paint-throw')throw Error('paint context failed');return context;};return canvas;};
    const construct=()=>createV177RangerLowerPainter(image(),rig,create);
    if(failure.endsWith('context'))assert.equal(construct(),null);else assert.throws(construct,/failed/);
    assert.ok(canvases.every(canvas=>canvas.width===0&&canvas.height===0),failure);
  }
});

test('failed growth while the alternate surface is active still permits an old-size repaint',()=>{
  const {painter}=observedPainter();
  const paint=(size,phase)=>{const target=main({width:1600,height:1600,matrix:[1,0,0,1,600,350]});
    const receipt=paintV177RangerLower(painter,target.ctx,phase,.5,-size/2,-size*.8,size,size*448/480);return{receipt,call:target.calls[0]};};
  paint(96,.371);paint(96,.762);paint(96,.371);
  const phase=painter.lastRaster.canvas===painter.canvas?.762:.371;
  const expected=paint(96,phase),alternate=painter.lastRaster.canvas;
  assert.notEqual(alternate,painter.canvas);
  const allocate=painter.context.createImageData;
  painter.context.createImageData=()=>{throw Error('growth allocation failed');};
  assert.throws(()=>paint(480,.371),/growth allocation failed/);
  assert.ok(alternate.width>0&&alternate.height>0);
  assert.ok(painter.rasters.every(raster=>!raster.valid));
  painter.context.createImageData=allocate;
  const recovered=paint(96,phase);
  assert.deepEqual(recovered.receipt,expected.receipt);assert.deepEqual(recovered.call.pixels,expected.call.pixels);
});

test('stopped Ranger cloth keeps one coverage per sample without changing vertices, UV or original legs',()=>{
  const painter=createV177RangerLowerPainter(image(),rig),source=painter.parts.map(g=>({uv:[...g.uv],indices:[...g.indices]}));
  const area=(v,a,b,c)=>(v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1])-(v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
  for(const [phase,settle,scale,y,feet]of stoppedClothPoses)for(const sign of [1,-1])for(const angle of [0,.07]){
    const x=361.900000000001,c=Math.cos(angle),s=Math.sin(angle),width=480*scale,height=448*scale;
    const {ctx}=main({matrix:[c*sign,s*sign,-s,c,x-c*sign*x+s*y,y-s*sign*x-c*y]});
    const receipt=paintV177RangerLower(painter,ctx,phase,settle,x-width*.5,y-height*.9642857142857143,width,height,feet);
    assert.equal(receipt.mode,'continuous-weighted-mesh');assert.equal(receipt.duplicateWithinPart,0);
    assert.equal(receipt.degenerate,0);assert.equal(receipt.coverageSamples,4);
    for(const [i,g]of painter.parts.entries()){
      assert.deepEqual([...g.uv],source[i].uv);assert.deepEqual([...g.indices],source[i].indices);
      assert.equal(g.rasterIndices.length,g.indices.length);
      for(let t=0;t<g.rasterIndices.length;t+=3){const [a,b,c]=g.rasterIndices.subarray(t,t+3);
        assert.ok(area(g.target,a,b,c)*area(g.uv,a,b,c)*sign>0,'each painted triangle retains its source orientation');}
    }
    const pose=v177RangerLowerPose(rig,phase,settle,undefined,feet);
    for(const [i,leg]of rig.legs.entries()){
      const j=pose.joints[i];assert.ok(Math.abs(Math.hypot(j[2]-j[0],j[3]-j[1])-leg.upperLength)<1e-9);
      assert.ok(Math.abs(Math.hypot(j[4]-j[2],j[5]-j[3])-leg.lowerLength)<1e-9);
      assert.deepEqual([...j.subarray(4,6)],feet[i].slice(0,2));
    }
  }
  const {ctx}=main();paintV177RangerLower(painter,ctx,.371,1,300,220,96,89.6);
  for(const g of painter.parts)assert.deepEqual(g.rasterIndices,g.indices,'a later convex pose restores its original diagonal');
});

test('Ranger cloth never repairs a collapsed or crossed quad into a false success',()=>{
  const cases=[
    {uv:[2,2,6,2,10,2,2,8],degenerate:1},
    {uv:[2,2,4,4,6,6,8,8],degenerate:2},
    {uv:[2,2,8,8,2,8,8,2],degenerate:0,overlap:true},
  ];
  for(const entry of cases){
    const painter=createV177RangerLowerPainter(image(),rig),part=painter.parts.find(g=>g.bone==='pelvis');
    // An isolated invalid quad exercises the real raster failure receipt.
    // Its private UV copy cannot alter the approved rig or decoded source.
    part.uv.set(entry.uv);painter.parts=[part];const {ctx}=main();
    const receipt=paintV177RangerLower(painter,ctx,0,1,0,0,480,448);
    assert.equal(receipt.mode,'continuous-weighted-mesh');assert.deepEqual(part.rasterIndices,part.indices);
    assert.equal(receipt.degenerate,entry.degenerate*receipt.coverageSamples);
    if(entry.overlap)assert.ok(receipt.duplicateWithinPart>0);
  }
});
test('append-only Ranger atlas retains every r2 RGBA byte, upper rig and full original five lower crops',async()=>{
  const oldBytes=await readFile('public/art/v100/joints/ranger-r2.webp');assert.equal(sha(oldBytes),'08440e6c182f562e3fda394a9f12b5e21ca0e9abfa95da104d1dc397f3a412db');
  const old=await sharp(oldBytes).ensureAlpha().raw().toBuffer();assert.ok(texture.data.subarray(0,old.length).equals(old));
  assert.equal(sha(JSON.stringify(atlas.upperRig)),'23a2419c59a55c90e7528840fcf1d1f6d97167bfbfad622858416404c8f5d51a');
  assert.equal(atlas.frames.length,152);assert.equal(atlas.upperRig.parts.length,7);assert.ok(atlas.decodedBytes<=6*1024*1024);
  for(const part of rig.parts){const p=JSON.parse(await readFile(source+'parts.json')).parts.find(p=>p.name===part.name),raw=await sharp(await readFile(source+p.file)).ensureAlpha().raw().toBuffer();
    for(let y=0;y<part.source.h;y++){const from=((part.destination.y+y)*480+part.destination.x)*4,to=((part.source.y+y)*atlas.decodedWidth+part.source.x)*4;
      assert.ok(raw.subarray(from,from+part.source.w*4).equals(texture.data.subarray(to,to+part.source.w*4)),part.name);}}
  for(const leg of rig.legs){assert.equal(leg.weights.length,65);assert.equal(leg.triangles.length,288);assert.equal(leg.sourcePositions.length,130);}
});
test('the original lower remains reproducible as a legacy control with its original feet and far leg',()=>{
  const rig={...atlas.lowerRig,spanPx:94,legs:atlas.lowerRig.legs.map(leg=>({...leg,
    upperLength:Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1]),
    lowerLength:Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])}))};
  const out=createV177RangerLowerPose(rig);let maximum=0,oldBackwardNearKeys=0;
  for(let row=0;row<4;row++)for(let i=0;i<=60;i++){
    const frame=motion.actions[row].frames[i],pose=v177RangerLowerPose(rig,i/60,row/3,out),dx=frame.bones.root.head[0]-240;
    for(const leg of rig.legs){const points=pose.meshes[leg.name];if(leg.name==='far-pants')for(let j=0;j<65;j++){
      maximum=Math.max(maximum,Math.hypot(points[j*2]-(frame.meshes[leg.name][j][0]-dx),points[j*2+1]-frame.meshes[leg.name][j][1]));}
      const joints=pose.joints[rig.legs.indexOf(leg)];assert.ok(Math.abs(Math.hypot(joints[2]-joints[0],joints[3]-joints[1])-leg.upperLength)<1e-10);
      assert.ok(Math.abs(Math.hypot(joints[4]-joints[2],joints[5]-joints[3])-leg.lowerLength)<1e-10);
      const ankle=frame.bones[leg.footBone].head;
      assert.ok(Math.hypot(joints[4]-(ankle[0]-dx),joints[5]-ankle[1])<.01,'keep original stance/swing foot positions');
      const cross=(joints[4]-joints[0])*(joints[3]-joints[1])-(joints[5]-joints[1])*(joints[2]-joints[0]);
      assert.ok(cross<0,'both knees must bend toward authored forward, including the settled shooting stance');
      if(leg.name==='near-pants'){
        const hip=frame.bones[leg.upperBone].head,knee=frame.bones[leg.lowerBone].head;
        if((ankle[0]-hip[0])*(knee[1]-hip[1])-(ankle[1]-hip[1])*(knee[0]-hip[0])>0)oldBackwardNearKeys++;
      }
    }
  }
  assert.ok(maximum<.01,'far leg remains at the same existing source precision; max='+maximum);
  assert.ok(oldBackwardNearKeys>0,'retain a counterexample from the original backward near-knee source');
  for(const phase of [0,1/30,.371,.62,.999])for(const settle of [1/6,1/3,.5,2/3,5/6]){
    const a=v177RangerLowerPose(rig,phase,settle-1e-9),b=v177RangerLowerPose(rig,phase,settle+1e-9);
    for(const leg of rig.legs)for(let i=0;i<a.meshes[leg.name].length;i++)assert.ok(Math.abs(a.meshes[leg.name][i]-b.meshes[leg.name][i])<1e-6);
  }
});

test('live Ranger legs share anatomical proportions and their original cloth reaches each retargeted joint',()=>{
  const near=rig.legs[1],point=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  for(const leg of rig.legs){
    assert.equal(leg.upperLength,Math.hypot(near.knee[0]-near.hip[0],near.knee[1]-near.hip[1]));
    assert.equal(leg.lowerLength,Math.hypot(near.ankle[0]-near.knee[0],near.ankle[1]-near.knee[1]));
  }
  for(const scale of [.18,.2])assert.equal(v177JointCycleDistance('ranger',scale),rig.spanPx/rig.stanceFraction*scale,
    'actual travel must use the new painted stride rather than the longer legacy baked stride');
  for(let frame=0;frame<120;frame++){
    const pose=v177RangerLowerPose(rig,frame/120,0);
    for(const [i,leg]of rig.legs.entries()){
      const joints=pose.joints[i],upper=pose.matrices[leg.upperBone],lower=pose.matrices[leg.lowerBone];
      for(const [matrix,source,target]of [[upper,leg.hip,[...joints.slice(0,2)]],[upper,leg.knee,[...joints.slice(2,4)]],
        [lower,leg.knee,[...joints.slice(2,4)]],[lower,leg.ankle,[...joints.slice(4,6)]]])
        assert.ok(Math.hypot(...point(matrix,source).map((value,i)=>value-target[i]))<1e-9,
          'retargeting must not leave a rotated cloth endpoint past its actual knee or boot');
    }
  }
});
test('actual joint draw paints one continuous lower and seven upper parts under full backing transforms',()=>{
  const img=image(),actor={},world={};
  for(const [width,height]of [[1280,720],[844,390],[844,340]])for(const flip of [false,true])for(const angle of [0,.07])for(const phase of [.037,.371,.83]){
    const c=Math.cos(angle),s=Math.sin(angle),sign=flip?-1:1,m=[c*sign*.8,s*sign*.8,-s*.8,c*.8,width/2,height/2];
    const target=main({width,height,matrix:m}),runtime={locomotionPhase:phase,locomotionSettle:.49999},plan=v177JointPose('ranger',{requestedState:'active',clipProgress:.371},runtime,{actor,world});
    assert.equal(drawV177JointPose(target.ctx,img,'ranger',plan,-48,-80,96,89.6,{actor,world}),true);
    const receipt=v177RenderedWeightedLowerReceipt(actor,world);assert.equal(receipt.mode,'continuous-weighted-mesh');
    assert.equal(receipt.parts,5);assert.equal(receipt.meshVertices,130);assert.equal(receipt.meshTriangles,192);assert.equal(receipt.coverageSamples,4);
    assert.equal(receipt.duplicateWithinPart,0);assert.equal(receipt.degenerate,0);assert.equal(receipt.phase,plan.phase);assert.equal(receipt.settle,plan.lowerSettle);
    assert.equal(target.calls.length,8);assert.deepEqual(target.calls[0].matrix,[1,0,0,1,0,0]);assert.ok(target.calls[0].pixels.some(v=>v));
    assert.equal(target.ctx.globalAlpha,.73);assert.equal(target.ctx.globalCompositeOperation,'source-over');assert.equal(target.stack.length,0);
    assert.deepEqual(Object.values(target.ctx.getTransform()),m);
    const again=main({width,height,matrix:m});drawV177JointPose(again.ctx,img,'ranger',plan,-48,-80,96,89.6,{actor,world});
    assert.deepEqual(again.calls[0].pixels,target.calls[0].pixels,'zero time redraw cannot change a pixel or shared painter ownership');
  }
});

test('a paused isolated left action paints its original weighted body from a left-facing start',()=>{
 for(const initial of ['left']){
  const img=image(),world={time:0,fighters:[]},actor={id:47,x:330,
   animationPresentation:{moving:true,direction:initial,locomotionPhase:.12,locomotionSettle:0}};
  world.fighters=[actor];
  const paint=()=>{
   const base=v177JointPose('ranger',{requestedState:'move'},actor.animationPresentation,{actor,world});
   const plan=v177RangerFootPlan('ranger',base,{actor,world,width:86.4});
   const {ctx}=main({matrix:[-1,0,0,1,actor.x,285]});
   drawV177JointPose(ctx,img,'ranger',plan,-43.2,-80,86.4,80.64,{actor,world});return plan;
  };
  paint();actor.x-=4.5;actor.animationPresentation={...actor.animationPresentation,direction:'left',locomotionPhase:.12-4.5/v177JointCycleDistance('ranger',.18)};
  const plan=paint();
  assert.equal(plan.rangerFeet.facing,-1,'the isolated left action retains its actually painted initial facing');
  assert.equal(v177RenderedWeightedLowerReceipt(actor,world).mode,'continuous-weighted-mesh');
 }
});
test('shared half-alpha triangle edges are owned once and failed/fallback draws never claim continuous paint',()=>{
  const small={naturalWidth:4,naturalHeight:4,pixels:Uint8ClampedArray.from(Array(16).fill([200,80,10,128]).flat())};
  const lower={legs:[],parts:[{name:'pelvis',bone:'pelvis',source:{x:0,y:0,w:4,h:4},destination:{x:0,y:0,w:4,h:4}}]};
  const painter=createV177RangerLowerPainter(small,lower,surface),target=main({width:8,height:8});
  const receipt=paintV177RangerLower(painter,target.ctx,0,1,0,0,480,448);assert.equal(receipt.duplicateWithinPart,0);
  const call=target.calls[0],alpha=call.pixels[((1*call.sourceWidth)+1)*4+3];assert.equal(alpha,128,'a shared internal edge must not become alpha192');
  const actor={},img={naturalWidth:atlas.decodedWidth},plan=v177JointPose('ranger',{requestedState:'move'},{locomotionPhase:.371,locomotionSettle:.5},{actor});
  const fallback=main();assert.equal(drawV177JointPose(fallback.ctx,img,'ranger',plan,0,0,96,89.6,{actor}),true);
  assert.equal(v177RenderedWeightedLowerReceipt(actor)?.mode,'legacy-cell-fallback');
  assert.equal(drawV177JointPose(fallback.ctx,{naturalWidth:0},'ranger',plan,0,0,96,89.6,{actor}),false);assert.equal(v177RenderedWeightedLowerReceipt(actor),null);
});

test('actual RGBA draw finishes stop steps across actor replacements and repeated paints in three viewports',()=>{
  for(const[width,height]of[[1280,720],[844,390],[844,340]]){
    const img=image(),world={time:0,fighters:[]};
    let actor={id:27,x:330,animationPresentation:{moving:true,direction:'right',locomotionPhase:.31,locomotionSettle:0}};
    const paint=()=>{
      const base=v177JointPose('ranger',{requestedState:actor.animationPresentation.moving?'move':'active',clipProgress:.3},actor.animationPresentation,{actor,world});
      const plan=v177RangerFootPlan('ranger',base,{actor,world,width:96});
      assert.equal(plan.lowerIndex%atlas.frameCount,Math.floor(plan.phase*atlas.frameCount),'the fallback cell must follow the same resolved phase');
      const socket=v177RenderedJointWeaponSocket({kind:'ranger',plan,direction:'right',
        frame:{anchorX:.5,anchorY:86/89.6,flipX:false},size:{w:96,h:89.6},
        pose:{offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0},x:width/2,y:height/2});
      const target=main({width,height,matrix:[1,0,0,1,width/2,height/2]});
      assert.equal(drawV177JointPose(target.ctx,img,'ranger',plan,-48,-86,96,89.6,{actor,world}),true);
      if(socket){
        const part=atlas.upperRig.parts.findIndex(part=>part.bone===atlas.upperRig.weaponBone);
        const m=target.calls[part+1].matrix,[sx,sy]=atlas.upperRig.muzzle;
        assert.ok(Math.hypot(socket.x-(m[0]*sx+m[2]*sy+m[4]),socket.y-(m[1]*sx+m[3]*sy+m[5]))<1e-8,
          'the muzzle sampled before paint must be the muzzle actually drawn after foot placement');
      }
      return{target,receipt:v177RenderedWeightedLowerReceipt(actor,world)};
    };
    world.fighters=[actor];let last=paint();assert.equal(last.receipt.footPlacement,'planted-stop-steps');
    for(let frame=1;frame<=36;frame++){
      world.time=frame/60;
      actor={...actor,animationPresentation:{...actor.animationPresentation,moving:false,locomotionSettle:Math.min(1,frame/10)}};
      world.fighters=[actor];const before=JSON.stringify(world),drawn=paint();
      assert.equal(JSON.stringify(world),before,'render-only foot anchors cannot enter the fighter or save');
      assert.equal(drawn.receipt.mode,'continuous-weighted-mesh');
      assert.equal(drawn.receipt.footPlacement,'planted-stop-steps');
      assert.ok(drawn.target.calls[0].pixels.some(value=>value));
      if(frame===8){const again=paint();assert.deepEqual(again.target.calls[0].pixels,drawn.target.calls[0].pixels);}
      last=drawn;
    }
    assert.deepEqual(last.receipt.footLiftPx,[0,0]);
    assert.ok(Math.abs(last.receipt.footWorldX[1]-last.receipt.footWorldX[0]-65*.2)<1e-9);
  }
});

test('actual turning paint keeps the body reflection, world feet and sampled muzzle on the same facing',async()=>{
  const source=await readFile('app/AshfallGame.tsx','utf8');
  const tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),branches=[];
  const visit=node=>{if(ts.isIfStatement(node)&&node.expression.getText(tree)==='jointPose?.rangerFeet')branches.push(node.getText(tree));ts.forEachChild(node,visit);};
  visit(tree);assert.equal(branches.length,1);
  const facingForPaint=new Function('jointPose','direction','frame',branches[0]+';return {direction,frame};');
  for(const[width,height]of[[1280,720],[844,390],[844,340]])for(const start of ['right','left']){
    const img=image(),world={time:0,fighters:[]},size={w:86.4,h:80.64},pose={offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotationRadians:0};
    const actor={id:41,x:330,y:285,animationPresentation:{moving:true,direction:start,locomotionPhase:.12,locomotionSettle:0}};
    world.fighters=[actor];let firstFacing;
    for(let tick=0;tick<=30;tick++){
      world.time=tick/60;
      const requested=tick===0?start:start==='right'?'left':'right';
      Object.assign(actor.animationPresentation,{direction:requested,moving:tick===0,locomotionSettle:Math.min(1,tick/10)});
      const sample=tick===0?{requestedState:'move'}:tick<6?{requestedState:'wind-up',clipProgress:tick/6}:{requestedState:'active',clipProgress:.3};
      const base=v177JointPose('ranger',sample,actor.animationPresentation,{actor,world});
      const plan=v177RangerFootPlan('ranger',base,{actor,world,width:size.w});
      const originalFrame={anchorX:.5,anchorY:86/89.6,flipX:requested==='left'};
      const resolved=facingForPaint(plan,requested,originalFrame),sign=resolved.direction==='left'?-1:1;
      if(tick===0)firstFacing=sign;
      if(tick===1)assert.equal(sign,firstFacing,'an endangered ankle must lift before the actual body is reflected');
      assert.equal(resolved.frame.flipX,sign<0);
      const snapshot=JSON.stringify(world),target=main({width,height,matrix:[sign,0,0,1,actor.x,actor.y]});
      const socket=v177RenderedJointWeaponSocket({kind:'ranger',plan,direction:resolved.direction,frame:resolved.frame,size,pose,x:actor.x,y:actor.y});
      assert.equal(drawV177JointPose(target.ctx,img,'ranger',plan,-size.w*.5,-size.h*86/89.6,size.w,size.h,{actor,world}),true);
      assert.equal(JSON.stringify(world),snapshot,'display facing cannot change gameplay direction or save state');
      const receipt=v177RenderedWeightedLowerReceipt(actor,world);
      assert.equal(receipt.mode,'continuous-weighted-mesh');assert.equal(receipt.duplicateWithinPart,0);assert.equal(receipt.degenerate,0);
      const lower=v177RangerLowerPose(rig,plan.phase,plan.lowerSettle,undefined,plan.lowerFootTargets);
      for(let i=0;i<2;i++)assert.ok(Math.abs(actor.x+sign*size.w/480*(lower.joints[i][4]-240)-receipt.footWorldX[i])<1e-9,
        'the reflected ankle actually painted must reconstruct its fixed world anchor');
      if(socket){
        const part=atlas.upperRig.parts.findIndex(part=>part.bone===atlas.upperRig.weaponBone),m=target.calls[part+1].matrix,[sx,sy]=atlas.upperRig.muzzle;
        assert.ok(Math.hypot(socket.x-m[0]*sx-m[2]*sy-m[4],socket.y-m[1]*sx-m[3]*sy-m[5])<1e-8,
          'the sampled shot origin must remain on the weapon actually painted during the turn');
      }
      assert.equal(v177RangerFootPlan('ranger',plan,{actor,world,width:size.w}),plan,'the second prepaint read reuses this exact resolved turn');
      if(tick===30)assert.equal(sign,-firstFacing);
    }
  }
  const frame={flipX:true};assert.deepEqual(facingForPaint(null,'left',frame),{direction:'left',frame});
});

test('an ability activated before a simulation tick keeps its own aim through prepaint and the actual draw',async()=>{
  const source=await readFile('app/AshfallGame.tsx','utf8'),tree=ts.createSourceFile('game.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const calls=[],branches=[];
  const visit=node=>{
    if(ts.isExpressionStatement(node)&&node.getText(tree).startsWith('jointPose=v177RangerFootPlan('))calls.push(node.getText(tree));
    if(ts.isIfStatement(node)&&node.expression.getText(tree)==='jointPose?.rangerFeet')branches.push(node.getText(tree));
    ts.forEachChild(node,visit);
  };visit(tree);assert.equal(calls.length,1);assert.equal(branches.length,1);
  const prepaint=new Function('jointPose','renderKind','f','options','size','direction','v177RangerFootPlan',calls[0]+';return jointPose;');
  const resolve=new Function('jointPose','direction','frame',branches[0]+';return {direction,frame};');
  const runtime={state:'idle',moving:false,direction:'right',locomotionPhase:.12,locomotionSettle:1};
  const actor={id:77,kind:'ranger',side:'human',hp:70,x:330,y:285,stationAbility:{phase:'idle'},animationPresentation:runtime,manualAbility:createManualAbilityRuntime('ranger')};
  const world={time:20,fighters:[actor]},img=image(),size={w:96,h:89.6};
  const normal=v177JointPose('ranger',{requestedState:'idle'},runtime,{actor,world});
  assert.equal(drawV177JointPose(main().ctx,img,'ranger',normal,-48,-86,96,89.6,{actor,world}),true);
  const originalFeet=v177RenderedWeightedLowerReceipt(actor,world).footWorldX;
  actor.manualAbility=beginManualAbility(actor.manualAbility,{direction:-1,x:200,y:285,targetId:901}).runtime;
  const manual=v177JointPose('ranger',{requestedState:'special',clipProgress:0},runtime,{actor,world,ownedPose:true,rangerManualOwner:true,rangerManualDefinition:MANUAL_ABILITY_REGISTRY.ranger});
  assert.ok(manual.rangerManualUpperPose);assert.equal(runtime.direction,'right');
  const before=JSON.stringify(world),plan=prepaint(manual,'ranger',actor,{world},size,'left',v177RangerFootPlan);
  const resolved=resolve(plan,'left',{anchorX:.5,anchorY:86/89.6,flipX:true});
  assert.equal(plan.rangerFeet.turnTargetFacing??plan.rangerFeet.facing,-1,
    'the prepaint feet cannot replace manual aim with the older locomotion direction');
  assert.equal(resolved.direction,plan.rangerFeet.facing<0?'left':'right');
  assert.equal(resolved.frame.flipX,plan.rangerFeet.facing<0);
  assert.equal(v177RangerFootPlan('ranger',plan,{actor,world,width:96}),plan,'the draw must keep the ability-owned prepaint direction');
  const target=main({matrix:[plan.rangerFeet.facing,0,0,1,actor.x,actor.y]});
  assert.equal(drawV177JointPose(target.ctx,img,'ranger',plan,-48,-86,96,89.6,{actor,world}),true);
  const receipt=v177RenderedWeightedLowerReceipt(actor,world);
  assert.equal(receipt.mode,'continuous-weighted-mesh');assert.deepEqual(receipt.footWorldX,originalFeet);
  assert.equal(JSON.stringify(world),before);assert.equal(runtime.direction,'right');
  const initial=actor.manualAbility;let impactFacing;
  for(let tick=1;tick<=30;tick++){
    world.time=20+tick/60;const advanced=advanceManualAbility(initial,tick/60);actor.manualAbility=advanced.runtime;
    const manual=v177JointPose('ranger',{requestedState:'special'},runtime,{actor,world,ownedPose:true,
      rangerManualOwner:true,rangerManualDefinition:MANUAL_ABILITY_REGISTRY.ranger});
    const next=prepaint(manual,'ranger',actor,{world},size,'left',v177RangerFootPlan);
    assert.equal(next.rangerFeet.turnTargetFacing??next.rangerFeet.facing,-1);
    const target=main({matrix:[next.rangerFeet.facing,0,0,1,actor.x,actor.y]});
    assert.equal(drawV177JointPose(target.ctx,img,'ranger',next,-48,-86,96,89.6,{actor,world}),true);
    if(advanced.events.some(event=>event.type==='impact'))impactFacing=next.rangerFeet.facing;
  }
  assert.equal(impactFacing,-1,'the actual ability impact must face the explicit target after its original windup');
});
