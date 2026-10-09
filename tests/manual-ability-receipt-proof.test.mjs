import test from 'node:test';
import assert from 'node:assert/strict';
import {manualAbilityReceiptProof} from '../scripts/manual-ability-receipt-proof.mjs';
const target={ownerId:7,kind:'medic'};
const start={...target,eventType:'start',activationId:1};
const impact={...target,eventType:'impact',activationId:1};
test('one start remains one activation when its normal healing impact arrives',()=>{
  for(const receipts of [[start],[start,impact]]){
    const proof=manualAbilityReceiptProof(receipts,target);
    assert.equal(proof.valid,true);assert.equal(proof.startCount,1);assert.equal(proof.activationId,1);
  }
});
test('duplicate starts, duplicate impacts and receipts from other owners are rejected',()=>{
  for(const receipts of [[],[start,start],[start,impact,impact],[start,{...impact,ownerId:8}],[start,{...impact,kind:'scout'}],[start,{...impact,activationId:2}],[start,{...impact,eventType:'unknown'}],[{...start,activationId:null}]])assert.equal(manualAbilityReceiptProof(receipts,target).valid,false);
  assert.equal(manualAbilityReceiptProof(undefined,target).valid,false);
});
