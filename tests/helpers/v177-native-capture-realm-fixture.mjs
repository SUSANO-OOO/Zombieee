import assert from 'node:assert/strict';

// Transport fixture only. The actual browser-reference closure is exercised in
// v177-native-realm-owner.test.mjs; these receipts do not establish native QA.
export function nativeCaptureRealmFixture(timeOrigin, events) {
  let sequence = 0;
  const member = name => ({schema: 'v177-native-realm-member/v1',
    ownerId: '12345678-1234-4123-8123-123456789abc', createdAt: 0,
    rawOriginAtCreation: timeOrigin, sequence: ++sequence, member: name});
  const owner = member('owner-created');
  const raf = {started: member('raf-start')};
  const clip = {created: member('recorder-create'), started: member('recorder-start'),
    finished: member('recorder-finish')};
  raf.stopped = member('raf-stop'); raf.failure = null;
  const handle = {async evaluate(fn) {
    assert.equal(fn.name, 'readNativeAllUnitRealmOwner'); return owner;
  }, async dispose() { events.push('owner-disposed'); }};
  return {owner, handle, raf, clip};
}
