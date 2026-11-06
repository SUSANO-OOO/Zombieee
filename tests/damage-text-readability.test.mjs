import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutV100DamageTextPaint,resetV100DamageTextPaint} from '../app/v100DamageTextPlacement.js';
const bounds={left:0,top:0,right:844,bottom:340};
const measure=value=>({width:value.length*9,actualBoundingBoxLeft:value.length*4.5,actualBoundingBoxRight:value.length*4.5,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3});
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
test('S26 damage messages avoid the actual ability-name rectangle and each other',()=>{
 const obstacle={x:448.77,y:120.76,width:77.37,height:18.47};
 const labels=[{x:482,y:130,value:'着地 -21',life:.7,color:'red'},{x:454,y:144,value:'着地 -15',life:.7,color:'red'},{x:486,y:122,value:'共鳴 -17',life:.7,color:'red'}];
 const before=structuredClone(labels);
 assert.ok(overlap({x:455,y:118,width:54,height:15},obstacle),'old painted placement reproduces overlap');
 const rows=layoutV100DamageTextPaint(labels,{measure,obstacles:[obstacle],bounds});
 for(const [i,row] of rows.entries()){
  assert.ok(!overlap(row.rect,obstacle));
  assert.ok(rows.slice(0,i).every(p=>!overlap(row.rect,p.rect)));
 }
 assert.deepEqual(labels,before,'simulation coordinates, values and lifetime stay unchanged');
});
test('displaced text continues floating and does not snap back when an ability expires',()=>{
 const label={x:200,y:120,value:'着地 -21',life:.7};
 const [first]=layoutV100DamageTextPaint([label],{measure,obstacles:[{x:160,y:105,width:80,height:32}],bounds});
 assert.notEqual(first.y,label.y);
 label.y-=2.3;label.life-=.1;
 const [next]=layoutV100DamageTextPaint([label],{measure,obstacles:[],bounds});
 assert.ok(Math.abs(next.y-(first.y-2.3))<1e-9);assert.equal(next.x,first.x);
 resetV100DamageTextPaint(label);
 const [reused]=layoutV100DamageTextPaint([label],{measure,obstacles:[],bounds});
 assert.equal(reused.y,label.y);assert.equal(reused.x,label.x);
});
test('cropped mobile bounds and HUD are reserved for a burst of labels',()=>{
 const cropped={left:80,top:20,right:700,bottom:300};
 const obstacles=[{x:80,y:20,width:620,height:42},{x:80,y:250,width:620,height:50},{x:400,y:110,width:92,height:32}];
 const labels=Array.from({length:16},(_,i)=>({x:i%2?690:90,y:135,value:'共鳴 -17',life:.7}));
 const rows=layoutV100DamageTextPaint(labels,{measure,obstacles,bounds:cropped});
 for(const [i,row]of rows.entries()){
  assert.ok(row.rect.x>=cropped.left&&row.rect.x+row.rect.width<=cropped.right);
  assert.ok(row.rect.y>=cropped.top&&row.rect.y+row.rect.height<=cropped.bottom);
  assert.ok(obstacles.every(p=>!overlap(row.rect,p)));assert.ok(rows.slice(0,i).every(p=>!overlap(row.rect,p.rect)));
 }
});

test('34 simultaneous hits use empty side columns rather than returning to an occupied ability name',()=>{
 const obstacles=[{x:0,y:0,width:844,height:42},{x:0,y:300,width:844,height:40},{x:375,y:140,width:50,height:8},{x:360,y:90,width:80,height:32}];
 const labels=Array.from({length:34},(_,i)=>({x:400,y:100+(i%8)*16,value:'着地 -21',life:.7}));
 const rows=layoutV100DamageTextPaint(labels,{bounds,obstacles,measure:()=>({width:60,actualBoundingBoxLeft:30,actualBoundingBoxRight:30,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3})});
 for(const [i,row]of rows.entries()){
  assert.ok(obstacles.every(p=>!overlap(row.rect,p)));assert.ok(rows.slice(0,i).every(p=>!overlap(row.rect,p.rect)));
 }
});
