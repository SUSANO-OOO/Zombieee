import assert from "node:assert/strict";

export const BLOCKED_WORKER_MARKER = "Service Worker registration blocked by Playwright";

export function assertExpectedBlockedWorkerEntry({ policy, warnings, details = "" }) {
  assert.equal(policy, "block", "Only an explicitly blocked-worker fixture may bypass registration");
  assert.ok(warnings?.some(value => value.includes(BLOCKED_WORKER_MARKER)), "Missing deliberate browser worker-block warning");
  assert.ok(!details.trim() || details.includes(BLOCKED_WORKER_MARKER), "Unexpected registration error must remain a failure");
}

export async function acknowledgeBlockedWorkerEntry(page, record, { phase, timeout = 30000 } = {}) {
  const gate = page.getByRole("dialog", { name: "ゲームデータの準備", exact: true });
  const choice = gate.getByRole("button", { name: "保存せずに試す", exact: true });
  if (!(await choice.isVisible())) return false;
  const details = (await gate.locator("details").allTextContents()).join("\n");
  assertExpectedBlockedWorkerEntry({ policy: record.serviceWorkerPolicy, warnings: record.diagnostics.warnings, details });
  record.blockedWorkerEntries ??= [];
  record.blockedWorkerEntries.push({ phase, details, reason: BLOCKED_WORKER_MARKER, choice: "保存せずに試す" });
  await choice.click({ timeout });
  return true;
}
