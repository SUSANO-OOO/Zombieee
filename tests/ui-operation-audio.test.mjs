import test from "node:test";
import assert from "node:assert/strict";
import {
  UI_OPERATION_CUE_IDS,
  UI_OPERATION_CUE_POLICIES,
  operationRejectMessage,
} from "../app/uiOperationAudio.js";

test("PR1 UI operation roles keep distinct production cue responsibilities", () => {
  assert.equal(UI_OPERATION_CUE_IDS.selection, "ui-select");
  assert.equal(UI_OPERATION_CUE_IDS.confirm, "ui-confirm");
  assert.equal(UI_OPERATION_CUE_IDS.back, "ui-cancel");
  assert.equal(UI_OPERATION_CUE_IDS.purchase, "sfx-v070-terminal-confirm");
  assert.equal(UI_OPERATION_CUE_IDS.upgrade, "sfx-v070-power-switch");
  assert.equal(UI_OPERATION_CUE_IDS.reward, "sfx-v070-rescue-confirm");
  assert.equal(UI_OPERATION_CUE_IDS.deploy, "support-pod-deploy");
  assert.equal(UI_OPERATION_CUE_IDS.reject, "ui-error");
  assert.notEqual(UI_OPERATION_CUE_IDS.selection, UI_OPERATION_CUE_IDS.back);
  assert.notEqual(UI_OPERATION_CUE_IDS.purchase, UI_OPERATION_CUE_IDS.reject);
  assert.notEqual(UI_OPERATION_CUE_IDS.purchase, UI_OPERATION_CUE_IDS.upgrade);
  assert.notEqual(UI_OPERATION_CUE_IDS.upgrade, UI_OPERATION_CUE_IDS.reward);
});

test("reject policy is short, low priority, rate limited and single-voice", () => {
  assert.equal(UI_OPERATION_CUE_POLICIES.reject.maxInstances, 1);
  assert.ok(UI_OPERATION_CUE_POLICIES.reject.cooldownMs >= 200);
  assert.ok(UI_OPERATION_CUE_POLICIES.reject.priority < UI_OPERATION_CUE_POLICIES.confirm.priority);
});

test("transaction reject reasons produce visible, non-comical feedback copy", () => {
  assert.equal(operationRejectMessage("insufficient-caps", "レイダーの雇用"), "レイダーの雇用：キャップが不足しています");
  assert.equal(operationRejectMessage("already-owned", "雇用"), "雇用：すでに所有済みです");
  assert.equal(operationRejectMessage("capacity", "編成"), "編成：編成上限に達しています");
  assert.equal(operationRejectMessage("unknown", "操作"), "操作：成立しませんでした");
});
