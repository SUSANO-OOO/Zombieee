// Browser QA observes clocks, owners and gains without playing through the
// developer's speakers. Cover native media fallback as well as Web Audio.
export async function silenceBrowserOutput(page) {
  await page.addInitScript(() => {
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
    HTMLMediaElement.prototype.play = function () {
      this.muted = true;
      return play.call(this);
    };
  });
}
