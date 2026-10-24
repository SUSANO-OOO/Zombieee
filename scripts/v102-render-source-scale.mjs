import assert from 'node:assert/strict';
import {V177_JOINT_ATLASES} from '../app/v177JointPresentation.js';
import {V177_CORPSE_JOINT_DATA} from '../app/v177CorpseJointData.js';

// A logical pose can use a different crop from the frame actually painted by
// the joint renderer. Measure the paint receipt, never infer its crop by pose.
export function renderedSourcePixelScale(receipt) {
  const actualRect = receipt?.sourceRect;
  let rect = actualRect;
  if(receipt?.corpseJointPose){
    const atlas=V177_JOINT_ATLASES[receipt.renderKind],data=V177_CORPSE_JOINT_DATA[receipt.renderKind];
    assert.ok(atlas&&data,'a corpse reference plane must have an actual registered joint source');
    assert.equal(receipt.spritePath,atlas.path);assert.equal(receipt.jointAtlasPath,atlas.path);
    assert.deepEqual(actualRect,{x:0,y:0,w:data.atlasSize.width,h:data.atlasSize.height});
    const reference=atlas.referenceFrame;
    assert.deepEqual(receipt.jointSourceReference,{x:0,y:0,w:reference.width,h:reference.height});
    // Compare the same authored reference plane as the live rig. The separate
    // atlas crop and every actually drawn part remain mandatory source proof.
    rect=receipt.jointSourceReference;
  }
  assert.ok(rect && ['x', 'y', 'w', 'h'].every(key => Number.isFinite(rect[key])), 'Actual painted source rectangle is required');
  assert.ok(rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0, 'Actual painted source rectangle must be positive');
  assert.equal(actualRect.y, receipt.sourceRow, 'Paint receipt row and crop agree');
  assert.ok(Number.isFinite(receipt.renderWidth) && receipt.renderWidth > 0
    && Number.isFinite(receipt.renderHeight) && receipt.renderHeight > 0, 'Actual painted dimensions are required');
  const xScale = receipt.renderWidth / rect.w, yScale = receipt.renderHeight / rect.h;
  assert.ok(Math.abs(xScale - yScale) < 1e-8, 'Actual painted source pixels retain equal horizontal and vertical scale');
  return yScale;
}
