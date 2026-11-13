import assert from "node:assert/strict";
import {formatBytes} from "../app/pwaAssetManifest.js";

// Layout may put the caption and value on separate visual lines. Only that
// separator is flexible; the visible value must still match the real pack.
export function assertPwaInstallCapacity(displayed, expectedBytes) {
  assert.ok(Number.isSafeInteger(expectedBytes) && expectedBytes > 0, "Expected a positive offline pack size");
  const expected = `ダウンロード容量：${formatBytes(expectedBytes)}`;
  const observed = String(displayed).trim().replace(/^ダウンロード容量：\s*/u, "ダウンロード容量：");
  assert.equal(observed, expected, "Visible download capacity must match the shipped manifest");
  return expected;
}
