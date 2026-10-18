import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {V177_JOINT_ATLASES,v177JointPose,v177RangerFootPlan,drawV177JointPose,v177RenderedWeightedLowerReceipt,v177RenderedJointWeaponSocket} from '../app/v177JointPresentation.js';
import {createV177RangerLowerPose,v177RangerLowerPose} from '../app/v177RangerLowerMotion.js';
import {createV177RangerLowerPainter,paintV177RangerLower} from '../app/v177RangerLowerPaint.js';
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
function main({width=1280,height=720,matrix=[1,0,0,1,0,0]}={}){
  const calls=[],stack=[];let m=[...matrix];const ctx={canvas:{width,height},globalAlpha:.73,globalCompositeOperation:'source-over',filter:'none',
    getTransform:()=>Object.fromEntries(['a','b','c','d','e','f'].map((key,i)=>[key,m[i]])),
    save(){stack.push([...m]);},restore(){m=stack.pop();},setTransform(...value){m=[...value];},transform(...value){m=multiply(m,value);},
    translate(x,y){m=multiply(m,[1,0,0,1,x,y]);},scale(x,y){m=multiply(m,[x,0,0,y,0,0]);},
    drawImage(img,...rect){calls.push({matrix:[...m],rect,pixels:img.data?new Uint8ClampedArray(img.data.data):null,sourceWidth:img.width});}};
  return {ctx,calls,stack};
}

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
test('continuous lower corrects the backward near knee while keeping original foot contacts, far leg and limb lengths',()=>{
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
