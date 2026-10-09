import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { v100EventPortraitSnapshot } from "../scripts/v100-event-portrait-audit.mjs";

function portrait({secondary=false, opacity="1", animations=[], complete=true, naturalWidth=512, src="portrait.webp"}={}) {
  const frame = {style:{overflow:"hidden"}, getBoundingClientRect:()=>({width:280,height:320}), getAttribute:name=>name==="data-portrait-owner"?"unit-paisen":"waist-up-common"};
  return {complete,naturalWidth,style:{opacity,objectFit:"contain",backgroundColor:"rgba(0, 0, 0, 0)"},
    getAttribute:()=>src,
    classList:{contains:()=>secondary}, getAnimations:()=>animations,
    getBoundingClientRect:()=>({width:240,height:300}), closest:()=>frame};
}

function audit(images, readStyle=element=>element.style, {nodeIndex="3", identities=images.map(image=>({src:image.getAttribute("src"),owner:"unit-paisen"}))}={}) {
  return vm.runInNewContext(`(${v100EventPortraitSnapshot.toString()})(expected)`, {
    expected:{selector:".event",nodeIndex:"3",identities},
    document:{querySelector:()=>({getAttribute:()=>nodeIndex,querySelectorAll:()=>images})}, getComputedStyle:readStyle,
  });
}

test("portrait audit waits through an empty React remount", () => {
  assert.equal(audit([]), null);
});

test("opacity one before a pending fade starts is not settled evidence", () => {
  assert.equal(audit([portrait({animations:[{pending:true,playState:"running"}]})]), null);
  assert.equal(audit([portrait({animations:[{pending:false,playState:"paused"}]})]), null);
});

test("both portraits must decode and finish at exact full opacity", () => {
  assert.equal(audit([portrait(),portrait({secondary:true,opacity:"0.994316"})]), null);
  assert.equal(audit([portrait(),portrait({secondary:true,complete:false})]), null);
  assert.equal(audit([portrait({naturalWidth:0})]), null);
});

test("a replaced image or changed dialogue cursor cannot satisfy the old wait", () => {
  const image=portrait({src:"new-expression.webp"});
  assert.equal(audit([image],undefined,{identities:[{src:"old-expression.webp",owner:"unit-paisen"}]}),null);
  assert.equal(audit([image],undefined,{nodeIndex:"4"}),null);
});

test("completed and reduced-motion portraits retain framing measurements", () => {
  for (const animations of [[],[{pending:false,playState:"finished"}]]) {
    const actual = audit([portrait({animations}),portrait({secondary:true,animations})]);
    assert.equal(actual.opacity,"1");
    assert.equal(actual.objectFit,"contain");
    assert.equal(actual.frameFraming,"waist-up-common");
    assert.equal(actual.frameOverflow,"hidden");
    assert.equal(actual.width,240);
    assert.equal(actual.frameWidth,280);
  }
});

test("the accepted style is measured once and returned without a second sample", () => {
  const image=portrait();let imageReads=0;
  const actual=audit([image], element=> {
    if(element===image) {imageReads++;return {...image.style,opacity:imageReads===1?"1":"0.994316"};}
    return element.style;
  });
  assert.equal(imageReads,1);
  assert.equal(actual.opacity,"1");
});
