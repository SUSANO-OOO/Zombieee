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

// Stable presentation fixtures wait after the actual intro gesture. The gesture
// can start a new native range request, so an earlier preload snapshot is stale.
// Rapid title departure remains covered by the audio lifecycle fixtures.
export function v100TitleMusicIsBuffered(state) {
  if (!state) {
    const audio = document.querySelector('[data-title-music]');
    if (!audio) return false;
    state = {
      intro: document.querySelector('.v100-start-screen')?.dataset.titleIntro,
      error: audio.error,
      duration: audio.duration,
      networkState: audio.networkState,
      readyState: audio.readyState,
      ranges: Array.from({ length: audio.buffered.length }, (_, index) => [audio.buffered.start(index), audio.buffered.end(index)]),
    };
  }
  if (state.intro !== 'complete' || state.error || !Number.isFinite(state.duration) || state.duration <= 0
    || state.networkState !== 1 || state.readyState < 4 || !state.ranges?.length) return false;
  let covered = 0;
  for (const [start, end] of state.ranges) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start > covered) return false;
    covered = Math.max(covered, end);
  }
  return covered >= state.duration;
}

export async function enterV100FromBufferedTitle(page, { timeout = 30000 } = {}) {
  await finishV100TitleIntro(page, { timeout });
  try {
    await page.waitForFunction(v100TitleMusicIsBuffered, null, { timeout });
  } catch (error) {
    const native = await page.evaluate(() => {
      const audio = document.querySelector('[data-title-music]');
      return { intro: document.querySelector('.v100-start-screen')?.dataset.titleIntro,
        media: audio ? { src: audio.currentSrc, duration: audio.duration, networkState: audio.networkState,
          readyState: audio.readyState, paused: audio.paused,
          error: audio.error ? { code: audio.error.code, message: audio.error.message } : null,
          ranges: Array.from({ length: audio.buffered.length }, (_, index) => [audio.buffered.start(index), audio.buffered.end(index)]) } : null };
    }).catch(snapshotError => ({ snapshotError: String(snapshotError) }));
    throw new Error(`Title media buffering failed: ${JSON.stringify(native)}`, { cause: error });
  }
  await enterV100FromTitle(page, { timeout });
}
