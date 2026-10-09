// Run game browser QA on hosted Linux/macOS. Local Windows QA is disabled:
// blocking explicit play calls did not prevent the reported audible output.
export function assertSilentQaHost(platform) {
  if (platform === 'win32') throw new Error('Local Windows game-browser QA is disabled after audible output. Use hosted CI.');
}

export function installSilentBrowserOutput({ blockNativePlayback }) {
  if (globalThis.__CODEX_SILENT_QA__) return;
  const proof = { blockNativePlayback, nativePlayCalls: 0, blockedNativePlays: 0, guard: null };
  globalThis.__CODEX_SILENT_QA__ = proof;
  // This explicit-call guard is not evidence that browser preload is silent.
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
  try {
    assertSilentQaHost(process.platform);
    const options = { blockNativePlayback: false };
    await page.addInitScript(installSilentBrowserOutput, options);
    // Verify the guard on the empty page before any game URL is opened.
    await page.evaluate(installSilentBrowserOutput, options);
    const installed = await page.evaluate(() => HTMLMediaElement.prototype.play === globalThis.__CODEX_SILENT_QA__?.guard);
    if (!installed) throw new Error('Silent QA guard was not installed');
  } catch (error) { await page.context().close(); throw error; }
}
