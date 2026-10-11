import assert from 'node:assert/strict';

// Serialized directly into the hosted browser; no local browser is started.
export function readV100IdentityFrames(element) {
  return [...element.querySelectorAll('[data-v100-insert="takuya-identity"] svg svg')].map(frame => {
    const style=getComputedStyle(frame);
    const clipId=frame.querySelector('g[clip-path]')?.getAttribute('clip-path')?.match(/^url\(#(.+)\)$/u)?.[1];
    const clip=clipId&&frame.querySelector('#'+CSS.escape(clipId)+' rect');
    const box=frame.viewBox.baseVal,parent=frame.parentElement.getScreenCTM(),screen=frame.getScreenCTM();
    const relative=parent&&screen?parent.inverse().multiply(screen):null;
    return {
      x:Number(frame.getAttribute('x')),y:Number(frame.getAttribute('y')),
      width:Number(frame.getAttribute('width')),height:Number(frame.getAttribute('height')),
      viewBox:{x:box.x,y:box.y,width:box.width,height:box.height},
      preserveAspectRatio:{align:frame.preserveAspectRatio.baseVal.align,meetOrSlice:frame.preserveAspectRatio.baseVal.meetOrSlice},
      cssWidth:style.width,cssHeight:style.height,
      cssTransform:style.transform,transformOrigin:style.transformOrigin,transformBox:style.transformBox,
      // Cancel responsive outer-SVG and page transforms before comparison.
      relativeTransform:relative?['a','b','c','d','e','f'].map(k=>relative[k]):null,
      overflowX:style.overflowX,overflowY:style.overflowY,filter:style.filter,
      sourceFrameClipped:Boolean(clip&&Number(clip.getAttribute('x'))===box.x&&Number(clip.getAttribute('y'))===box.y&&Number(clip.getAttribute('width'))===box.width&&Number(clip.getAttribute('height'))===box.height),
    };
  });
}

export function assertV100IdentitySizingControl(before,scaled) {
  assertV100IdentityFrames(before);
  assert.equal(scaled.length,before.length,'the sizing control must retain both source figures');
  return scaled.map((frame,i)=>{
    const original=before[i],m=frame.relativeTransform,b=original.relativeTransform,box=original.viewBox;
    assert.ok(Array.isArray(m)&&m.length===6&&m.every(Number.isFinite),'the sizing control requires finite rendered geometry');
    const widthScale=Math.hypot(m[0],m[1])/Math.hypot(b[0],b[1]);
    const heightScale=Math.hypot(m[2],m[3])/Math.hypot(b[2],b[3]);
    assert.ok(widthScale>1.05&&heightScale>1.05,'the CSS sizing control must actually enlarge each rendered source frame');
    const maxCornerDisplacementPx=Math.max(...[[0,0],[box.width,0],[0,box.height],[box.width,box.height]].map(([x,y])=>Math.hypot((m[0]-b[0])*x+(m[2]-b[2])*y+m[4]-b[4],(m[1]-b[1])*x+(m[3]-b[3])*y+m[5]-b[5])));
    assert.ok(maxCornerDisplacementPx>1,'the CSS sizing control must visibly change the rendered source corners');
    assert.throws(()=>assertV100IdentityFrames(before.map((f,j)=>i===j?frame:f)),/outer diagram sizing must not resize a sprite frame/,'each actually enlarged frame must fail the unchanged geometry contract');
    return {index:i,widthScale,heightScale,maxCornerDisplacementPx};
  });
}

export function assertV100IdentityFrames(frames) {
  assert.equal(frames.length,2,'the identity comparison must show two isolated figures');
  const bindings=[
    {x:170,y:95,width:290,height:265,viewBox:{x:0,y:0,width:512,height:757}},
    {x:530,y:95,width:300,height:265,viewBox:{x:0,y:0,width:544,height:512}},
  ];
  for(let i=0;i<frames.length;i++){
    const frame=frames[i],expected=bindings[i],box=expected.viewBox;
    assert.deepEqual({x:frame.x,y:frame.y,width:frame.width,height:frame.height,viewBox:frame.viewBox},expected,'identity viewport stays bound to the approved source cell');
    assert.deepEqual(frame.preserveAspectRatio,{align:6,meetOrSlice:1},'identity source uses xMidYMid meet');
    const m=frame.relativeTransform;
    assert.ok(Array.isArray(m)&&m.length===6&&m.every(Number.isFinite),'identity viewport requires finite rendered geometry');
    const scale=Math.min(expected.width/box.width,expected.height/box.height);
    const left=expected.x+(expected.width-box.width*scale)/2,top=expected.y+(expected.height-box.height*scale)/2;
    for(const[x,y]of [[0,0],[box.width,0],[0,box.height],[box.width,box.height]]){
      const actualX=m[0]*x+m[2]*y+m[4],actualY=m[1]*x+m[3]*y+m[5];
      assert.ok(Math.abs(actualX-(left+x*scale))<.05&&Math.abs(actualY-(top+y*scale))<.05,'outer diagram sizing must not resize a sprite frame');
    }
    assert.equal(frame.overflowX,'hidden','adjacent animation columns must stay clipped');
    assert.equal(frame.overflowY,'hidden','adjacent animation rows must stay clipped');
    assert.equal(frame.filter,'none','the diagram shadow belongs only to its outer frame');
    assert.equal(frame.sourceFrameClipped,true,'letterbox space must not reveal the neighboring sprite');
  }
}
