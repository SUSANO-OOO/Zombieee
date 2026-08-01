// Helpers for browser QA that has to get past the PWA gate to reach the game.
//
// Since 0.9.7 a browser tab meets an invitation to install before the title, and
// the save environment moved off the title into the data screen. Both are
// deliberate product behaviour, and both would otherwise have to be re-handled
// in every scenario of every suite, so they live here once.

/**
 * Declines the install invitation so the scenario can reach the title.
 *
 * Silent when the invitation is absent: a device that already holds its pack, or
 * a context without service worker support, never sees it, and neither case is
 * a failure.
 */
export async function dismissInstallOffer(page, { timeout = 60_000 } = {}) {
  const skip = page.getByRole("button", { name: "ブラウザで遊ぶ" });
  await skip.waitFor({ state: "visible", timeout }).catch(() => {});
  if (!(await skip.isVisible().catch(() => false))) return false;
  await skip.click();
  return true;
}

/**
 * Reads the save environment from the data screen, then closes it again so the
 * scenario continues on the screen it started from.
 */
export async function readSaveEnvironment(page, { timeout = 30_000 } = {}) {
  const toggle = page.getByRole("button", { name: "データ管理" });
  await toggle.waitFor({ state: "visible", timeout });
  await toggle.click();
  const badge = page.locator('.pwa-storage .save-environment-badge:not([data-save-environment="checking"])');
  await badge.waitFor({ state: "visible", timeout });
  const environment = await badge.evaluate((element) => ({
    kind: element.getAttribute("data-save-environment"),
    origin: element.getAttribute("data-save-origin"),
  }));
  await page.getByRole("button", { name: "閉じる" }).click();
  await badge.waitFor({ state: "hidden", timeout });
  return environment;
}
