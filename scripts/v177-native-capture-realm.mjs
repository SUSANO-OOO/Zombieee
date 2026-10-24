import assert from 'node:assert/strict';
import {assertNativeRealmMember} from './v177-native-allunit-contract.mjs';

export {createNativeAllUnitRealmOwner, readNativeAllUnitRealmOwner} from './v177-native-allunit-contract.mjs';

// The browser owns the actual Window/Document/Performance/Canvas references.
// Keep each independent raw origin read; equal rounded numbers cannot prove
// that two observations came from the same realm.
export function assertNativeCaptureRealm(row) {
  const {sourceRaf, nativeClip, realmOwner} = row;
  assert.ok(Number.isFinite(sourceRaf?.timeOrigin) && Number.isFinite(nativeClip?.timeOrigin),
    'Original raw clock origins must remain recorded');
  assertNativeRealmMember(realmOwner, realmOwner, 'owner-created', null);
  let previous = realmOwner;
  const check = (receipt, member) => {
    assertNativeRealmMember(realmOwner, receipt, member, previous);
    previous = receipt;
  };
  check(sourceRaf.realm?.started, 'raf-start');
  check(nativeClip.realm?.created, 'recorder-create');
  check(nativeClip.realm?.started, 'recorder-start');
  if (row.recordingStart) {
    assert.deepEqual(row.recordingStart.realm, nativeClip.realm.started,
      'The acknowledged start must belong to the same recorder state');
  }
  check(nativeClip.realm?.finished, 'recorder-finish');
  check(sourceRaf.realm?.stopped, 'raf-stop');
  assert.equal(sourceRaf.realm.failure, null);
  return {schema: 'v177-native-capture-realm-check/v1', ownerId: realmOwner.ownerId,
    rawOriginAtCreation: realmOwner.rawOriginAtCreation,
    rawRafTimeOrigin: sourceRaf.timeOrigin, rawRecorderTimeOrigin: nativeClip.timeOrigin,
    sameRealmVerified: true, originalSpeedAccepted: false, naturalnessAccepted: false};
}
