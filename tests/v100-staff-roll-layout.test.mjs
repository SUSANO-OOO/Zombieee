import test from 'node:test';
import assert from 'node:assert/strict';
import {staffRollFilmLayoutReady} from '../scripts/v100-staff-roll-audit.mjs';

const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
const phone={cinema:true,viewport:{width:844,height:340},picture:rect(0,0,576,340),roll:rect(588,16,240,264)};

test('a complete film fills the left area with twelve pixels clear of readable credits',()=>{
 assert.equal(staffRollFilmLayoutReady(phone),true);
 assert.equal(staffRollFilmLayoutReady({cinema:true,viewport:{width:1280,height:720},picture:rect(0,0,954,720),roll:rect(966,16,298,644)}),true);
});

test('the former full-viewport image and text overlap is rejected',()=>{
 assert.equal(staffRollFilmLayoutReady({...phone,picture:rect(0,0,844,340)}),false);
 assert.equal(staffRollFilmLayoutReady({...phone,picture:rect(0,0,590,340)}),false);
 assert.equal(staffRollFilmLayoutReady({...phone,picture:rect(0,0,580,340)}),false);
 assert.equal(staffRollFilmLayoutReady({...phone,picture:rect(0,0,100,340)}),false,'a tiny image does not fill the available area');
});

test('missing, zero, clipped and malformed layout evidence cannot pass',()=>{
 for(const invalid of [undefined,{}, {...phone,cinema:false}, {...phone,picture:rect(0,0,0,340)},
  {...phone,picture:rect(0,-1,576,341)}, {...phone,picture:rect(0,0,576,341)},
  {...phone,roll:rect(588,16,257,264)}, {...phone,roll:rect(400,16,428,264)},
  {...phone,picture:{...phone.picture,width:NaN}}, {...phone,picture:{...phone.picture,width:575}},
  {...phone,viewport:{width:0,height:340}}]) assert.equal(staffRollFilmLayoutReady(invalid),false,JSON.stringify(invalid));
});
