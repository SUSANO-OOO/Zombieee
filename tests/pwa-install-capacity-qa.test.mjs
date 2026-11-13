import assert from "node:assert/strict";
import test from "node:test";
import {assertPwaInstallCapacity} from "../scripts/pwa-install-capacity-qa.mjs";

const bytes = 203280848;
test("first-install capacity accepts a wrapped caption without changing the expected amount", () => {
  for (const text of ["ダウンロード容量：194MB", "ダウンロード容量：\n194MB", "  ダウンロード容量： \n194MB  "]) {
    assert.equal(assertPwaInstallCapacity(text, bytes), "ダウンロード容量：194MB");
  }
});
test("missing, wrong or unrelated capacity cannot pass the first-install oracle", () => {
  for (const text of ["ダウンロード容量：193MB", "ダウンロード容量：194KB", "ダウンロード容量：1 94MB", "容量を確認しています…194MB", "ダウンロード容量：\n説明3\n194MB", "194MB", ""]) {
    assert.throws(() => assertPwaInstallCapacity(text, bytes));
  }
  for (const invalid of [0, -1, NaN, Infinity]) assert.throws(() => assertPwaInstallCapacity("ダウンロード容量：194MB", invalid));
});
