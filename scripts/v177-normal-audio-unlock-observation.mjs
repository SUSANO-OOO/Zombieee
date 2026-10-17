export const NORMAL_AUDIO_UNLOCK_ATTEMPT_LIMIT = 16;
export const NORMAL_AUDIO_UNLOCK_READ_MS = 1000;

// Serialized by page.evaluate. Keep every dependency inside this function.
export function readNormalAudioUnlockSnapshot() {
  const token = value => typeof value === 'string' && /^[a-z0-9:_-]{1,64}$/iu.test(value) ? value : null;
  const number = value => Number.isFinite(value) ? value : null;
  const boolean = value => typeof value === 'boolean' ? value : null;
  const errorName = error => token(error?.name) ?? 'Error';
  const read = (owner, method, select) => {
    try {
      if (typeof owner?.[method] !== 'function') return { status: 'unknown', reason: 'getter-unavailable' };
      const value = owner[method]();
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { status: 'unknown', reason: 'invalid-getter-data' };
      return { status: 'ok', value: select(value) };
    } catch (error) {
      return { status: 'data-error', reason: 'getter-rejected', errorName: errorName(error) };
    }
  };
  const bridge = window.__ASHFALL_AUDIO_QA__;
  const audioStatus = read(bridge, 'getAudioStatus', value => ({
    state: token(value.state), contextState: token(value.contextState), needsGesture: boolean(value.needsGesture),
    reason: token(value.reason), errorPresent: Boolean(value.error),
  }));
  const diagnostics = read(bridge, 'getDiagnostics', value => ({
    unlocked: boolean(value.unlocked), contextState: token(value.contextState),
    contextGeneration: number(value.contextGeneration), contextCreateCount: number(value.contextCreateCount),
    lifecycleHidden: boolean(value.lifecycleHidden), disposed: boolean(value.disposed),
    audioState: token(value.audioState), needsGesture: boolean(value.needsGesture),
    activeVoices: number(value.activeVoices), activeBgmVoices: number(value.activeBgmVoices),
    activeSceneVoices: number(value.activeSceneVoices), cacheFailed: number(value.cache?.failed),
    failedAssetCount: Array.isArray(value.failedAssets) ? value.failedAssets.length : null,
    failedCategories: Array.isArray(value.failedAssets) ? value.failedAssets.slice(0, 64).map(asset => ({
      category: token(asset.category), optional: boolean(asset.optional),
    })) : null,
    failedCategoriesTruncated: Array.isArray(value.failedAssets) && value.failedAssets.length > 64,
    output: value.output ? { mode: token(value.output.mode), paused: boolean(value.output.paused), disposed: boolean(value.output.disposed) } : null,
  }));
  const selector = '[data-audio-unlock-control="true"]';
  let controls;
  try {
    const nodes = [...document.querySelectorAll(selector)];
    controls = { status: 'ok', total: nodes.length, truncated: nodes.length > 4, values: nodes.slice(0, 4).map(control => {
      try {
        const bounds = control.getBoundingClientRect();
        const rect = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, number(bounds[key])]));
        const style = window.getComputedStyle(control);
        const x = rect.x === null || rect.width === null ? null : rect.x + rect.width / 2;
        const y = rect.y === null || rect.height === null ? null : rect.y + rect.height / 2;
        const inViewport = x !== null && y !== null && x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
        const hit = inViewport ? document.elementFromPoint(x, y) : null;
        const authoredLabels = ['音声を有効にする', '音声を再試行', '利用できない音声だけ再試行'];
        const label = control.getAttribute('aria-label');
        const state = control.getAttribute('data-state');
        return {
          status: 'ok', ariaLabel: authoredLabels.includes(label) ? label : null,
          dataState: ['idle', 'pending', 'success', 'partial', 'failed'].includes(state) ? state : null,
          disabled: boolean(control.disabled), connected: boolean(control.isConnected), rect,
          style: { display: token(style.display), visibility: token(style.visibility), opacity: number(Number.parseFloat(style.opacity)), pointerEvents: token(style.pointerEvents) },
          centerInViewport: inViewport,
          topHit: hit ? {
            tagName: token(hit.tagName), role: token(hit.getAttribute('role')),
            classNames: [...hit.classList].filter(value => /^[a-z][a-z0-9_-]{0,63}$/iu.test(value)).slice(0, 6),
            sameMarkedControl: hit.closest(selector) === control,
          } : null,
        };
      } catch (error) {
        return { status: 'data-error', reason: 'control-read-rejected', errorName: errorName(error) };
      }
    }) };
  } catch (error) {
    controls = { status: 'data-error', reason: 'controls-read-rejected', errorName: errorName(error) };
  }
  return {
    schema: 'v177-normal-audio-unlock-snapshot/v1', observedAtEpochMs: Date.now(),
    observedAtPerformanceMs: number(performance.now()), visibilityState: token(document.visibilityState),
    audioStatus, diagnostics, controls,
  };
}

async function observe(page) {
  let timer;
  const startedAtEpochMs = Date.now();
  const operation = Promise.resolve().then(() => page.evaluate(readNormalAudioUnlockSnapshot)).then(
    value => value?.schema === 'v177-normal-audio-unlock-snapshot/v1'
      ? { status: 'ok', value }
      : { status: 'unknown', reason: 'invalid-snapshot' },
    error => ({ status: 'data-error', reason: 'evaluate-rejected', errorName: typeof error?.name === 'string' && /^[a-z]{1,40}$/iu.test(error.name) ? error.name : 'Error' }),
  );
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => resolve({ status: 'data-error', reason: 'read-timeout', timeoutMs: NORMAL_AUDIO_UNLOCK_READ_MS }), NORMAL_AUDIO_UNLOCK_READ_MS);
  });
  try {
    const result = await Promise.race([operation, deadline]);
    return { ...result, startedAtEpochMs, finishedAtEpochMs: Date.now() };
  } finally {
    clearTimeout(timer);
  }
}

// New diagnostic conditions: a before-read can add up to 1s to an auto-hide UI
// that disappears after 1.8s. This is not an unchanged causal replay of A3.
export async function captureNormalAudioUnlockAttempt(audio, { page, attempts, stageNumber }) {
  if (!Array.isArray(attempts)) throw new TypeError('audio-unlock attempts must be an array');
  if (attempts.length >= NORMAL_AUDIO_UNLOCK_ATTEMPT_LIMIT) {
    const last = attempts[NORMAL_AUDIO_UNLOCK_ATTEMPT_LIMIT - 1];
    if (last && typeof last === 'object') last.suppressedObservationAttempts = (last.suppressedObservationAttempts ?? 0) + 1;
    return await audio.click();
  }
  const row = {
    schema: 'v177-normal-audio-unlock-attempt/v1', ordinal: attempts.length + 1,
    stageNumber: Number.isInteger(stageNumber) ? stageNumber : null,
    before: null, click: { status: 'pending' }, after: null,
    acceptance: { audioSignal: false, physicalSavedRecording: false, wholeGame: false },
  };
  attempts.push(row);
  row.before = await observe(page);
  let value, originalError, failed = false;
  try {
    value = await audio.click();
    row.click.status = 'returned';
  } catch (error) {
    failed = true;
    originalError = error;
    row.click.status = 'failed';
  }
  row.after = await observe(page);
  if (failed) throw originalError;
  return value;
}
