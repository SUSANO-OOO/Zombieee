import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectV177PaintedSceneFaces} from '../scripts/v177-painted-scene-geometry.mjs';

const shot={id:'s01-nao-rescue',sourceWidth:1920,sourceHeight:640,landmarkSourcePath:'/art/v100/quality-20261028/scenes/s01-nao-rescue-r1.webp',landmarks:[{id:'paisen-face',rect:[240,180,160,120]},{id:'nao-face',rect:[1120,120,120,120]}]};
const geometry={scene:{x:0,y:0,width:844,height:340},headingBox:{x:8,y:8,width:828,height:60},copy:{x:8,y:250,width:828,height:82},
 detailShots:[{id:shot.id,frame:{x:640,y:100,width:180,height:90}}],
 paintedImage:{src:'http://127.0.0.1:4177'+shot.landmarkSourcePath,complete:true,naturalWidth:1920,naturalHeight:640,axisAligned:true,objectFit:'contain',objectPosition:'50% 0%',opacity:1,visibility:'visible',display:'block',ancestorPaintHidden:false,layoutWidth:844,layoutHeight:132,rect:{x:0,y:90,width:844,height:132}}};

test('declared panorama faces project inside the actual letterboxed image with contain sizing',()=>{
 const result=inspectV177PaintedSceneFaces(shot,geometry);
 assert.deepEqual(result.issues,[]);assert.equal(result.faces.length,2);
 assert.deepEqual(result.faces[0].rect,{x:273.5,y:127.125,width:33,height:24.75});
});

test('a different source, wrong decoded dimensions or restored cover crop cannot pass the panorama contract',()=>{
 for(const change of [{src:'http://127.0.0.1:4177/other.webp'},{naturalWidth:1280},{naturalHeight:720},{objectFit:'cover'},{complete:false},{opacity:0}]){
  const result=inspectV177PaintedSceneFaces(shot,{...geometry,paintedImage:{...geometry.paintedImage,...change}});assert.ok(result.issues.length,JSON.stringify(change));
 }
 for(const change of [{sourceWidth:0},{sourceHeight:NaN},{landmarkSourcePath:undefined}])assert.ok(inspectV177PaintedSceneFaces({...shot,...change},geometry).issues.length);
});

test('moving a real-size obstruction over a projected face is rejected independently of source validity',()=>{
 const face=inspectV177PaintedSceneFaces(shot,geometry).faces[0].rect;
 const result=inspectV177PaintedSceneFaces(shot,{...geometry,detailShots:[{id:shot.id,frame:{...face,width:180,height:90}}]});
 assert.ok(result.issues.includes('paisen-face: covered by detail:'+shot.id));
 const heading=inspectV177PaintedSceneFaces(shot,{...geometry,headingBox:{...face}});assert.ok(heading.issues.includes('paisen-face: covered by heading'));
});
