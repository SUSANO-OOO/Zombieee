// Enter through the actual start menu after a fresh launch or save fixture.
// No product query flag or DOM mutation bypasses the title gate.
export async function enterV100FromTitle(page, { timeout = 30000 } = {}) {
  await page.locator('.v100-start-screen').waitFor({ state: 'visible', timeout });
  const resume = page.getByRole('button', { name: '続きから', exact: true });
  const control = await resume.isEnabled() ? resume : page.getByRole('button', { name: '初めから', exact: true });
  await control.click({ timeout });
}
