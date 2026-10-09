// Read the actual output AudioParam without changing its value, connections,
// media promises, events or clocks. Desktop ports without Web Audio retain
// their native-volume observation.
export async function installEndingAudioGainObserver(page) {
  await page.addInitScript(() => {
    const gains = new WeakMap();
    const Constructor = window.AudioContext ?? window.webkitAudioContext;
    const prototype = Constructor?.prototype;
    if (prototype?.createMediaElementSource) {
      const createSource = prototype.createMediaElementSource;
      prototype.createMediaElementSource = function (audio) {
        const source = createSource.call(this, audio), connect = source.connect;
        source.connect = function (destination, ...args) {
          const result = connect.call(this, destination, ...args);
          if (destination?.gain) gains.set(audio, destination.gain);
          return result;
        };
        return source;
      };
    }
    window.__endingOutputGain = audio => gains.get(audio)?.value ?? audio.volume;
  });
}
