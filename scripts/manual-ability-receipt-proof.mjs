// A single activation can record both its start and its later impact.
export function manualAbilityReceiptProof(receipts, { ownerId, kind }) {
  const errors=[];
  if(!Array.isArray(receipts))return {valid:false,errors:['missing receipts'],startCount:0,impactCount:0,activationId:null};
  const starts=receipts.filter(receipt=>receipt.eventType==='start');
  const impacts=receipts.filter(receipt=>receipt.eventType==='impact');
  if(starts.length!==1)errors.push('expected exactly one activation start');
  const activationId=starts.length===1?starts[0].activationId:null;
  if(!Number.isSafeInteger(activationId)||activationId<1)errors.push('invalid activation identity');
  if(receipts.some(receipt=>receipt.ownerId!==ownerId||receipt.kind!==kind))errors.push('unexpected activation owner or kind');
  if(receipts.some(receipt=>receipt.activationId!==activationId))errors.push('multiple activation identities');
  if(receipts.some(receipt=>!['start','impact'].includes(receipt.eventType)))errors.push('unexpected activation event');
  if(impacts.length>1)errors.push('duplicate impact');
  return {valid:errors.length===0,errors,startCount:starts.length,impactCount:impacts.length,activationId};
}
