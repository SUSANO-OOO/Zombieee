import assert from 'node:assert/strict';
import { V100_UNITS } from '../app/v100Registry.js';

// Defer only the ordinary first-clear recruit offer. The existing economy
// route then makes its usual earned-CAPS decisions through the unit screen.
export async function deferNormalRecruitOffer(page,{saveAt,uiClick,stageNumber,transactions}={}){
  const dialog=page.locator('.v100-recruit-modal[role="dialog"]');
  if(!await dialog.isVisible())return null;
  const name=(await dialog.getByRole('heading',{level:2}).textContent())?.trim();
  const unit=V100_UNITS.find(unit=>unit.displayName===name),before=await saveAt();
  assert.ok(unit,'the visible recruit offer must identify a registered unit');
  assert.equal(before.lastResult?.firstClear,true);
  assert.equal(unit.availabilityStageNumber,before.lastResult.stageNumber);
  assert.ok(before.registeredUnitIds.includes(unit.id)&&!before.ownedUnitIds.includes(unit.id));
  const receipt=`v100:recruit-offer:${unit.id}:seen`;
  assert.ok(!before.receipts.includes(receipt),'an acknowledged offer must not block preparation again');
  await uiClick(dialog.getByRole('button',{name:'後で決める',exact:true}));
  await dialog.waitFor({state:'hidden',timeout:15_000});
  const after=await saveAt();
  const retained=save=>Object.fromEntries(Object.entries(save).filter(([key])=>!['revision','updatedAt','receipts'].includes(key)));
  assert.deepEqual(retained(after),retained(before),'deferring an offer cannot spend CAPS or alter progression, ownership or settings');
  assert.deepEqual(after.receipts,[...before.receipts,receipt]);
  const result={stageNumber,action:'defer-recruit-offer',id:unit.id,caps:after.caps,receipt};
  transactions?.push(result);
  return result;
}
