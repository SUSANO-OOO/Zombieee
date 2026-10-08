// Enter through the actual start menu after a fresh launch or save fixture.
// No product query flag or DOM mutation bypasses the title gate.
export async function finishV100TitleIntro(page, { timeout = 30000 } = {}) {
  await page.locator('.v100-start-screen').waitFor({ state: 'visible', timeout });
  await page.waitForFunction(() => ['waiting','complete'].includes(document.querySelector('.v100-start-screen')?.dataset.titleIntro), null, { timeout });
  const tap = page.getByRole('button', { name: 'タップして開始', exact: true });
  if (await tap.isVisible()) await tap.click({ timeout });
  await page.locator('.v100-start-screen[data-title-intro="complete"]').waitFor({ state: 'visible', timeout });
}
export async function enterV100FromTitle(page, { timeout = 30000 } = {}) {
  await finishV100TitleIntro(page, { timeout });
  const resume = page.getByRole('button', { name: '続きから', exact: true });
  const control = await resume.isEnabled() ? resume : page.getByRole('button', { name: '初めから', exact: true });
  await control.click({ timeout });
}
