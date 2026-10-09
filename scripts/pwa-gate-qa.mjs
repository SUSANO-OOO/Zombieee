// Helpers for browser QA that has to get past the PWA gate to reach the game.
//
// The fiction notice precedes the install invitation. Since 0.9.7 the save
// environment moved off the title into the data screen. QA handles these
// deliberate entry steps here instead of repeating them in every scenario.

/**
 * Continues past the fiction notice and declines the install invitation.
 *
 * Silent when the invitation is absent: a device that already holds its pack, or
 * a context without service worker support, never sees it, and neither case is
 * a failure.
 */
export async function dismissInstallOffer(page, { timeout = 60_000 } = {}) {
  const deadline = Date.now() + timeout;
  const remaining = () => Math.max(1, deadline - Date.now());
  const skip = page.getByRole("button", { name: "ブラウザで遊ぶ" });
  const notice = page.locator(".fiction-notice").getByRole("button", { name: "続ける", exact: true });
  await skip.or(notice).first().waitFor({ state: "visible", timeout: remaining() }).catch(() => {});
  if (await notice.isVisible().catch(() => false)) {
    if (await notice.isEnabled()) await notice.click({ timeout: remaining() });
    await notice.waitFor({ state: "hidden", timeout: remaining() });
  }
  await skip.waitFor({ state: "visible", timeout: remaining() }).catch(() => {});
  if (!(await skip.isVisible().catch(() => false))) return false;
  await skip.click({ timeout: remaining() });
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
