// Start the finite combat proof when the real vehicle action is first observed.
// The battle setup may continue, but it must await this same proof later.
export function createVehicleCombatProofGate(capture) {
  if (typeof capture !== "function") throw new TypeError("vehicle proof capture must be a function");
  let pending = null;
  return Object.freeze({
    start() {
      if (pending === null) {
        pending = Promise.resolve().then(capture);
        // Setup can outlast the 12-second proof. Observe an early rejection
        // without replacing the original error that result() later returns.
        void pending.catch(() => {});
      }
      return pending;
    },
    result() {
      if (pending === null) throw new Error("vehicle proof requested before observed vehicle action");
      return pending;
    },
  });
}
