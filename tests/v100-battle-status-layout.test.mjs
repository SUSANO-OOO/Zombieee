import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutV100AllyHealthBars} from '../app/v100BattleStatusLayout.js';
const bounds={left:0,top:0,right:844,bottom:340};
test('visible health bars keep their owner, x position and original height without touching combat state',()=>{
 const owner={x:505,y:240,hp:80},rows=[{fighter:owner,x:505,y:110,width:27,height:6}];
 const copy=structuredClone(rows),[bar]=layoutV100AllyHealthBars(rows,{bounds});
 assert.deepEqual(rows,copy);assert.equal(bar.fighter,owner);assert.equal(bar.x,505);assert.equal(bar.y,110);
});
test('Ooguchi back-lane HP clears the warning and a nearby native skill button',()=>{
 const obstacles=[{x:0,y:0,width:844,height:54},{x:252,y:58,width:340,height:27},{x:484,y:120,width:44,height:44},{x:0,y:256,width:844,height:84}];
 const [bar]=layoutV100AllyHealthBars([{x:505,y:64.5,width:27,height:6}],{bounds,obstacles});
 assert.equal(bar.x,505);assert.equal(bar.y,89);
 for(const b of obstacles)assert.ok(bar.x+bar.width/2<=b.x||bar.x-bar.width/2>=b.x+b.width||bar.y+bar.height<=b.y||bar.y>=b.y+b.height);
});
test('crowded health bars share no pixels and stay within the cropped visible canvas',()=>{
 const rows=Array.from({length:7},(_,i)=>({id:i,x:505,y:100,width:28,height:6}));
 const placed=layoutV100AllyHealthBars(rows,{bounds:{...bounds,top:78,bottom:256},obstacles:[{x:252,y:78,width:340,height:30}]});
 for(const a of placed){assert.ok(a.y>=78&&a.y+a.height<=256);assert.equal(a.x,505);}
 for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++)assert.ok(Math.abs(placed[i].y-placed[j].y)>=6);
});
