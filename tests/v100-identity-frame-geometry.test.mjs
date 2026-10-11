import test from 'node:test';
import assert from 'node:assert/strict';
import {assertV100IdentityFrames,assertV100IdentitySizingControl} from '../scripts/v100-identity-frame-geometry.mjs';

// Independent source-cell controls. These are not native-browser acceptance.
const frames=()=>[
  {x:170,y:95,width:290,height:265,viewBox:{x:0,y:0,width:512,height:757},relativeTransform:[.3500660501981506,0,0,.3500660501981506,225.38309114927346,95]},
  {x:530,y:95,width:300,height:265,viewBox:{x:0,y:0,width:544,height:512},relativeTransform:[.517578125,0,0,.517578125,539.21875,95]},
].map(frame=>({...frame,preserveAspectRatio:{align:6,meetOrSlice:1},cssWidth:'auto',cssHeight:'auto',overflowX:'hidden',overflowY:'hidden',filter:'none',sourceFrameClipped:true}));

test('SVG identity accepts finite rendered source corners when CSS dimensions are auto',()=>{
  assert.doesNotThrow(()=>assertV100IdentityFrames(frames()));
  const pixels=frames();for(const f of pixels){f.cssWidth=f.width+'px';f.cssHeight=f.height+'px';}
  assert.doesNotThrow(()=>assertV100IdentityFrames(pixels));
});

test('Identity acceptance rejects changed geometry, missing measurements and neighboring frame exposure',()=>{
  for(const mutate of [
    a=>{a[0].relativeTransform[0]+=.001;}, // 0.512px at the source edge.
    a=>{a[1].relativeTransform[4]+=.051;},
    a=>{a[0].relativeTransform[2]=.01;},
    a=>{a[0].relativeTransform=null;},
    a=>{a[1].relativeTransform[0]=NaN;},
    a=>{a[0].width+=20;},
    a=>{a[0].viewBox.width=3072;},
    a=>{a[1].overflowY='visible';},
    a=>{a[0].filter='drop-shadow(0px 10px 24px black)';},
    a=>{a[1].sourceFrameClipped=false;},
    a=>{a.pop();},
  ]){const bad=frames();mutate(bad);assert.throws(()=>assertV100IdentityFrames(bad));}
});

test('The hosted sizing control rejects each enlarged source frame and preserves the original acceptance',()=>{
  const before=frames(),scaled=frames();for(const f of scaled){f.relativeTransform[0]*=1.1;f.relativeTransform[3]*=1.1;f.cssTransform='matrix(1.1, 0, 0, 1.1, 0, 0)';}
  const evidence=assertV100IdentitySizingControl(before,scaled);
  assert.equal(evidence.length,2);assert.ok(evidence.every(e=>e.widthScale>1.05&&e.heightScale>1.05&&e.maxCornerDisplacementPx>20));
  assert.doesNotThrow(()=>assertV100IdentityFrames(before));
});

test('A CSS-only no-op, partial mutation or missing rendered matrix cannot pass the sizing control',()=>{
  const before=frames(),noop=frames();for(const f of noop){f.cssWidth='999px';f.cssHeight='999px';f.cssTransform='matrix(1.1, 0, 0, 1.1, 0, 0)';}
  assert.throws(()=>assertV100IdentitySizingControl(before,noop),/must actually enlarge/);
  const partial=frames();partial[0].relativeTransform[0]*=1.1;partial[0].relativeTransform[3]*=1.1;
  assert.throws(()=>assertV100IdentitySizingControl(before,partial),/must actually enlarge/);
  const missing=frames();missing[0].relativeTransform=null;assert.throws(()=>assertV100IdentitySizingControl(before,missing),/finite rendered geometry/);
});
