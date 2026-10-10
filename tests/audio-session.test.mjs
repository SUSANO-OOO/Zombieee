import test from "node:test";
import assert from "node:assert/strict";
import { createPlaybackAudioSession } from "../app/audioSession.js";

class FakeSession extends EventTarget {
  constructor() { super(); this.value = "auto"; this.route = "ambient"; this.writes = []; this.state = "active"; }
  get type() { return this.value; }
  set type(value) {
    if (value === this.value) return;
    this.writes.push(value); this.value = value; this.route = value;
  }
  setState(state) { this.state = state; this.dispatchEvent(new Event("statechange")); }
}
function fixture(session = new FakeSession()) {
  const windowTarget = new EventTarget(), documentTarget = new EventTarget();
  documentTarget.visibilityState = "visible";
  windowTarget.document = documentTarget;
  return { session, windowTarget, documentTarget, navigatorTarget: { audioSession: session } };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 10));

test("playback classification is lazy and restores the original category after the last owner", () => {
  const f = fixture(), first = createPlaybackAudioSession(f), second = createPlaybackAudioSession(f);
  assert.equal(f.session.type, "auto", "mounting alone must not claim audio focus");
  first.prepare(); second.prepare();
  assert.equal(f.session.type, "playback");
  assert.deepEqual(f.session.writes, ["playback"]);
  first.dispose(); assert.equal(f.session.type, "playback");
  second.dispose(); assert.equal(f.session.type, "auto");
});

test("foreground repairs a stale OS category even when the JS type still says playback", async () => {
  const f = fixture(); let recovered = 0;
  const owner = createPlaybackAudioSession({ ...f, onRecover: () => { recovered++; } });
  try {
    owner.prepare(); f.session.route = "ambient";
    owner.prepare(); assert.equal(f.session.route, "ambient", "same-value assignments cannot repair the modeled WebKit cache");
    f.windowTarget.dispatchEvent(new Event("focus"));
    f.windowTarget.dispatchEvent(new Event("pageshow"));
    f.documentTarget.dispatchEvent(new Event("visibilitychange"));
    await flush();
    assert.equal(f.session.route, "playback");
    assert.deepEqual(f.session.writes, ["playback", "ambient", "playback"]);
    assert.equal(recovered, 1, "one coalesced recovery, not a timer retry loop");
  } finally { owner.dispose(); }
});

test("hidden, muted and completed owners cannot start or recover audio", async () => {
  for (const mode of ["hidden", "muted", "completed"]) {
    const f = fixture(); let allowed = true, recovered = 0;
    const owner = createPlaybackAudioSession({ ...f, canRecover: () => allowed, onRecover: () => { recovered++; } });
    try {
      owner.prepare();
      if (mode === "hidden") f.documentTarget.visibilityState = "hidden";
      else allowed = false;
      f.windowTarget.dispatchEvent(new Event("focus")); await flush();
      assert.equal(recovered, 0, mode); assert.deepEqual(f.session.writes, ["playback"], mode);
    } finally { owner.dispose(); }
  }
});

test("an OS interruption ends before a bounded route recovery is attempted", async () => {
  const f = fixture(); let recovered = 0;
  const owner = createPlaybackAudioSession({ ...f, onRecover: () => { recovered++; } });
  try {
    owner.prepare(); f.session.setState("interrupted");
    f.windowTarget.dispatchEvent(new Event("focus")); await flush();
    assert.equal(recovered, 0); assert.deepEqual(f.session.writes, ["playback"]);
    f.session.setState("active"); await flush();
    assert.equal(recovered, 1); assert.equal(f.session.type, "playback");
    f.session.setState("active"); await flush(); assert.equal(recovered, 1);
  } finally { owner.dispose(); }
});

test("a cancelled recovery cannot reclaim the category from a newly mounted owner", async () => {
  const f = fixture(); let oldRecoveries = 0, newRecoveries = 0;
  const old = createPlaybackAudioSession({ ...f, onRecover: () => { oldRecoveries++; } });
  old.prepare(); const pending = old.recover(); old.dispose();
  const next = createPlaybackAudioSession({ ...f, onRecover: () => { newRecoveries++; } });
  try {
    next.prepare(); await pending;
    assert.equal(oldRecoveries, 0); assert.equal(newRecoveries, 0); assert.equal(f.session.type, "playback");
    f.windowTarget.dispatchEvent(new Event("focus")); await flush(); assert.equal(newRecoveries, 1);
  } finally { next.dispose(); }
});

test("an interruption arriving at the route boundary defers recovery until the OS returns", async () => {
  const f = fixture(); let recovered = 0;
  const owner = createPlaybackAudioSession({ ...f, onRecover: () => { recovered++; } });
  try {
    owner.prepare(); const pending = owner.recover(); f.session.setState("interrupted");
    await pending;
    assert.equal(recovered, 0);
    assert.deepEqual(f.session.writes, ["playback", "ambient"]);
    f.session.setState("active"); await flush();
    assert.equal(recovered, 1); assert.equal(f.session.type, "playback");
  } finally { owner.dispose(); }
});

test("cancellation during the task boundary leaves no audible recovery request", async () => {
  const f = fixture(); let allowed = true, recovered = 0;
  const owner = createPlaybackAudioSession({ ...f, canRecover: () => allowed, onRecover: () => { recovered++; } });
  try {
    owner.prepare(); const pending = owner.recover(); allowed = false; await pending;
    assert.equal(recovered, 0); assert.equal(f.session.type, "auto");
  } finally { owner.dispose(); }
});

test("unsupported or rejecting AudioSession APIs preserve ordinary foreground recovery", async () => {
  for (const session of [null, { get type() { return "auto"; }, set type(_) { throw new Error("unsupported"); } }]) {
    const f = fixture(session); let recovered = 0;
    const owner = createPlaybackAudioSession({ ...f, onRecover: () => { recovered++; } });
    try {
      assert.doesNotThrow(() => owner.prepare());
      f.windowTarget.dispatchEvent(new Event("focus")); await flush(); assert.equal(recovered, 1);
    } finally { owner.dispose(); }
    f.windowTarget.dispatchEvent(new Event("focus")); await flush(); assert.equal(recovered, 1);
  }
});

test("disposing does not overwrite a category independently changed by another feature", () => {
  const f = fixture(), owner = createPlaybackAudioSession(f);
  owner.prepare(); f.session.type = "play-and-record"; owner.dispose();
  assert.equal(f.session.type, "play-and-record");
});
