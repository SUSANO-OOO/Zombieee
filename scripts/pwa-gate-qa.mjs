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
export async function dismissInstallOffer(page, { timeout = 60_000, readySelector = null, clickControl = null } = {}) {
  const deadline = Date.now() + timeout;
  const remaining = () => Math.max(1, deadline - Date.now());
  const skip = page.getByRole("button", { name: "ブラウザで遊ぶ" });
  const notice = page.locator(".fiction-notice").getByRole("button", { name: "続ける", exact: true });
  const ready = readySelector ? page.locator(readySelector) : null;
  const click = (control, label) => clickControl
    ? clickControl(control, label, { timeout: remaining() })
    : control.click({ timeout: remaining() });
  const waitForChoice = async (choice) => {
    const waiting = choice.first().waitFor({ state: "visible", timeout: remaining() });
    // A supplied destination makes readiness mandatory. Legacy callers that
    // only inspect an optional invitation retain their absent-offer behavior.
    if (ready) await waiting;
    else await waiting.catch(() => {});
  };
  await waitForChoice(ready ? skip.or(notice).or(ready) : skip.or(notice));
  if (await notice.isVisible().catch(() => false)) {
    if (await notice.isEnabled()) await click(notice, "fiction notice");
    await notice.waitFor({ state: "hidden", timeout: remaining() });
  }
  if (ready && await ready.isVisible()) return false;
  await waitForChoice(ready ? skip.or(ready) : skip);
  if (!(await skip.isVisible().catch(() => false))) return false;
  await click(skip, "PWA browser play");
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
