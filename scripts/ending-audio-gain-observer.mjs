import assert from 'node:assert/strict';

// Read the actual output AudioParam without changing its value, connections,
// media promises, events or clocks. Desktop ports without Web Audio retain
// their native-volume observation.
export async function installEndingAudioGainObserver(page) {
  await page.addInitScript(() => {
    const gains = new WeakMap();
    const traces = new WeakMap(), observed = new WeakSet();
    const traceFor = audio => {
      if (!traces.has(audio)) traces.set(audio, { writes: [], errors: [], truncated: false });
      return traces.get(audio);
    };
    const observe = (audio, param) => {
      if (observed.has(param)) return;
      observed.add(param);
      const trace = traceFor(audio);
      let owner = param, descriptor;
      while (owner && !descriptor) { descriptor = Object.getOwnPropertyDescriptor(owner, 'value'); owner = Object.getPrototypeOf(owner); }
      if (!descriptor?.get || !descriptor?.set) { trace.errors.push('Native AudioParam value accessor is unavailable'); return; }
      const get = descriptor.get, set = descriptor.set;
      try {
        Object.defineProperty(param, 'value', {
          configurable: true, enumerable: descriptor.enumerable,
          get() { return Reflect.apply(get, this, []); },
          set(value) {
            const result = Reflect.apply(set, this, [value]);
            try {
              if (trace.writes.length >= 1024) trace.truncated = true;
              else trace.writes.push({ at: performance.now(), time: audio.currentTime,
                gain: Reflect.apply(get, this, []), requested: Number(value), rate: audio.playbackRate,
                paused: audio.paused, outro: document.querySelector('.v100-staff-roll')?.dataset.v100CreditOutroStarted === 'true' });
            } catch (error) { if (trace.errors.length < 8) trace.errors.push(String(error)); }
            return result;
          },
        });
      } catch (error) { trace.errors.push(String(error)); }
    };
    const Constructor = window.AudioContext ?? window.webkitAudioContext;
    const prototype = Constructor?.prototype;
    if (prototype?.createMediaElementSource) {
      const createSource = prototype.createMediaElementSource;
      prototype.createMediaElementSource = function (audio) {
        const source = createSource.call(this, audio), connect = source.connect;
        source.connect = function (destination, ...args) {
          const result = connect.call(this, destination, ...args);
          if (destination?.gain) { gains.set(audio, destination.gain); observe(audio, destination.gain); }
          return result;
        };
        return source;
      };
    }
    window.__endingOutputGain = audio => gains.get(audio)?.value ?? audio.volume;
    window.__endingOutputGainTrace = audio => {
      const trace = traceFor(audio);
      return { writes: trace.writes.map(row => ({ ...row })), errors: [...trace.errors], truncated: trace.truncated };
    };
  });
}

export function assertEndingGainFadeOnset(trace, nominal, duration) {
  assert.ok(trace && Array.isArray(trace.writes) && Array.isArray(trace.errors));
  assert.equal(trace.errors.length, 0, 'Native output gain observation must succeed');
  assert.equal(trace.truncated, false, 'A truncated gain trace cannot prove fade timing');
  assert.ok(Number.isFinite(nominal) && nominal > 0 && Number.isFinite(duration));
  const fade = trace.writes.filter(row => row.outro && Number.isFinite(row.gain) && row.gain < nominal - .00001);
  assert.ok(fade.length > 0, 'Observe actual native gain writes during the outro');
  assert.ok(fade[0].time >= duration - .1 && fade[0].time < duration + .35,
    'The actual output must start fading within the original timing bounds');
  return { startedAtMusicSeconds: fade[0].time, firstWrite: fade[0], writes: fade.length };
}
