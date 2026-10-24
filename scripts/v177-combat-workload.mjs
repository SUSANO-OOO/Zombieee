import assert from 'node:assert/strict';

const all = Object.freeze([Object.freeze([1280, 720]), Object.freeze([844, 390]), Object.freeze([844, 340])]);
const groups = Object.freeze({ all, 'desktop-phone': Object.freeze(all.slice(0, 2)), 'phone-short': Object.freeze(all.slice(2)) });
export function v177CombatViewports(group = 'all') {
  assert.ok(Object.hasOwn(groups, group), 'unknown combat viewport group');
  return groups[group];
}

// A hanging browser/video shutdown must leave an honest incomplete report,
// including the runtime evidence collected before the workflow deadline.
export async function closeV177CombatReport(report, closeBrowser, persist) {
  report.verificationStatus = report.status;
  report.status = 'closing'; report.cleanupStatus = 'pending';
  await persist();
  try {
    await closeBrowser();
    report.cleanupStatus = 'completed';
    report.status = report.verificationStatus;
  } catch (error) {
    report.cleanupStatus = 'failed'; report.cleanupError = String(error); report.status = 'failed';
  }
  await persist();
}
