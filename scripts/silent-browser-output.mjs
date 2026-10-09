// Keep QA silent. Chromium and hosted macOS retain real audio clocks;
// local Windows WebKit provides UI evidence with native playback blocked.
export function installSilentBrowserOutput({ blockNativePlayback }) {
  if (globalThis.__CODEX_SILENT_QA__) return;
  const proof = { blockNativePlayback, nativePlayCalls: 0, blockedNativePlays: 0, guard: null };
  globalThis.__CODEX_SILENT_QA__ = proof;
  // Local WebKit produced audible title calls despite the muted flag. Its
  // runs are UI evidence only; reject native play before it reaches the port.
  // Audio clocks and recovery are verified in Chromium and hosted macOS.
  if (typeof AudioNode !== 'undefined') {
    const connect = AudioNode.prototype.connect;
    const sinks = new WeakMap();
    AudioNode.prototype.connect = function (target, ...args) {
      if (target === this.context.destination) {
        let sink = sinks.get(this.context);
        if (!sink) {
          sink = this.context.createGain();
          sink.gain.value = 0;
          connect.call(sink, this.context.destination);
          sinks.set(this.context, sink);
        }
        return connect.call(this, sink, ...args);
      }
      return connect.call(this, target, ...args);
    };
  }
  const play = HTMLMediaElement.prototype.play;
  const guardedPlay = function () {
    this.muted = true;
    if (blockNativePlayback) {
      proof.blockedNativePlays++;
      return Promise.reject(new DOMException('Native audio disabled for local UI QA', 'NotSupportedError'));
    }
    proof.nativePlayCalls++;
    return play.call(this);
  };
  HTMLMediaElement.prototype.play = guardedPlay;
  proof.guard = guardedPlay;
}

export async function silenceBrowserOutput(page) {
  const blockNativePlayback = process.platform === 'win32'
    && page.context().browser()?.browserType().name() === 'webkit';
  const options = { blockNativePlayback };
  try {
    await page.addInitScript(installSilentBrowserOutput, options);
    // Verify the guard on the empty page before any game URL is opened.
    await page.evaluate(installSilentBrowserOutput, options);
    const installed = await page.evaluate(() => HTMLMediaElement.prototype.play === globalThis.__CODEX_SILENT_QA__?.guard);
    if (!installed) throw new Error('Silent QA guard was not installed');
  } catch (error) { await page.context().close(); throw error; }
}
