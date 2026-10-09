import assert from "node:assert/strict";
import test from "node:test";
import { drawV100BossAftermath } from "../app/v100BossAftermath.js";

function fixture() {
  const calls = [];
  const image = { complete: true, naturalWidth: 128, naturalHeight: 128 };
  const ctx = { save() {}, restore() {}, drawImage(...args) { calls.push(args); } };
  return { calls, image, ctx, objects: { "v100-dust": image } };
}
const entry = { kind: "takuya-omega", x: 400, y: 250, elapsed: .4, duration: 1.1, phase: "active" };

test("boss aftermath uses decoded ground texture without borrowing weapons or painting a contact", () => {
  for (const kind of ["ooguchi", "gairen", "futago", "mugarian-president-mutated", "takuya-omega"]) {
    const f = fixture();
    assert.equal(drawV100BossAftermath(f.ctx, f.objects, { ...entry, kind }), true);
    assert.equal(f.calls.length, 3);
    assert.ok(f.calls.every(([source, ...values]) => source === f.image && values.every(Number.isFinite)));
    assert.equal(f.ctx.globalCompositeOperation, "source-over");
    assert.ok(f.ctx.globalAlpha > 0 && f.ctx.globalAlpha < .22);
  }
});

test("unknown, windup, expired and invalid aftermath states draw nothing; missing texture fails closed", () => {
  for (const patch of [{ kind: "takuya" }, { phase: "windup" }, { elapsed: -1 }, { elapsed: 1.1 }, { x: NaN }, { duration: 0 }]) {
    const f = fixture();
    assert.equal(drawV100BossAftermath(f.ctx, f.objects, { ...entry, ...patch }), false);
    assert.equal(f.calls.length, 0);
  }
  assert.throws(() => drawV100BossAftermath(fixture().ctx, {}, entry), /must decode/);
  const f = fixture();
  assert.equal(drawV100BossAftermath(f.ctx, f.objects, { ...entry, phase: "recovery" }), true);
  assert.ok(f.ctx.globalAlpha < .08);
});
